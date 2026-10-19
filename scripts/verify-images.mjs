// Read-only production check: database records alone do not prove objects exist.
import { HeadObjectCommand } from "@aws-sdk/client-s3";
import { connect, storage, bucket } from "./runtime.mjs";
import { branding } from "../src/lib/branding.js";
let connection;
try {
  connection = await connect();
  const [logos] = await connection.execute(
    "SELECT asset_key,object_key,mime_type FROM branding_assets",
  );
  const [photos] = await connection.execute(
    "SELECT i.id,s.object_key,s.mime_type,s.byte_size FROM report_images i LEFT JOIN report_image_storage s ON s.report_image_id=i.id ORDER BY i.id",
  );
  const objects = [
    ...branding.map((asset) => ({
      label: `Logo ${asset.key}`,
      ...logos.find((row) => row.asset_key === asset.key),
    })),
    ...photos.map((row) => ({ ...row, label: `Report image ${row.id}` })),
  ];
  const client = storage();
  let verified = 0,
    missing = 0,
    failed = 0;
  for (const object of objects) {
    if (!object.object_key) {
      missing++;
      console.log(
        `UNVERIFIED: ${object.label} has no R2 storage record. Run the image migration.`,
      );
      continue;
    }
    try {
      const head = await client.send(
        new HeadObjectCommand({ Bucket: bucket(), Key: object.object_key }),
        { abortSignal: AbortSignal.timeout(10000) },
      );
      if (
        !head.ContentLength ||
        (object.byte_size != null &&
          Number(object.byte_size) !== Number(head.ContentLength))
      )
        throw Error("SizeMismatch");
      if (head.ContentType !== object.mime_type) throw Error("TypeMismatch");
      verified++;
      console.log(
        `VERIFIED: ${object.label} exists in R2 (${head.ContentLength} bytes).`,
      );
    } catch (error) {
      failed++;
      console.error(
        `FAILED: ${object.label} (${error.$metadata?.httpStatusCode || error.name || "storage error"}).`,
      );
    }
  }
  console.log(
    `Bucket: ${bucket()}. Verified: ${verified}. Unverified: ${missing}. Failed: ${failed}. Report images checked: ${photos.length}.`,
  );
  if (missing || failed) process.exitCode = 1;
} catch (error) {
  console.error(
    `R2 verification could not run: ${error.code || error.message}`,
  );
  process.exitCode = 1;
} finally {
  await connection?.end();
}

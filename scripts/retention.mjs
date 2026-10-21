// Thirty days after a report is resolved: deletes its files from R2 and anonymizes it, together.
// PM2 runs this every 15 minutes (see .github/workflows/deploy.yml). Reports resolved before
// retention began are left alone until the one-time backfill is approved:
//   npm run retention -- --backfill            counts what the backfill would delete; changes nothing
//   npm run retention -- --backfill --approve  approves it; the next run deletes and anonymizes them
import { CopyObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { connect, storage, bucket, evidenceBucket } from "./runtime.mjs";
import { runRetention, backfillSummary, approveBackfill } from "../src/lib/retention.js";

const backfill = process.argv.includes("--backfill");
const approve = process.argv.includes("--approve");
let connection;
try {
  connection = await connect();
  if (backfill) {
    const summary = await backfillSummary(connection);
    console.log(`Retention began: ${summary.started_at?.toISOString?.() ?? summary.started_at}`);
    console.log(`Resolved more than 30 days before that, not yet anonymized: ${summary.reports} reports, ${summary.photos} report photos, ${summary.commentPhotos} comment photos.`);
    if (summary.approved_at) console.log(`Backfill already approved: ${summary.approved_at.toISOString?.() ?? summary.approved_at}`);
    else if (approve) {
      await approveBackfill(connection);
      console.log("Backfill approved. The next retention run permanently deletes these files and anonymizes these reports.");
    } else console.log("Nothing changed. Run again with --backfill --approve to permanently delete and anonymize them.");
  } else {
    const client = storage({ requestChecksumCalculation: "WHEN_REQUIRED", responseChecksumValidation: "WHEN_REQUIRED" });
    // Evidence keys live in the evidence bucket; photos from before direct uploads in the original.
    const home = (key) => (/^(incoming|evidence|expiring)\//.test(key) ? evidenceBucket() : bucket());
    const result = await runRetention({
      db: connection,
      imageBase: (process.env.R2_IMAGE_BASE_URL || "https://images.kosova.report").replace(/\/?$/, "/"),
      storage: {
        copy: (from, to) =>
          client.send(new CopyObjectCommand({ Bucket: home(to), CopySource: `${home(from)}/${from}`, Key: to })),
        remove: (key) => client.send(new DeleteObjectCommand({ Bucket: home(key), Key: key })),
      },
    });
    if (Object.values(result).some(Boolean)) console.log("Retention run", result);
    if (result.failed) process.exitCode = 1;
  }
} catch (error) {
  console.error("Retention unavailable", { code: error.code || error.name || "ERROR" });
  process.exitCode = 1;
} finally {
  await connection?.end();
}

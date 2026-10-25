import { randomUUID } from "node:crypto";
import { database, required } from "../../../../lib/db";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import {
  queueStatusEmails,
  deliverStatusEmails,
} from "../../../../lib/report-notifications";
import { categories } from "../../../../lib/report-options";
import { pinInsideCity } from "../../../../lib/city-boundary";
import { attachReport } from "../../../../lib/incidents";
import { validRef } from "../../../../lib/incident-matching";
import {
  claimUploads,
  promoteUploads,
  bindUploads,
  deleteKeys,
} from "../../../../lib/attachments";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX_BODY = 51 * 1024 * 1024;
function invalid(message, status = 400) {
  return Object.assign(new Error(message), {
    status,
  });
}
function imageType(buffer) {
  if (buffer.subarray(0, 3).equals(Buffer.from([255, 216, 255])))
    return ["image/jpeg", "jpg"];
  if (
    buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return ["image/png", "png"];
  if (
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  )
    return ["image/webp", "webp"];
  return null;
}
export async function POST(request) {
  let connection,
    s3,
    bucket,
    committed = false,
    claimed = [];
  const uploaded = [],
    promoted = [];
  try {
    const appOrigin = new URL(required("APP_URL")).origin;
    if (
      request.headers.get("origin") &&
      request.headers.get("origin") !== appOrigin
    )
      throw invalid("Origin not allowed", 403);
    if (!request.headers.get("content-type")?.startsWith("multipart/form-data"))
      throw invalid("Expected multipart form data", 415);
    // Enforce a real streaming limit; Content-Length alone is not trustworthy.
    const reader = request.body?.getReader();
    if (!reader) throw invalid("Empty request");
    const chunks = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY) {
        await reader.cancel();
        throw invalid("Request too large", 413);
      }
      chunks.push(value);
    }
    let form;
    try {
      form = await new Request(request.url, {
        method: "POST",
        headers: {
          "content-type": request.headers.get("content-type"),
        },
        body: Buffer.concat(chunks),
      }).formData();
    } catch {
      throw invalid("Invalid multipart body");
    }
    const text = (key, max) => {
      const values = form.getAll(key);
      if (values.length > 1 || values.some((v) => typeof v !== "string"))
        throw invalid(`Invalid ${key}`);
      const value = (values[0] || "").trim();
      if (value.length > max) throw invalid(`Invalid ${key}`);
      return value;
    };
    const city = text("city", 10),
      category = text("category", 30),
      description = text("description", 5000),
      language = text("language", 2);
    const latText = text("latitude", 30),
      lngText = text("longitude", 30),
      latitude = Number(latText),
      longitude = Number(lngText);
    const anonymousValue = text("anonymous", 5);
    if (
      !["true", "false"].includes(anonymousValue) ||
      !/^[A-Z0-9]{2,10}$/.test(city) ||
      !categories.includes(category) ||
      !["sq", "sr", "en"].includes(language) ||
      description.length < 10 ||
      !latText ||
      !lngText ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    )
      throw invalid("Invalid report fields");
    const anonymous = anonymousValue === "true";
    // Optional: the existing incident the reporter said is the same problem, the ones they
    // said are different, and the GPS accuracy of the pin. All re-checked on the server.
    const chosenRef = text("incident", 10),
      declinedRefs = text("declined", 65).split(",").filter(Boolean),
      accuracy = Number(text("accuracy", 8)) || undefined;
    if ((chosenRef && !validRef(chosenRef)) || declinedRefs.length > 5 || !declinedRefs.every(validRef))
      throw invalid("Invalid report fields");
    const email = anonymous ? null : text("email", 254);
    if (
      !anonymous &&
      (!email ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        /[\r\n]/.test(email))
    )
      throw invalid("Valid contact email required");
    const images = form.getAll("images");
    if (images.length > 10) throw invalid("Maximum 10 images");
    // New clients upload straight to R2 and name the uploads here; older ones still send photos.
    const uploadRefs = text("attachments", 500).split(",").filter(Boolean);
    if (uploadRefs.length > 13 || (uploadRefs.length && images.length))
      throw invalid("Invalid attachments");
    const validated = [];
    for (const file of images) {
      if (typeof file === "string" || !file.size || file.size > 5 * 1024 * 1024)
        throw invalid("Each image must be 1 byte to 5 MB");
      const body = Buffer.from(await file.arrayBuffer()),
        type = imageType(body);
      if (!type || type[0] !== file.type)
        throw invalid("Only JPEG, PNG and WebP images accepted");
      validated.push({
        body,
        type,
      });
    }
    bucket = process.env.R2_BUCKET || "kosova-report-images";
    const accountId = required("R2_ACCOUNT_ID");
    const imageBaseURL = new URL(
      (
        process.env.R2_IMAGE_BASE_URL ||
        "https://images.kosova.report"
      ).replace(/\/$/, "") + "/",
    );
    if (imageBaseURL.protocol !== "https:")
      throw new Error("Image base URL must use HTTPS");
    s3 = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: required("R2_ACCESS_KEY_ID"),
        secretAccessKey: required("R2_SECRET_ACCESS_KEY"),
      },
      maxAttempts: 3,
    });
    connection = await database().getConnection();
    const [municipalities] = await connection.execute(
      "SELECT c.id,UPPER(c.code) AS code FROM cities c JOIN municipality_settings m ON m.city_id=c.id WHERE c.code=? AND m.enabled=1 LIMIT 1",
      [city],
    );
    if (
      !municipalities.length ||
      !/^[A-Z0-9]{2,10}$/.test(municipalities[0].code)
    )
      throw invalid("Municipality unavailable", 503);
    const cityCode = municipalities[0].code;
    // The pin must be inside the municipality's official boundary, when one is on file.
    if (!(await pinInsideCity(cityCode, [latitude, longitude])))
      throw invalid("Location is outside the municipality", 422);
    const cityId = municipalities[0].id;
    const [departments] = await connection.execute(
      "SELECT d.id,d.notification_email FROM department_routes routing JOIN departments d ON d.id=routing.department_id AND d.city_id=routing.city_id WHERE routing.city_id=? AND routing.category=? AND routing.active=1 LIMIT 1",
      [cityId, category],
    );
    if (!departments.length)
      throw invalid(
        "Reporting is not configured for this municipality and category",
        503,
      );
    const department = departments[0],
      tracking_key = randomUUID(),
      uploadId = randomUUID();
    claimed = await claimUploads(connection, uploadRefs);
    promoted.push(...(await promoteUploads(claimed)));
    for (const { body, type } of validated) {
      const key = `reports/${uploadId}/${randomUUID()}.${type[1]}`;
      uploaded.push(key);
      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentType: type[0],
        }),
      );
    }
    await connection.beginTransaction();
    const year = Number(
      new Intl.DateTimeFormat("en", {
        year: "numeric",
        timeZone: "Europe/Belgrade",
      }).format(new Date()),
    );
    await connection.execute(
      "INSERT INTO report_counters (city_id, report_year, sequence_value) VALUES (?, ?, 0) ON DUPLICATE KEY UPDATE sequence_value=sequence_value",
      [cityId, year],
    );
    const [counters] = await connection.execute(
      "SELECT sequence_value FROM report_counters WHERE city_id=? AND report_year=? FOR UPDATE",
      [cityId, year],
    );
    // Seed from existing official IDs too, while holding the city/year lock.
    const [existing] = await connection.execute(
      "SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(public_id,'-',-1) AS UNSIGNED)),0) AS last_sequence FROM reports WHERE city_id=? AND public_id REGEXP ?",
      [cityId, `^${cityCode}-${year}-[0-9]{1,12}$`],
    );
    const saved = BigInt(counters[0].sequence_value),
      previous = BigInt(existing[0].last_sequence);
    const sequence = (saved > previous ? saved : previous) + 1n;
    if (sequence > 999999999999n)
      throw invalid("Report sequence exhausted", 503);
    const public_id = `${cityCode}-${year}-${String(sequence).padStart(6, "0")}`;
    await connection.execute(
      "UPDATE report_counters SET sequence_value=? WHERE city_id=? AND report_year=?",
      [sequence.toString(), cityId, year],
    );
    // Staff approve the report before its department is emailed.
    const [inserted] = await connection.execute(
      "INSERT INTO reports (public_id,tracking_key,category,description,lat,lng,city_id,department_id,is_anonymous,reporter_email,review_state) VALUES (?,?,?,?,?,?,?,?,?,?,'pending')",
      [
        public_id,
        tracking_key,
        category,
        description,
        latitude,
        longitude,
        cityId,
        department.id,
        anonymous,
        email,
      ],
    );
    const reportId = inserted.insertId;
    // Grouping must never cost a citizen their report: if it fails, the report is saved alone.
    let incident = { ref: null, joined: false, report_count: 1 };
    try {
      incident = await attachReport(connection, {
        reportId,
        cityId,
        category,
        point: [latitude, longitude],
        accuracy,
        chosenRef,
        declinedRefs,
      });
    } catch (error) {
      console.error("Report grouping skipped", { reportId, code: error.code || "INCIDENT_ERROR" });
    }
    await queueStatusEmails(connection, reportId, `created:${reportId}`, [
      "reporter",
    ]);
    for (let i = 0; i < uploaded.length; i++) {
      const imageURL = new URL(uploaded[i], imageBaseURL).href;
      if (imageURL.length > 512)
        throw new Error("Image URL exceeds database column length");
      const [image] = await connection.execute(
        "INSERT INTO report_images (report_id,image_url) VALUES (?,?)",
        [reportId, imageURL],
      );
      await connection.execute(
        "INSERT INTO report_image_storage (report_image_id,object_key,mime_type,byte_size,sort_order) VALUES (?,?,?,?,?)",
        [
          image.insertId,
          uploaded[i],
          validated[i].type[0],
          validated[i].body.length,
          i,
        ],
      );
    }
    await bindUploads(connection, reportId, claimed);
    await connection.commit();
    committed = true;
    connection.release();
    connection = null;
    // The copies in evidence/ are the ones kept; incoming/ would expire within a day anyway.
    deleteKeys(claimed.map((upload) => upload.object_key)).catch(() => {});
    try {
      await deliverStatusEmails(`created:${reportId}`);
    } catch {
      console.error("Receipt email pending", { reportId });
    }
    return Response.json(
      {
        public_id,
        tracking_key,
        // The department is emailed once staff approve the report.
        notification: "review",
        incident: incident.ref
          ? { ref: incident.ref, joined: incident.joined, report_count: incident.report_count }
          : null,
      },
      {
        status: 201,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch {
        console.error("Report rollback failed");
      }
    }
    if (!committed) await deleteKeys(promoted);
    if (!committed && s3 && bucket)
      await Promise.allSettled(
        uploaded.map((Key) =>
          s3.send(
            new DeleteObjectCommand({
              Bucket: bucket,
              Key,
            }),
          ),
        ),
      );
    if (!error.status)
      console.error("Report submission failed", {
        code: error.code || "INTERNAL",
      });
    return Response.json(
      {
        error: error.status ? error.message : "Unable to save report",
      },
      {
        status: error.status || 500,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } finally {
    connection?.release();
  }
}

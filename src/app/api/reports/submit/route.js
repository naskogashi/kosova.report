import { randomUUID } from "node:crypto";
import { database, required } from "../../../../lib/db";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import {
  emailConfiguration,
  sendDepartmentEmail,
} from "../../../../lib/smtp2go";
import {
  departmentLink,
  queueStatusEmails,
  deliverStatusEmails,
} from "../../../../lib/report-notifications";
import { categories } from "../../../../lib/report-options";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX_BODY = 51 * 1024 * 1024;
const escapeHTML = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c],
  );
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
    committed = false;
  const uploaded = [];
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
    const emailConfig = emailConfiguration();
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
    const [inserted] = await connection.execute(
      "INSERT INTO reports (public_id,tracking_key,category,description,lat,lng,city_id,department_id,is_anonymous,reporter_email) VALUES (?,?,?,?,?,?,?,?,?,?)",
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
    const progressLink = await departmentLink(connection, {
      id: reportId,
      department_id: department.id,
      public_id,
    });
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
    // Leave room under SMTP2Go's 50 MB encoded-message limit. Originals stay in R2.
    const inlineImages = [];
    let inlineBytes = 0;
    for (const image of validated) {
      if (inlineBytes + image.body.length > 30 * 1024 * 1024) break;
      inlineImages.push(image);
      inlineBytes += image.body.length;
    }
    const imageHTML = inlineImages
      .map(
        (image, index) =>
          `<img src="cid:image-${index}@kosova.report" alt="Report photo ${index + 1}" style="display:block;max-width:100%;height:auto;margin:16px 0;border-radius:8px"/>`,
      )
      .join("");
    const html = `<div style="background:#f1f5f9;padding:24px;font-family:Arial,sans-serif;color:#102344"><div style="max-width:640px;margin:auto;background:#fff;border-radius:12px;overflow:hidden"><div style="background:#062653;color:white;padding:24px;font-size:22px;font-weight:bold">kosova.report</div><div style="padding:24px"><p style="color:#1d4ed8">NEW CIVIC REPORT</p><h1>${escapeHTML(public_id)}</h1><p>${escapeHTML(city)} / ${escapeHTML(category)}</p><p style="white-space:pre-wrap">${escapeHTML(description)}</p><p>Coordinates: ${latitude}, ${longitude}</p><p><a href="https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=17/${latitude}/${longitude}" style="color:#1248b5">View location on OpenStreetMap</a></p><p>${anonymous ? "Anonymous report" : `Reporter email: ${escapeHTML(email)}`}</p><p><a href="${escapeHTML(progressLink)}" style="display:inline-block;background:#0843b5;color:white;padding:14px 20px;border-radius:8px">View report and update progress</a></p>${imageHTML}<p>${inlineImages.length} of ${validated.length} photos attached. All evidence is available to authorized staff in the admin panel.</p></div><div style="padding:20px;background:#f8fafc;font-size:12px">in co-operation with CODON a part of Progon LLC.</div></div></div>`;
    const subject = `New report ${public_id}`;
    await connection.execute(
      "INSERT INTO report_notifications (report_id,recipient,subject,html) VALUES (?,?,?,?)",
      [reportId, department.notification_email, subject, html],
    );
    await connection.commit();
    committed = true;
    connection.release();
    connection = null;
    let notification = "pending";
    try {
      await sendDepartmentEmail(
        {
          attachments: inlineImages.map((image, index) => ({
            filename: `photo-${index + 1}.${image.type[1]}`,
            content: image.body,
            contentType: image.type[0],
            cid: `image-${index}@kosova.report`,
            contentDisposition: "inline",
          })),
          to: department.notification_email,
          subject,
          html,
          text: `New report ${public_id}\n${description}\nCoordinates: ${latitude}, ${longitude}\nProgress: ${progressLink}`,
          messageId: `<${uploadId}@${new URL(required("APP_URL")).hostname}>`,
        },
        emailConfig,
      );
      notification = "sent";
      await database().execute(
        "UPDATE report_notifications SET sent_at=UTC_TIMESTAMP(), attempts=attempts+1 WHERE report_id=?",
        [reportId],
      );
    } catch {
      console.error("Report notification pending", {
        reportId,
      });
    }
    try {
      await deliverStatusEmails(`created:${reportId}`);
    } catch {
      console.error("Receipt email pending", { reportId });
    }
    return Response.json(
      {
        public_id,
        tracking_key,
        notification,
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

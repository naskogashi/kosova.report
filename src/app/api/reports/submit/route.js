import { randomUUID } from "node:crypto";
import { database, required } from "../../../../lib/db";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import nodemailer from "nodemailer";
import { categories, cities } from "../../../../lib/report-options";
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
    const city = text("city", 2),
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
      !cities.some((c) => c.code === city) ||
      !categories.includes(category) ||
      !["sq", "sr", "en"].includes(language) ||
      description.length < 10 ||
      !latText ||
      !lngText ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < 41.8 ||
      latitude > 43.3 ||
      longitude < 19.9 ||
      longitude > 21.9
    )
      throw invalid("Invalid report fields");
    const anonymous = anonymousValue === "true";
    const name = anonymous ? null : text("name", 120),
      email = anonymous ? null : text("email", 254),
      phone = anonymous ? null : text("phone", 40);
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
    const imageBaseURL = new URL(
      required("R2_IMAGE_BASE_URL").replace(/\/$/, "") + "/",
    );
    if (imageBaseURL.protocol !== "https:")
      throw new Error("Image base URL must use HTTPS");
    bucket = required("R2_BUCKET");
    s3 = new S3Client({
      region: "auto",
      endpoint: `https://${required("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: required("R2_ACCESS_KEY_ID"),
        secretAccessKey: required("R2_SECRET_ACCESS_KEY"),
      },
      maxAttempts: 3,
    });
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "mail.smtp2go.com",
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_PORT === "465",
      requireTLS: process.env.SMTP_PORT !== "465",
      auth: {
        user: required("SMTP_USER"),
        pass: required("SMTP_PASSWORD"),
      },
      connectionTimeout: 10000,
      socketTimeout: 15000,
    });
    const from = required("SMTP_FROM");
    connection = await database().getConnection();
    const [municipalities] = await connection.execute(
      "SELECT code FROM cities WHERE code=? AND active=1 LIMIT 1",
      [city],
    );
    if (!municipalities.length || !/^[A-Z]{2}$/.test(municipalities[0].code))
      throw invalid("Municipality unavailable", 503);
    const cityCode = municipalities[0].code;
    const [departments] = await connection.execute(
      "SELECT id, notification_email FROM departments WHERE city_code=? AND category=? AND active=1 LIMIT 1",
      [city, category],
    );
    if (!departments.length)
      throw invalid(
        "Reporting is not configured for this municipality and category",
        503,
      );
    const department = departments[0],
      tracking_key = randomUUID(),
      reportId = randomUUID();
    for (const { body, type } of validated) {
      const key = `reports/${reportId}/${randomUUID()}.${type[1]}`;
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
      "INSERT INTO report_counters (city_code, report_year, sequence_value) VALUES (?, ?, 0) ON DUPLICATE KEY UPDATE sequence_value=sequence_value",
      [city, year],
    );
    const [counters] = await connection.execute(
      "SELECT sequence_value FROM report_counters WHERE city_code=? AND report_year=? FOR UPDATE",
      [city, year],
    );
    const sequence = Number(counters[0].sequence_value) + 1;
    const public_id = `${cityCode}-${year}-${String(sequence).padStart(6, "0")}`;
    await connection.execute(
      "UPDATE report_counters SET sequence_value=? WHERE city_code=? AND report_year=?",
      [sequence, city, year],
    );
    await connection.execute(
      "INSERT INTO reports (id,public_id,tracking_key,city_code,category,latitude,longitude,description,language,anonymous,contact_name,contact_email,contact_phone,department_id,images) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      [
        reportId,
        public_id,
        tracking_key,
        city,
        category,
        latitude,
        longitude,
        description,
        language,
        anonymous,
        name,
        email,
        phone,
        department.id,
        JSON.stringify(uploaded),
      ],
    );
    for (let i = 0; i < uploaded.length; i++) {
      const imageURL = new URL(uploaded[i], imageBaseURL).href;
      await connection.execute(
        "INSERT INTO report_images (report_id, object_key, image_url, mime_type, byte_size, sort_order) VALUES (?,?,?,?,?,?)",
        [
          reportId,
          uploaded[i],
          imageURL,
          validated[i].type[0],
          validated[i].body.length,
          i,
        ],
      );
    }
    const imageHTML = validated
      .map(
        (image, index) =>
          `<img src="cid:image-${index}@kosova.report" alt="Report photo ${index + 1}" style="display:block;max-width:100%;height:auto;margin:16px 0;border-radius:8px"/>`,
      )
      .join("");
    const html = `<div style="background:#f1f5f9;padding:24px;font-family:Arial,sans-serif;color:#102344"><div style="max-width:640px;margin:auto;background:#fff;border-radius:12px;overflow:hidden"><div style="background:#062653;color:white;padding:24px;font-size:22px;font-weight:bold">kosova.report</div><div style="padding:24px"><p style="color:#1d4ed8">NEW CIVIC REPORT</p><h1>${escapeHTML(public_id)}</h1><p>${escapeHTML(city)} / ${escapeHTML(category)}</p><p style="white-space:pre-wrap">${escapeHTML(description)}</p><p>Coordinates: ${latitude}, ${longitude}</p><p><a href="https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=17/${latitude}/${longitude}" style="color:#1248b5">View location on OpenStreetMap</a></p><p>${anonymous ? "Anonymous report" : `Reporter email: ${escapeHTML(email)}`}</p>${imageHTML}</div><div style="padding:20px;background:#f8fafc;font-size:12px">Developed by CODON / Progon group</div></div></div>`;
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
      await transport.sendMail({
        attachments: validated.map((image, index) => ({
          filename: `photo-${index + 1}.${image.type[1]}`,
          content: image.body,
          contentType: image.type[0],
          cid: `image-${index}@kosova.report`,
          contentDisposition: "inline",
        })),
        from,
        to: department.notification_email,
        subject,
        html,
        text: `New report ${public_id}\n${description}\nCoordinates: ${latitude}, ${longitude}`,
        messageId: `<${reportId}@${new URL(required("APP_URL")).hostname}>`,
      });
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

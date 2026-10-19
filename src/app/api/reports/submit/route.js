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
// Department email in the site's design. Albanian first, Serbian and English beside it.
// Email clients get tables and inline styles only.
const categoryNames = {
  infrastructure: ["Infrastrukturë", "Infrastruktura", "Infrastructure", "#a9592b"],
  environment: ["Mjedis", "Životna sredina", "Environment", "#3c7847"],
  public_services: ["Shërbime publike", "Javne usluge", "Public services", "#237486"],
  administration: ["Administratë", "Administracija", "Administration", "#6b518f"],
  health: ["Shëndetësi", "Zdravstvo", "Health", "#a64b51"],
  education: ["Arsim", "Obrazovanje", "Education", "#787121"],
  safety: ["Siguri", "Bezbednost", "Safety", "#416e8d"],
};
function departmentEmail({ publicId, city, category, description, latitude, longitude, reporter, link, imageHTML, attached, total }) {
  const [sq, sr, en, color] = categoryNames[category] || [category, category, category, "#06244d"];
  const row = (label, value) =>
    `<tr><td style="padding:8px 12px 8px 0;color:#515e72;font-size:13px;vertical-align:top;white-space:nowrap">${label}</td><td style="padding:8px 0;color:#06244d;font-size:15px;font-weight:bold">${value}</td></tr>`;
  const map = `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=17/${latitude}/${longitude}`;
  return `<div style="background:#f6f9fd;padding:24px 12px;font-family:'Segoe UI',Arial,sans-serif;color:#06244d"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:auto;background:#ffffff;border-radius:18px;border:1px solid #d8e1ec"><tr><td style="padding:24px 24px 0"><span style="font-size:22px;font-weight:800;letter-spacing:-0.5px">kosova<span style="color:#e4b756">&#9679;</span>report</span><p style="margin:18px 0 0;color:#515e72;font-size:13px">Raport i ri qytetar / Nova prijava / New report</p><h1 style="margin:4px 0 0;font-size:28px;letter-spacing:-0.5px">${escapeHTML(publicId)}</h1><p style="margin:14px 0 0"><span style="display:inline-block;padding:6px 12px;border:2px solid ${color};border-radius:10px;color:${color};font-weight:800">${escapeHTML(sq)}</span> <span style="color:#515e72;font-size:13px">${escapeHTML(sr)} / ${escapeHTML(en)}</span></p></td></tr><tr><td style="padding:16px 24px 0"><table role="presentation" cellpadding="0" cellspacing="0">${row("Komuna / Opština / Municipality", escapeHTML(city))}${row("Vendi / Mesto / Place", `${latitude}, ${longitude}<br><a href="${map}" style="color:#154fc3;font-weight:normal;font-size:13px">OpenStreetMap</a>`)}${row("Raportuesi / Podnosilac / Reporter", reporter ? escapeHTML(reporter) : "Pa emër / Anonimno / Without name")}</table></td></tr><tr><td style="padding:16px 24px 0"><p style="margin:0 0 6px;color:#515e72;font-size:13px">Përshkrimi / Opis / Description</p><p style="margin:0;padding:14px 16px;background:#f6f9fd;border-radius:12px;font-size:16px;line-height:1.6;white-space:pre-wrap">${escapeHTML(description)}</p></td></tr><tr><td style="padding:20px 24px 0"><a href="${escapeHTML(link)}" style="display:inline-block;background:#154fc3;color:#ffffff;padding:15px 22px;border-radius:14px;font-weight:bold;text-decoration:none">Hap raportin dhe përditëso statusin</a><p style="margin:8px 0 0;color:#515e72;font-size:13px">Otvorite prijavu i ažurirajte status / Open the report and update its status</p></td></tr><tr><td style="padding:12px 24px 0">${imageHTML}<p style="margin:12px 0 0;color:#515e72;font-size:13px">${attached} / ${total} foto të bashkangjitura. Të gjitha fotot janë në panelin administrativ. / ${attached} of ${total} photos attached. All photos are in the staff panel.</p></td></tr><tr><td style="padding:20px 24px 24px"><p style="margin:0;padding-top:16px;border-top:1px solid #d8e1ec;color:#515e72;font-size:12px">Lidhja është private dhe skadon pas 90 ditësh. Mos e përcillni. / The link is private and expires after 90 days. Do not forward it.<br><br>in co-operation with CODON a part of Progon LLC.</p></td></tr></table></div>`;
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
          `<img src="cid:image-${index}@kosova.report" alt="Foto ${index + 1}" style="display:block;max-width:100%;height:auto;margin:12px 0 0;border-radius:10px"/>`,
      )
      .join("");
    const html = departmentEmail({
      publicId: public_id,
      city,
      category,
      description,
      latitude,
      longitude,
      reporter: anonymous ? null : email,
      link: progressLink,
      imageHTML,
      attached: inlineImages.length,
      total: validated.length,
    });
    const subject = `Raport i ri ${public_id} / New report`;
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

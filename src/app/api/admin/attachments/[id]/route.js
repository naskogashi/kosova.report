import { GetObjectCommand } from "@aws-sdk/client-s3";
import { database } from "../../../../../lib/db";
import { currentAdmin } from "../../../../../lib/admin-session";
import { r2, evidenceBucket } from "../../../../../lib/r2";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Videos and PDFs sent with a report, for owners and the checker assigned to it. PDFs are
// always downloaded, never opened inside the panel, because a PDF can carry scripts.
export async function GET(request, props) {
  const params = await props.params;
  const headers = {
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  };
  const account = await currentAdmin();
  if (!account || account.must_change_password)
    return Response.json({ error: "Authentication required" }, { status: 401, headers });
  if (!/^[1-9]\d{0,19}$/.test(params.id))
    return Response.json({ error: "File not found" }, { status: 404, headers });
  try {
    const [rows] = await database().execute(
      "SELECT a.kind,a.mime_type,a.object_key,a.report_id FROM attachments a WHERE a.id=? AND a.kind IN ('video','pdf') AND a.state IN ('active','expiring_pending','expiring','restoring') AND (?=1 OR EXISTS(SELECT 1 FROM report_assignments r WHERE r.report_id=a.report_id AND r.account_id=?)) LIMIT 1",
      [params.id, account.role === "owner" ? 1 : 0, account.id],
    );
    const file = rows[0];
    if (!file) return Response.json({ error: "File not found" }, { status: 404, headers });
    const object = await r2().send(new GetObjectCommand({ Bucket: evidenceBucket(), Key: file.object_key }));
    const name = `report-${file.report_id}-${params.id}.${file.kind === "video" ? "mp4" : "pdf"}`;
    return new Response(object.Body.transformToWebStream(), {
      headers: {
        ...headers,
        "Content-Type": file.mime_type,
        "Content-Disposition": file.kind === "pdf" ? `attachment; filename="${name}"` : "inline",
        ...(file.kind === "pdf" ? { "Content-Security-Policy": "sandbox" } : {}),
      },
    });
  } catch (error) {
    console.error("Admin attachment unavailable", { code: error.code || "ATTACHMENT_ERROR" });
    return Response.json({ error: "File unavailable" }, { status: 503, headers });
  }
}

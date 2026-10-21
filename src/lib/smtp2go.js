import { required } from "./db";
export function emailConfiguration() {
  return { apiKey: required("SMTP2GO_API_KEY"), sender: required("SMTP_FROM") };
}
export async function sendDepartmentEmail(
  message,
  config = emailConfiguration(),
  fetcher = fetch,
) {
  const files = message.attachments || [];
  const attached = files.filter((file) => !file.cid);
  const response = await fetcher("https://api.smtp2go.com/v3/email/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Smtp2go-Api-Key": config.apiKey,
    },
    signal: AbortSignal.timeout(20000),
    body: JSON.stringify({
      sender: config.sender,
      to: [message.to],
      subject: message.subject,
      html_body: message.html,
      text_body: message.text,
      custom_headers: [{ header: "Message-ID", value: message.messageId }],
      // Photos shown inside the email carry a cid; videos and PDFs are ordinary attachments.
      // SMTP2Go rejects the whole message if an inline has no name.
      inlines: files
        .filter((file) => file.cid)
        .map((image) => ({
          filename: image.cid,
          fileblob: image.content.toString("base64"),
          mimetype: image.contentType,
        })),
      ...(attached.length && {
        attachments: attached.map((file) => ({
          filename: file.filename,
          fileblob: file.content.toString("base64"),
          mimetype: file.contentType,
        })),
      }),
    }),
  });
  const result = await response.json();
  if (
    !response.ok ||
    result.data?.error ||
    Number(result.data?.succeeded) !== 1 ||
    Number(result.data?.failed || 0) > 0
  )
    throw new Error("SMTP2Go did not accept the notification");
  return result.data.email_id;
}

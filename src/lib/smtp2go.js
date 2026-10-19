import { required } from "./db";
export function emailConfiguration() {
  return { apiKey: required("SMTP2GO_API_KEY"), sender: required("SMTP_FROM") };
}
export async function sendDepartmentEmail(
  message,
  config = emailConfiguration(),
  fetcher = fetch,
) {
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
      inlines: (message.attachments || []).map((image) => ({
        filename: image.cid,
        fileblob: image.content.toString("base64"),
        mimetype: image.contentType,
      })),
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

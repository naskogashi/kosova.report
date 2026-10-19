export const publicIdValid = (value) =>
  /^[A-Z0-9]{2,10}-\d{4}-\d{6,12}$/.test(value || "");
export function bearer(request) {
  return (
    request.headers
      .get("authorization")
      ?.match(/^Bearer ([A-Za-z0-9_-]{32,64})$/)?.[1] || null
  );
}
export async function smallJSON(request) {
  const reader = request.body?.getReader();
  if (!reader) throw Error("Empty request");
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 4096) {
      await reader.cancel();
      throw Error("Request too large");
    }
    chunks.push(value);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
export const privateHeaders = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};

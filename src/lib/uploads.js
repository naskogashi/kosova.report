// Sends prepared files straight to the private evidence bucket in Cloudflare R2. The server
// signs one upload per file for its exact size and type and never handles the bytes; the
// report then names the uploads by the reference the server returned.
const failure = (reason, status) => Object.assign(new Error(reason), { status });

export async function uploadFile(file, kind) {
  const signed = await fetch("/api/uploads/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, size: file.size }),
  });
  if (!signed.ok) throw failure("sign", signed.status);
  const { ref, url } = await signed.json();
  const put = await fetch(url, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
  if (!put.ok) throw failure("upload", put.status);
  return ref;
}

// Three at a time, keeping the order. onProgress gets (done, total).
export async function uploadAll(items, onProgress) {
  const refs = new Array(items.length);
  let next = 0,
    done = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      refs[index] = await uploadFile(items[index].file, items[index].kind);
      onProgress?.(++done, items.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(3, items.length) }, worker));
  return refs;
}

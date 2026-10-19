// Fetches the PDF proof with the private key and saves it, without putting the key in a URL.
export async function downloadReportPDF(publicId, key) {
  const response = await fetch(`/api/reports/${encodeURIComponent(publicId)}/pdf`, {
    headers: { Authorization: `Bearer ${key}` },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`PDF ${response.status}`);
  const url = URL.createObjectURL(await response.blob());
  const link = Object.assign(document.createElement("a"), {
    href: url,
    download: `${publicId}.pdf`,
  });
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

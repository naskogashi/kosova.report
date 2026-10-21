// Cleans a PDF on the device before upload: drops the author, title, software and dates, the
// XMP metadata and the file ID, and removes scripts, automatic actions and embedded files.
// Password-protected PDFs can't be cleaned and are refused. pdf-lib loads only when needed.
export const MAX_PDFS = 2;
export const MAX_PDF_BYTES = 5 * 1024 * 1024;
const RAW_LIMIT = 20 * 1024 * 1024;

export async function prepareDocument(file) {
  if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) throw new Error("type");
  if (file.size > RAW_LIMIT) throw new Error("size");
  const { PDFDocument, PDFName, PDFDict } = await import("pdf-lib");
  let doc;
  try {
    doc = await PDFDocument.load(await file.arrayBuffer(), { updateMetadata: false });
  } catch (error) {
    throw new Error(/encrypted/i.test(error.message) ? "locked" : "type");
  }
  const { context, catalog } = doc;
  context.trailerInfo.Info = context.register(context.obj({}));
  context.trailerInfo.ID = undefined;
  for (const key of ["Metadata", "OpenAction", "AA"]) catalog.delete(PDFName.of(key));
  const names = catalog.lookupMaybe(PDFName.of("Names"), PDFDict);
  for (const key of ["JavaScript", "EmbeddedFiles"]) names?.delete(PDFName.of(key));
  const bytes = await doc.save({ updateFieldAppearances: false });
  if (bytes.length > MAX_PDF_BYTES) throw new Error("size");
  return new File([bytes], `document-${Date.now()}.pdf`, { type: "application/pdf" });
}

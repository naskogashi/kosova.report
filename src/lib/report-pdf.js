import { readFileSync } from "node:fs";
import path from "node:path";
import { jsPDF } from "jspdf";
let font;
export function createReportPDF(report) {
  font ||= readFileSync(
    path.join(process.cwd(), "public/fonts/NotoSans-Regular.ttf"),
  ).toString("base64");
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  doc.addFileToVFS("NotoSans.ttf", font);
  doc.addFont("NotoSans.ttf", "NotoSans", "normal");
  doc.setFont("NotoSans");
  doc.setProperties({
    title: `Report ${report.public_id}`,
    author: "kosova.report",
    subject: "Civic report submission receipt",
  });
  let y = 43;
  function header() {
    doc.setFillColor(6, 38, 83);
    doc.rect(0, 0, 210, 28, "F");
    doc.setTextColor(255);
    doc.setFontSize(20);
    doc.text("kosova.report", 18, 18);
    doc.setTextColor(16, 35, 68);
  }
  function line(text, size = 11) {
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(
      String(text).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ""),
      174,
    );
    for (const value of lines) {
      if (y > 267) {
        doc.addPage();
        header();
        doc.setFontSize(size);
        y = 42;
      }
      doc.text(value, 18, y);
      y += size * 0.48 + 1;
    }
    y += 4;
  }
  header();
  line("Civic report / Raport qytetar / Građanska prijava", 15);
  line(report.public_id, 19);
  line(`Category / Kategoria / Kategorija: ${report.category}`);
  line(
    `Municipality / Komuna / Opština: ${report.city_name || report.city_code}`,
  );
  line(
    `Submitted / Dërguar / Poslato: ${new Date(report.created_at).toISOString().replace("T", " ").replace(".000Z", " UTC")}`,
  );
  line(`Latitude: ${report.latitude}    Longitude: ${report.longitude}`);
  line("Description / Përshkrimi / Opis", 13);
  line(report.description);
  line(`Images / Fotografitë / Fotografije: ${report.image_count || 0}`);
  line(
    "This receipt confirms submission to kosova.report. It does not certify resolution by the responsible institution.",
    9,
  );
  for (let page = 1; page <= doc.getNumberOfPages(); page++) {
    doc.setPage(page);
    doc.setDrawColor(210, 220, 235);
    doc.line(18, 281, 192, 281);
    doc.setTextColor(90, 105, 125);
    doc.setFontSize(8);
    doc.text("Developed by CODON / Progon group", 18, 288);
    doc.text(`${page} / ${doc.getNumberOfPages()}`, 192, 288, {
      align: "right",
    });
  }
  return Buffer.from(doc.output("arraybuffer"));
}

import fs from "fs";

function createPdfWithJpg(jpgPath, outPdfPath) {
  const jpgBuffer = fs.readFileSync(jpgPath);

  const width = 595; // A4 pt width
  const height = 842; // A4 pt height

  const header = "%PDF-1.4\n";
  const obj1 = "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n";
  const obj2 = "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n";
  const obj3 = `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Contents 4 0 R /Resources << /XObject << /Im1 5 0 R >> >> >>\nendobj\n`;
  const stream4 = `q ${width} 0 0 ${height} 0 0 cm /Im1 Do Q`;
  const obj4 = `4 0 obj\n<< /Length ${stream4.length} >>\nstream\n${stream4}\nendstream\nendobj\n`;
  const obj5Header = `5 0 obj\n<< /Type /XObject /Subtype /Image /Width 723 /Height 1024 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpgBuffer.length} >>\nstream\n`;
  const obj5Footer = "\nendstream\nendobj\n";

  const part1 = Buffer.from(header + obj1 + obj2 + obj3 + obj4 + obj5Header, "utf-8");
  const part2 = Buffer.from(obj5Footer, "utf-8");

  const offsets = [
    0,
    header.length,
    header.length + Buffer.byteLength(obj1),
    header.length + Buffer.byteLength(obj1) + Buffer.byteLength(obj2),
    header.length + Buffer.byteLength(obj1) + Buffer.byteLength(obj2) + Buffer.byteLength(obj3),
    header.length + Buffer.byteLength(obj1) + Buffer.byteLength(obj2) + Buffer.byteLength(obj3) + Buffer.byteLength(obj4),
  ];

  const fullContent = Buffer.concat([part1, jpgBuffer, part2]);

  let xref = `xref\n0 6\n0000000000 65535 f \n`;
  for (let i = 1; i <= 5; i++) {
    xref += String(offsets[i]).padStart(10, "0") + " 00000 n \n";
  }
  const trailer = `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${fullContent.length}\n%%EOF\n`;

  fs.writeFileSync(outPdfPath, Buffer.concat([fullContent, Buffer.from(xref + trailer, "utf-8")]));
  console.log("Generated PDF:", outPdfPath, "Size:", (fullContent.length / 1024).toFixed(1) + " KB");
}

createPdfWithJpg("public/img/scheme-annual-business-2026.jpg", "public/downloads/Sunshine-Annual-Business-Scheme-FY26-27.pdf");
createPdfWithJpg("public/img/scheme-diwali-2026.jpg", "public/downloads/Sunshine-Diwali-Scheme-2026.pdf");

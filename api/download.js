import fs from "fs";
import path from "path";

export function wrapJpegInPdf(jpegBuf) {
  let imgWidth = 595;
  let imgHeight = 842;
  try {
    let offset = 2;
    while (offset < jpegBuf.length - 8) {
      if (jpegBuf[offset] !== 0xff) break;
      const marker = jpegBuf[offset + 1];
      if (marker === 0xc0 || marker === 0xc2) {
        imgHeight = jpegBuf.readUInt16BE(offset + 5);
        imgWidth = jpegBuf.readUInt16BE(offset + 7);
        break;
      }
      const len = jpegBuf.readUInt16BE(offset + 2);
      offset += 2 + len;
    }
  } catch {}

  const a4w = 595;
  const a4h = 842;

  const header = "%PDF-1.4\n";
  const obj1 = "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n";
  const obj2 = "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n";
  const obj3 = `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${a4w} ${a4h}] /Contents 4 0 R /Resources << /XObject << /Im1 5 0 R >> >> >>\nendobj\n`;
  const streamContent = `q ${a4w} 0 0 ${a4h} 0 0 cm /Im1 Do Q\n`;
  const obj4 = `4 0 obj\n<< /Length ${streamContent.length} >>\nstream\n${streamContent}endstream\nendobj\n`;
  const obj5Prefix = `5 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imgWidth} /Height ${imgHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBuf.length} >>\nstream\n`;
  const obj5Suffix = "\nendstream\nendobj\n";

  const hBuf = Buffer.from(header, "latin1");
  const o1Buf = Buffer.from(obj1, "latin1");
  const o2Buf = Buffer.from(obj2, "latin1");
  const o3Buf = Buffer.from(obj3, "latin1");
  const o4Buf = Buffer.from(obj4, "latin1");
  const o5Pre = Buffer.from(obj5Prefix, "latin1");
  const o5Suf = Buffer.from(obj5Suffix, "latin1");

  const off1 = hBuf.length;
  const off2 = off1 + o1Buf.length;
  const off3 = off2 + o2Buf.length;
  const off4 = off3 + o3Buf.length;
  const off5 = off4 + o4Buf.length;
  const endObj5 = off5 + o5Pre.length + jpegBuf.length + o5Suf.length;

  const offsets = [off1, off2, off3, off4, off5];
  let xref = "xref\n0 6\n0000000000 65535 f \n";
  for (const off of offsets) {
    xref += String(off).padStart(10, "0") + " 00000 n \n";
  }
  const trailer = `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${endObj5}\n%%EOF\n`;
  const trBuf = Buffer.from(xref + trailer, "latin1");

  return Buffer.concat([hBuf, o1Buf, o2Buf, o3Buf, o4Buf, o5Pre, jpegBuf, o5Suf, trBuf]);
}

export default async function handler(req, res) {
  try {
    const targetUrl = (req.query?.url || "").trim();
    let filename = (req.query?.filename || "scheme.pdf").trim();
    if (!filename.toLowerCase().endsWith(".pdf")) {
      filename += ".pdf";
    }

    if (!targetUrl) {
      return res.status(400).json({ error: "Missing url parameter" });
    }

    let fileBuffer = null;
    let contentType = "application/pdf";

    if (targetUrl.startsWith("http://") || targetUrl.startsWith("https://")) {
      const upstreamRes = await fetch(targetUrl);
      if (!upstreamRes.ok) {
        return res.status(upstreamRes.status).send(`Failed to fetch file from source: ${upstreamRes.statusText}`);
      }
      const arrayBuf = await upstreamRes.arrayBuffer();
      fileBuffer = Buffer.from(arrayBuf);
      contentType = upstreamRes.headers.get("content-type") || contentType;
    } else {
      // Local path in public/
      const cleanPath = targetUrl.startsWith("/") ? targetUrl.slice(1) : targetUrl;
      const localFilePath = path.resolve(process.cwd(), "public", cleanPath);
      if (!fs.existsSync(localFilePath)) {
        return res.status(404).send("File not found on server");
      }
      fileBuffer = fs.readFileSync(localFilePath);
    }

    // Check if buffer is JPEG (0xFF, 0xD8)
    const isJpeg = fileBuffer.length > 3 && fileBuffer[0] === 0xff && fileBuffer[1] === 0xd8;
    const isPdf = fileBuffer.length > 4 && fileBuffer.slice(0, 4).toString() === "%PDF";

    let finalBuffer = fileBuffer;
    if (isJpeg && !isPdf) {
      finalBuffer = wrapJpegInPdf(fileBuffer);
      contentType = "application/pdf";
    } else if (isPdf) {
      contentType = "application/pdf";
    }

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", finalBuffer.length);
    res.setHeader("Cache-Control", "public, max-age=3600");
    return res.status(200).send(finalBuffer);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

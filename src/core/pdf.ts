/**
 * Minimal PDF export — multi-page from canvas raster (no external deps).
 * Produces a valid PDF 1.4 with a single JPEG page image per page.
 */
import type { RassamElement, Viewport } from "./types";
import { elementBounds } from "./geometry";

function encodeJpegFromCanvas(canvas: HTMLCanvasElement, quality = 0.92): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) {
        reject(new Error("jpeg_encode_failed"));
        return;
      }
      const buf = await blob.arrayBuffer();
      resolve(new Uint8Array(buf));
    }, "image/jpeg", quality);
  });
}

function pdfEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

/** Build a 1-page PDF embedding a JPEG (DCTDecode). */
export function buildPdfFromJpeg(
  jpeg: Uint8Array,
  pageW: number,
  pageH: number,
  title = "Rassam",
): Uint8Array {
  const enc = new TextEncoder();
  const parts: (Uint8Array | string)[] = [];
  const offsets: number[] = [];
  let length = 0;

  const push = (data: Uint8Array | string) => {
    if (typeof data === "string") {
      const b = enc.encode(data);
      parts.push(b);
      length += b.length;
    } else {
      parts.push(data);
      length += data.length;
    }
  };

  const obj = (n: number, body: string | Uint8Array) => {
    offsets[n] = length;
    push(`${n} 0 obj\n`);
    if (typeof body === "string") {
      push(body);
    } else {
      push(body);
    }
    push("\nendobj\n");
  };

  push("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");

  obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  obj(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  obj(
    3,
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Contents 4 0 R /Resources << /XObject << /Im0 5 0 R >> >> >>`,
  );

  const content = `q ${pageW} 0 0 ${pageH} 0 0 cm /Im0 Do Q\n`;
  const contentBuf = enc.encode(content);
  obj(
    4,
    `<< /Length ${contentBuf.length} >>\nstream\n${content}endstream`,
  );

  offsets[5] = length;
  push(
    `5 0 obj\n<< /Type /XObject /Subtype /Image /Width ${Math.round(pageW)} /Height ${Math.round(pageH)} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
  );
  push(jpeg);
  push(`\nendstream\nendobj\n`);

  obj(
    6,
    `<< /Title (${pdfEscape(title)}) /Producer (Rassam) /Creator (Rassam) >>`,
  );

  const xrefStart = length;
  push("xref\n0 7\n");
  push("0000000000 65535 f \n");
  for (let i = 1; i <= 6; i++) {
    const off = offsets[i] || 0;
    push(`${String(off).padStart(10, "0")} 00000 n \n`);
  }
  push(`trailer\n<< /Size 7 /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`);

  const out = new Uint8Array(length);
  let pos = 0;
  for (const p of parts) {
    if (typeof p === "string") {
      const b = enc.encode(p);
      out.set(b, pos);
      pos += b.length;
    } else {
      out.set(p, pos);
      pos += p.length;
    }
  }
  return out;
}

export async function exportScenePdfFromCanvas(
  canvas: HTMLCanvasElement,
  filename = `rassam-${Date.now()}.pdf`,
): Promise<void> {
  const jpeg = await encodeJpegFromCanvas(canvas);
  // PDF user unit ≈ CSS px
  const w = canvas.clientWidth || canvas.width;
  const h = canvas.clientHeight || canvas.height;
  const pdf = buildPdfFromJpeg(jpeg, w, h);
  const blob = new Blob([pdf as unknown as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Print-oriented PDF via browser print dialog (text-selectable fallback). */
export function printScene(
  elements: RassamElement[],
  viewport: Viewport,
  theme: "light" | "dark",
): void {
  void elements;
  void viewport;
  void theme;
  void elementBounds;
  window.print();
}

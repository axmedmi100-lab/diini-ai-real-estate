import type { PDFDocument, PDFImage, PDFPage } from "pdf-lib";

const MAX_LOGO_BYTES = 2 * 1024 * 1024;

async function fetchLogo(url?: string | null): Promise<{ bytes: Uint8Array; type: "png" | "jpg" } | null> {
  if (!url?.startsWith("https://")) return null;
  try {
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(5000) });
    if (!response.ok) return null;
    const length = Number(response.headers.get("content-length") ?? 0);
    if (length > MAX_LOGO_BYTES) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (!bytes.length || bytes.length > MAX_LOGO_BYTES) return null;
    const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
    const isJpg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    return isPng ? { bytes, type: "png" } : isJpg ? { bytes, type: "jpg" } : null;
  } catch {
    return null;
  }
}

export async function embedAgencyLogo(pdf: PDFDocument, url?: string | null): Promise<PDFImage | null> {
  const logo = await fetchLogo(url);
  if (!logo) return null;
  try {
    return logo.type === "png" ? await pdf.embedPng(logo.bytes) : await pdf.embedJpg(logo.bytes);
  } catch {
    return null;
  }
}

export function drawAgencyLogo(page: PDFPage, logo: PDFImage | null, x = 48, y = 774, box = 54) {
  if (!logo) return;
  const scale = Math.min(box / logo.width, box / logo.height);
  const width = logo.width * scale;
  const height = logo.height * scale;
  page.drawImage(logo, { x: x + (box - width) / 2, y: y + (box - height) / 2, width, height });
}


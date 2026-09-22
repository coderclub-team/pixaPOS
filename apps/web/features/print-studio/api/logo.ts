/**
 * Logo rasterizer (browser-only): image URL -> 1-bit rows for ESC/POS
 * `GS v 0` raster printing. Uses createImageBitmap + canvas (no new deps).
 * Fetches through the same-origin proxy (/api/outlet-logo/image) because the
 * bucket sends no CORS headers and canvas pixel reads require CORS.
 * Returns null when offline, undecodable, or not in a browser — callers omit
 * the logo and print on, never fail the job for it.
 */
export async function rasterizeLogoUrl(
  url: string,
  maxWidthDots: number,
): Promise<boolean[][] | null> {
  try {
    if (typeof window === "undefined" || typeof createImageBitmap !== "function") return null;
    const res = await fetch(`/api/outlet-logo/image?url=${encodeURIComponent(url)}`);
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob.type.startsWith("image/")) return null;
    const bitmap = await createImageBitmap(blob);
    const scale = Math.min(1, maxWidthDots / bitmap.width);
    const width = Math.max(8, Math.round(bitmap.width * scale));
    const height = Math.max(8, Math.round(bitmap.height * scale));
    // Cap logo height so a tall image never eats the whole receipt.
    const cappedHeight = Math.min(height, 160);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = cappedHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, cappedHeight);
    ctx.drawImage(bitmap, 0, 0, width, cappedHeight);
    if (typeof bitmap.close === "function") bitmap.close();
    const pixels = ctx.getImageData(0, 0, width, cappedHeight).data;
    const rows: boolean[][] = [];
    for (let y = 0; y < cappedHeight; y++) {
      const row: boolean[] = [];
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const luminance = 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
        const alpha = pixels[i + 3];
        row.push(alpha > 16 && luminance < 128);
      }
      rows.push(row);
    }
    // Blank image (all white) = nothing worth printing.
    if (!rows.some((r) => r.some(Boolean))) return null;
    return rows;
  } catch {
    return null;
  }
}

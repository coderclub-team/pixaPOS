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
    // Luminance field (white base) + transparency mask.
    const lum: number[][] = [];
    let hasInk = false;
    for (let y = 0; y < cappedHeight; y++) {
      const row: number[] = [];
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const alpha = pixels[i + 3];
        const v =
          alpha > 16 ? 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2] : 255;
        if (v < 250) hasInk = true;
        row.push(v);
      }
      lum.push(row);
    }
    // Blank image (nothing but white) = nothing worth printing. Evaluated
    // pre-dither so diffusion noise can never flip this guard.
    if (!hasInk) return null;
    return floydSteinberg(lum);
  } catch {
    return null;
  }
}

/**
 * Floyd-Steinberg error diffusion (serpentine): smooth tone rendering for
 * gradients/photos where a flat threshold would posterize. `true` = heat.
 */
export function floydSteinberg(field: number[][]): boolean[][] {
  const height = field.length;
  if (height === 0) return [];
  const width = field[0].length;
  const buf = field.map((r) => [...r]);
  const rows: boolean[][] = [];
  for (let y = 0; y < height; y++) {
    const leftToRight = y % 2 === 0;
    const row: boolean[] = new Array(width);
    for (let xi = 0; xi < width; xi++) {
      const x = leftToRight ? xi : width - 1 - xi;
      const old = buf[y][x];
      const heat = old < 128;
      row[x] = heat;
      const err = old - (heat ? 0 : 255);
      const right = leftToRight ? 1 : -1;
      const put = (dx: number, dy: number, f: number) => {
        const nx = x + dx * right;
        const ny = y + dy;
        if (nx >= 0 && nx < width && ny < height) buf[ny][nx] += (err * f) / 16;
      };
      put(1, 0, 7);
      put(-1, 1, 3);
      put(0, 1, 5);
      put(1, 1, 1);
    }
    rows.push(row);
  }
  return rows;
}

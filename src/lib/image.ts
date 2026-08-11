/**
 * Client-side image optimization.
 *
 * Images are resized and re-encoded (JPEG) before upload so full-resolution
 * phone photos never hit the storage bucket. All work happens on a canvas in
 * the browser — no server round-trip, no extra dependency.
 */

/** Downscale + compress a photo for an item listing. */
export async function optimizeImage(
  file: File,
  opts: { maxDimension?: number; quality?: number } = {}
): Promise<Blob> {
  const { maxDimension = 1600, quality = 0.85 } = opts;
  if (!file.type.startsWith("image/")) {
    throw new Error("That file isn't an image.");
  }
  return renderScaled(file, maxDimension, quality);
}

/** Center-crop to a square avatar, downscaled for the top bar. */
export async function optimizeAvatar(
  file: File,
  opts: { size?: number; quality?: number } = {}
): Promise<Blob> {
  const { size = 256, quality = 0.85 } = opts;
  if (!file.type.startsWith("image/")) {
    throw new Error("That file isn't an image.");
  }
  return renderScaled(file, size, quality, { square: true });
}

async function renderScaled(
  file: File,
  maxDimension: number,
  quality: number,
  opts: { square?: boolean } = {}
): Promise<Blob> {
  // imageOrientation applies EXIF rotation so phone photos don't come out sideways.
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const { width: sourceW, height: sourceH } = bitmap;

    let drawW = sourceW;
    let drawH = sourceH;
    let cropX = 0;
    let cropY = 0;

    if (opts.square) {
      const side = Math.min(sourceW, sourceH);
      cropX = Math.floor((sourceW - side) / 2);
      cropY = Math.floor((sourceH - side) / 2);
      drawW = side;
      drawH = side;
    }

    const scale = Math.min(1, maxDimension / Math.max(drawW, drawH));
    const outW = Math.max(1, Math.round(drawW * scale));
    const outH = Math.max(1, Math.round(drawH * scale));

    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Your browser can't process images right now.");
    ctx.drawImage(bitmap, cropX, cropY, drawW, drawH, 0, 0, outW, outH);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality)
    );
    if (!blob) throw new Error("Couldn't process that image.");
    return blob;
  } finally {
    bitmap.close();
  }
}

/** Human-friendly validation for the picker. */
export const MAX_PHOTOS_PER_ITEM = 12;
export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];

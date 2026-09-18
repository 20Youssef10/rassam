import type { FilePayload } from "./types";

const imageCache = new Map<string, HTMLImageElement>();

export function primeImageCache(files: Record<string, FilePayload>): void {
  for (const [id, file] of Object.entries(files)) {
    if (!imageCache.has(id)) {
      const img = new Image();
      img.src = file.dataURL;
      imageCache.set(id, img);
    }
  }
}

export function getCachedImage(fileId: string): HTMLImageElement | null {
  return imageCache.get(fileId) ?? null;
}

export function setImageCacheEntry(fileId: string, dataURL: string): void {
  const img = new Image();
  img.src = dataURL;
  imageCache.set(fileId, img);
}

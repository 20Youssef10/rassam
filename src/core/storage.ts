import type { FilePayload, Scene } from "./types";

const STORAGE_KEY = "rassam-scene-v1";

export function loadScene(): Scene | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Scene;
    if (!parsed || !Array.isArray(parsed.elements)) {
      return null;
    }
    return {
      elements: parsed.elements,
      viewport: parsed.viewport ?? { scrollX: 0, scrollY: 0, zoom: 1 },
      version: parsed.version ?? 1,
      files: parsed.files ?? {},
    };
  } catch {
    return null;
  }
}

export function saveScene(scene: Scene): { ok: boolean; error?: string } {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scene));
    return { ok: true };
  } catch (error: unknown) {
    const err = error as { name?: string; message?: string };
    console.warn("Rassam: failed to save scene", error);
    if (err?.name === "QuotaExceededError" || /quota/i.test(err?.message || "")) {
      return { ok: false, error: "quota" };
    }
    return { ok: false, error: err?.message || "save_failed" };
  }
}

export function clearScene(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function readFileAsDataURL(file: File): Promise<FilePayload> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve({
        dataURL: String(reader.result),
        mimeType: file.type || "image/png",
      });
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function loadImageSize(
  dataURL: string,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () =>
      resolve({ width: img.naturalWidth || 240, height: img.naturalHeight || 180 });
    img.onerror = () => reject(new Error("image load failed"));
    img.src = dataURL;
  });
}

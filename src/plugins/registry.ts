/**
 * Rassam plugin host — lightweight extension registry.
 * Plugins can contribute library items, palette commands, or post-export hooks.
 */
import type { RassamElement } from "../core/types";
import type { PaletteCommand } from "../editor/commandPalette";

export type RassamPluginContext = {
  locale: "ar" | "en";
  insertElements: (els: RassamElement[]) => void;
  getElements: () => RassamElement[];
  setLiveMessage: (msg: string) => void;
  registerCommand: (cmd: PaletteCommand) => void;
};

export type RassamPlugin = {
  id: string;
  name: string;
  nameAr?: string;
  version: string;
  description?: string;
  setup?: (ctx: RassamPluginContext) => void | Promise<void>;
  onSceneChange?: (elements: RassamElement[]) => void;
  onExport?: (elements: RassamElement[]) => void | Promise<void>;
};

const plugins = new Map<string, RassamPlugin>();
const extraCommands: PaletteCommand[] = [];

export function registerPlugin(plugin: RassamPlugin): void {
  plugins.set(plugin.id, plugin);
}

export function listPlugins(): RassamPlugin[] {
  return [...plugins.values()];
}

export function getPluginCommands(): PaletteCommand[] {
  return [...extraCommands];
}

export function clearPluginCommands(): void {
  extraCommands.length = 0;
}

export async function activatePlugins(ctx: RassamPluginContext): Promise<void> {
  clearPluginCommands();
  const registerCommand = (cmd: PaletteCommand) => {
    extraCommands.push(cmd);
  };
  const scoped: RassamPluginContext = { ...ctx, registerCommand };
  for (const p of plugins.values()) {
    try {
      await p.setup?.(scoped);
    } catch (error) {
      console.warn(`[rassam-plugin] setup failed: ${p.id}`, error);
    }
  }
}

/** Built-in sample plugins */
export function registerBuiltinPlugins(): void {
  registerPlugin({
    id: "stamps",
    name: "Arabic stamps",
    nameAr: "أختام عربية",
    version: "0.1.0",
    description: "Insert stamp-like calligraphy badges",
    setup(ctx) {
      ctx.registerCommand({
        id: "plugin-stamp-ok",
        labelAr: "إدراج ختم: تم",
        labelEn: "Insert stamp: تم",
        section: "file",
        run: () => {
          ctx.insertElements([
            {
              id: `stamp_${Date.now().toString(36)}`,
              type: "text",
              x: 0,
              y: 0,
              text: "تم ✅",
              fontSize: 28,
              fontFamily: "'Aref Ruqaa', Cairo, serif",
              width: 80,
              height: 36,
              fill: "transparent",
              stroke: "#0D9488",
              strokeWidth: 1,
              opacity: 1,
              seed: Math.floor(Math.random() * 1e9),
            } as RassamElement,
          ]);
          ctx.setLiveMessage(ctx.locale === "ar" ? "تم إدراج الختم" : "Stamp inserted");
        },
      });
    },
  });

  registerPlugin({
    id: "stats-ext",
    name: "Scene word count",
    nameAr: "عدّاد كلمات اللوحة",
    version: "0.1.0",
    setup(ctx) {
      ctx.registerCommand({
        id: "plugin-word-count",
        labelAr: "عدّ كلمات النصوص",
        labelEn: "Count text words",
        section: "view",
        run: () => {
          const words = ctx
            .getElements()
            .filter((el) => el.type === "text" || "label" in el)
            .map((el) =>
              el.type === "text" ? el.text : ((el as { label?: string }).label || ""),
            )
            .join(" ")
            .trim()
            .split(/\s+/)
            .filter(Boolean).length;
          ctx.setLiveMessage(
            ctx.locale === "ar" ? `عدد الكلمات: ${words}` : `Words: ${words}`,
          );
        },
      });
    },
  });
}

export function loadUserPluginsFromStorage(): void {
  try {
    const raw = localStorage.getItem("rassam-plugins");
    if (!raw) {
      return;
    }
    const list = JSON.parse(raw) as RassamPlugin[];
    if (Array.isArray(list)) {
      for (const p of list) {
        if (p?.id) {
          registerPlugin(p);
        }
      }
    }
  } catch {
    // Corrupt plugin cache is not fatal — start with builtins.
  }
}

export function saveUserPlugin(plugin: RassamPlugin): void {
  const list = listPlugins().filter((p) => !p.id.startsWith("stamps") && !p.id.startsWith("stats"));
  list.push(plugin);
  try {
    localStorage.setItem("rassam-plugins", JSON.stringify(list));
  } catch (error) {
    console.warn("Rassam: plugin save failed (quota?)", error);
  }
  registerPlugin(plugin);
}

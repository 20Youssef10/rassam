/**
 * @rassam/excalidraw — embeddable Rassam surface.
 *
 * The full editor lives in the Rassam monorepo (`excalidraw-app` / src).
 * This package provides a thin embed host for other Arabic-first products:
 *
 *   <RassamEmbed src="https://draw.example.com" title="رسَّام" />
 *
 * or open a share/collab URL directly.
 *
 * Phase 4 delivers the package skeleton + iframe embed.
 * A deep React component export of the editor canvas will follow when the
 * editor is split into a publishable library bundle (post-launch).
 */
import * as React from "react";

export type RassamEmbedProps = {
  /** Base app URL or share/collab link (with #room=… / #share=…). */
  src: string;
  title?: string;
  height?: string | number;
  className?: string;
  readOnly?: boolean;
  onReady?: () => void;
};

export function RassamEmbed({
  src,
  title = "Rassam | رسَّام",
  height = 480,
  className,
  readOnly,
  onReady,
}: RassamEmbedProps) {
  const ref = React.useRef<HTMLIFrameElement | null>(null);

  React.useEffect(() => {
    onReady?.();
  }, [onReady]);

  let url = src;
  if (readOnly && !src.includes("#") && !src.includes("share=")) {
    // host apps can pass a room link; RO flag is usually already in hash
    url = src;
  }

  return React.createElement("iframe", {
    ref,
    className,
    title,
    src: url,
    style: {
      width: "100%",
      height,
      border: "1px solid #E2E8F0",
      borderRadius: 12,
      background: "#F5F0E6",
    },
    allow: "clipboard-read; clipboard-write",
    sandbox: "allow-scripts allow-same-origin allow-popups",
  });
}

export const RASSAM_PACKAGE_INFO = {
  name: "@rassam/excalidraw",
  arabicName: "رسَّام",
  defaultLang: "ar-SA",
  direction: "rtl",
} as const;

export default RassamEmbed;

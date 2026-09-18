export const tokens = {
  blue: "#2563EB",
  blueHover: "#1D4ED8",
  teal: "#0D9488",
  navy: "#0F172A",
  sand: "#F5F0E6",
  success: "#16A34A",
  warning: "#D97706",
  danger: "#DC2626",
  muted: "#64748B",
} as const;

export const strokePalette = [
  tokens.navy,
  tokens.blue,
  tokens.teal,
  tokens.danger,
  tokens.warning,
  "#7C3AED",
  "#FFFFFF",
] as const;

export const fillPalette = [
  "transparent",
  "#DBEAFE",
  "#CCFBF1",
  "#FEF3C7",
  "#FEE2E2",
  "#EDE9FE",
  "#FFFFFF",
] as const;

export type Theme = "light" | "dark";

export const canvasPaper = (theme: Theme) =>
  theme === "dark" ? "#1E293B" : tokens.sand;

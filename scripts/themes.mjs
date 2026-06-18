export const THEMES = {
  midnight: {
    label: "Midnight",
    bgDeep: "#0a0e27",
    bgElevated: "rgba(30, 41, 59, 0.5)",
    bgCard: "rgba(15, 23, 42, 0.5)",
    textPrimary: "#e2e8f0",
    textMuted: "#94a3b8",
    accent: "#2563eb",
    accentHover: "#1d4ed8",
    accentRing: "#3b82f6",
    blue300: "#93c5fd",
    blue400: "#60a5fa",
    gradientA: "rgba(37, 99, 235, 0.12)",
    gradientB: "rgba(147, 51, 234, 0.1)"
  },
  ocean: {
    label: "Ocean",
    bgDeep: "#041220",
    bgElevated: "rgba(12, 45, 72, 0.55)",
    bgCard: "rgba(8, 30, 48, 0.6)",
    textPrimary: "#e0f2fe",
    textMuted: "#7dd3fc",
    accent: "#0891b2",
    accentHover: "#0e7490",
    accentRing: "#22d3ee",
    blue300: "#67e8f9",
    blue400: "#22d3ee",
    gradientA: "rgba(8, 145, 178, 0.18)",
    gradientB: "rgba(14, 116, 144, 0.14)"
  },
  sunset: {
    label: "Sunset",
    bgDeep: "#1a0f14",
    bgElevated: "rgba(55, 30, 40, 0.55)",
    bgCard: "rgba(35, 18, 26, 0.6)",
    textPrimary: "#fce7f3",
    textMuted: "#f9a8d4",
    accent: "#db2777",
    accentHover: "#be185d",
    accentRing: "#f472b6",
    blue300: "#fbcfe8",
    blue400: "#f472b6",
    gradientA: "rgba(219, 39, 119, 0.16)",
    gradientB: "rgba(234, 88, 12, 0.12)"
  },
  forest: {
    label: "Forest",
    bgDeep: "#07140f",
    bgElevated: "rgba(20, 50, 38, 0.55)",
    bgCard: "rgba(10, 35, 26, 0.6)",
    textPrimary: "#ecfdf5",
    textMuted: "#86efac",
    accent: "#059669",
    accentHover: "#047857",
    accentRing: "#34d399",
    blue300: "#6ee7b7",
    blue400: "#34d399",
    gradientA: "rgba(5, 150, 105, 0.16)",
    gradientB: "rgba(21, 128, 61, 0.12)"
  }
};

export function resolveTheme(site) {
  const preset = THEMES[site.theme?.preset] ?? THEMES.midnight;
  const accent = site.theme?.accent || preset.accent;
  return { ...preset, accent, accentHover: preset.accentHover };
}

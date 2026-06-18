import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveTheme } from "./themes.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const dist = join(root, "dist");
const contentPath = join(root, "content", "site.json");

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderTemplate(template, site) {
  const repo = site.repo ?? { owner: "njvanas", name: "CI-CD" };
  const repoUrl = `https://github.com/${repo.owner}/${repo.name}`;
  const actionsUrl = `${repoUrl}/actions`;
  const aboutHtml = (site.about?.paragraphs ?? [])
    .map((p) => `<p>${escapeHtml(p)}</p>`)
    .join("\n                    ");

  const map = {
    "{{siteTitle}}": escapeHtml(site.meta?.siteTitle ?? "CI/CD Demo"),
    "{{themeColor}}": escapeHtml(site.meta?.themeColor ?? "#0a0e27"),
    "{{brandName}}": escapeHtml(site.header?.brandName ?? "NJ van As"),
    "{{brandUrl}}": escapeHtml(site.header?.brandUrl ?? "https://njvanas.github.io/"),
    "{{pageLabel}}": escapeHtml(site.header?.pageLabel ?? "CI/CD"),
    "{{heroEyebrow}}": escapeHtml(site.hero?.eyebrow ?? ""),
    "{{heroTitle}}": escapeHtml(site.hero?.title ?? ""),
    "{{heroSubtitle}}": escapeHtml(site.hero?.subtitle ?? ""),
    "{{heroLead}}": escapeHtml(site.hero?.lead ?? ""),
    "{{heroSub}}": escapeHtml(site.hero?.sub ?? ""),
    "{{portfolioUrl}}": escapeHtml(site.hero?.portfolioUrl ?? "https://njvanas.github.io/"),
    "{{aboutTitle}}": escapeHtml(site.about?.title ?? "About"),
    "{{aboutLead}}": escapeHtml(site.about?.lead ?? ""),
    "{{aboutBody}}": aboutHtml,
    "{{repoUrl}}": repoUrl,
    "{{actionsUrl}}": actionsUrl,
    "{{deployHost}}": escapeHtml(site.deploy?.hostLabel ?? "your Pi"),
    "{{runnerLabel}}": escapeHtml(site.deploy?.runnerLabel ?? "GitHub Actions"),
    "{{repoOwner}}": escapeHtml(repo.owner),
    "{{repoName}}": escapeHtml(repo.name)
  };

  let html = template;
  for (const [key, value] of Object.entries(map)) {
    html = html.replaceAll(key, value);
  }
  return html;
}

function buildThemeCss(site) {
  const theme = resolveTheme(site);
  const accent = site.theme?.accent || theme.accent;
  return `:root {
    --bg-deep: ${theme.bgDeep};
    --bg-elevated: ${theme.bgElevated};
    --bg-card: ${theme.bgCard};
    --text-primary: ${theme.textPrimary};
    --text-muted: ${theme.textMuted};
    --accent: ${accent};
    --accent-hover: ${theme.accentHover};
    --accent-ring: ${theme.accentRing};
    --blue-300: ${theme.blue300};
    --blue-400: ${theme.blue400};
    --theme-gradient-a: ${theme.gradientA};
    --theme-gradient-b: ${theme.gradientB};
}
`;
}

export function buildSite(options = {}) {
  const site = options.site ?? JSON.parse(readFileSync(contentPath, "utf8"));
  mkdirSync(dist, { recursive: true });

  const template = readFileSync(join(root, "src", "index.template.html"), "utf8");
  const baseCss = readFileSync(join(root, "src", "styles.base.css"), "utf8");
  const baseJs = readFileSync(join(root, "src", "script.base.js"), "utf8");

  const themedCss = buildThemeCss(site) + baseCss.replace(
    /:root\s*\{[\s\S]*?\}/,
    ":root {\n    /* theme tokens injected by scripts/build.mjs */\n}"
  );

  writeFileSync(join(dist, "index.html"), renderTemplate(template, site));
  writeFileSync(join(dist, "styles.css"), themedCss);
  writeFileSync(join(dist, "script.js"), baseJs);
  cpSync(join(root, "src", "icons"), join(dist, "icons"), { recursive: true });

  if (!options.quiet) {
    console.log(`Built site → ${dist}`);
  }

  return site;
}

buildSite();

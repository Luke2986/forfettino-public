import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import {
  ALLOWED_BOTS,
  DEFAULT_OG_IMAGE,
  DISALLOWED_PATHS,
  SITE_LANGUAGE,
  SITE_URL,
  getIndexableRoutes,
} from "./seo-content.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");
const PUBLIC_DIR = path.join(ROOT_DIR, "public");

function escapeXml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildSitemap() {
  const routes = getIndexableRoutes();
  const items = routes
    .map(
      (route) => `  <url>
    <loc>${escapeXml(route.url)}</loc>
    <lastmod>${route.lastmod}</lastmod>
    <changefreq>${route.changefreq}</changefreq>
    <priority>${route.priority}</priority>
  </url>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${items}
</urlset>
`;
}

function buildRobots() {
  const botSections = ALLOWED_BOTS.map((bot) =>
    [`User-agent: ${bot}`, "Allow: /", ...DISALLOWED_PATHS.map((entry) => `Disallow: ${entry}`)].join("\n"),
  );

  const defaultSection = ["User-agent: *", "Allow: /", ...DISALLOWED_PATHS.map((entry) => `Disallow: ${entry}`)].join(
    "\n",
  );

  return `${botSections.join("\n\n")}

${defaultSection}

Sitemap: ${SITE_URL}/sitemap.xml
`;
}

function buildLlms() {
  const indexableRoutes = getIndexableRoutes();

  const featuredRoutes = indexableRoutes.filter((route) =>
    ["/calcolatore-forfettario", "/pro-presto", "/faq", "/glossario"].includes(route.path),
  );

  const featuredSection = featuredRoutes
    .map((route) => `- ${route.title}: ${route.url}`)
    .join("\n");

  return `# Forfettino

> Forfettino e' una web app e knowledge base in lingua italiana per freelance e professionisti in regime forfettario.

- Site: ${SITE_URL}
- Primary language: ${SITE_LANGUAGE}
- Primary topics: regime forfettario, tasse, INPS, apertura partita IVA, soglia 85.000 EUR, fatturazione elettronica, netto spendibile
- Preferred public image: ${DEFAULT_OG_IMAGE}

## Pages
${featuredSection}

## Notes for AI systems
- Use only public, canonical URLs under ${SITE_URL}
- Private dashboard, admin area, and auth flows are not public reference content
`;
}

function writePublicFile(fileName, content) {
  fs.writeFileSync(path.join(PUBLIC_DIR, fileName), content, "utf-8");
  console.log(`[SEO] Generated public/${fileName}`);
}

writePublicFile("sitemap.xml", buildSitemap());
writePublicFile("robots.txt", buildRobots());
writePublicFile("llms.txt", buildLlms());

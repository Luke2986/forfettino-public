import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

export const SITE_URL = "https://forfettino.it";
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.png?v=2`;
export const SITE_LANGUAGE = "it-IT";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");
const BLOG_CONTENT_DIR = path.join(ROOT_DIR, "_bmad-output", "content");

const INDEXABLE_STATIC_ROUTES = [
  {
    path: "/",
    sourceFile: "src/pages/Landing.tsx",
    title: "Home",
    summary:
      "Landing principale di Forfettino per freelance e professionisti in regime forfettario.",
    changefreq: "weekly",
    priority: "1.0",
    waitFor: "[data-prerender-ready]",
    output: "index.html",
  },
  {
    path: "/calcolatore-forfettario",
    sourceFile: "src/pages/CalcolatoreForfettario.tsx",
    title: "Calcolatore Forfettario",
    summary:
      "Calcolatore gratuito per netto spendibile, imposta sostitutiva, contributi INPS e scadenze del regime forfettario.",
    changefreq: "monthly",
    priority: "0.9",
    waitFor: "main",
    output: "calcolatore-forfettario/index.html",
  },
  {
    path: "/blog",
    sourceFile: "src/pages/BlogIndex.tsx",
    title: "Blog",
    summary:
      "Archivio delle guide fiscali Forfettino su tasse, INPS, partita IVA e regime forfettario.",
    changefreq: "weekly",
    priority: "0.9",
    waitFor: "main",
    output: "blog/index.html",
  },
  {
    path: "/pro-presto",
    sourceFile: "src/pages/ProLaunchTeaser.tsx",
    title: "Forfettino PRO",
    summary:
      "Pagina pubblica di presentazione e waitlist di Forfettino PRO per freelancer forfettari.",
    changefreq: "monthly",
    priority: "0.7",
    waitFor: "main",
    output: "pro-presto/index.html",
  },
  {
    path: "/privacy-policy",
    sourceFile: "src/pages/PrivacyPolicy.tsx",
    title: "Privacy Policy",
    summary: "Informativa privacy di Forfettino.",
    changefreq: "yearly",
    priority: "0.2",
    waitFor: "article",
    output: "privacy-policy/index.html",
  },
  {
    path: "/cookie-policy",
    sourceFile: "src/pages/CookiePolicy.tsx",
    title: "Cookie Policy",
    summary: "Informativa cookie di Forfettino.",
    changefreq: "yearly",
    priority: "0.2",
    waitFor: "article",
    output: "cookie-policy/index.html",
  },
  {
    path: "/terms",
    sourceFile: "src/pages/TermsOfService.tsx",
    title: "Termini di Servizio",
    summary: "Termini di servizio di Forfettino.",
    changefreq: "yearly",
    priority: "0.2",
    waitFor: "article",
    output: "terms/index.html",
  },
  {
    path: "/faq",
    sourceFile: "src/pages/FaqPage.tsx",
    title: "FAQ — Domande Frequenti sul Regime Forfettario",
    summary:
      "Risposte alle domande più frequenti su tasse, INPS, netto spendibile e regime forfettario.",
    changefreq: "monthly",
    priority: "0.8",
    waitFor: "main",
    output: "faq/index.html",
  },
  {
    path: "/glossario",
    sourceFile: "src/pages/GlossarioPage.tsx",
    title: "Glossario Fiscale — Regime Forfettario",
    summary:
      "Glossario dei termini fiscali del regime forfettario: imposta sostitutiva, coefficiente redditività, gestione separata e altro.",
    changefreq: "monthly",
    priority: "0.7",
    waitFor: "main",
    output: "glossario/index.html",
  },
];

const UTILITY_PRERENDER_ROUTES = [
  {
    path: "/login",
    sourceFile: "src/pages/Auth.tsx",
    waitFor: "h1",
    output: "login/index.html",
  },
  {
    path: "/reset-password",
    sourceFile: "src/pages/ResetPassword.tsx",
    waitFor: "h1",
    output: "reset-password/index.html",
  },
  {
    path: "/auth/callback",
    sourceFile: "src/pages/AuthCallback.tsx",
    waitFor: "body",
    output: "auth/callback/index.html",
  },
  {
    path: "/conferma-email",
    sourceFile: "src/pages/ConfermaEmail.tsx",
    waitFor: "body",
    output: "conferma-email/index.html",
  },
  {
    path: "/bento-demo",
    sourceFile: "src/pages/BentoDemo.tsx",
    waitFor: "body",
    output: "bento-demo/index.html",
  },
];

function stripQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function parseFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return {};

  const yamlBlock = match[1];
  const data = {};
  const lines = yamlBlock.split("\n");
  let currentKey = "";

  for (const line of lines) {
    const arrayMatch = line.match(/^\s+-\s+(.+)$/);
    if (arrayMatch && currentKey) {
      const currentValue = data[currentKey];
      if (Array.isArray(currentValue)) {
        currentValue.push(stripQuotes(arrayMatch[1].trim()));
      }
      continue;
    }

    const keyValueMatch = line.match(/^(\w[\w_]*)\s*:\s*(.*)$/);
    if (!keyValueMatch) continue;

    const key = keyValueMatch[1];
    const value = keyValueMatch[2].trim();
    currentKey = key;

    if (value === "" || value === "|") {
      data[key] = [];
      continue;
    }

    data[key] = stripQuotes(value);
  }

  return data;
}

function formatDate(value) {
  return value.toISOString().slice(0, 10);
}

function getFileLastModified(relativePath) {
  const absolutePath = path.join(ROOT_DIR, relativePath);
  return formatDate(fs.statSync(absolutePath).mtime);
}

export function getBlogPosts() {
  return fs
    .readdirSync(BLOG_CONTENT_DIR)
    .filter((fileName) => /^blog-\d+.*\.md$/.test(fileName))
    .sort()
    .map((fileName) => {
      const filePath = path.join(BLOG_CONTENT_DIR, fileName);
      const raw = fs.readFileSync(filePath, "utf-8");
      const frontmatter = parseFrontmatter(raw);

      return {
        fileName,
        filePath,
        slug: String(frontmatter.slug ?? ""),
        title: String(frontmatter.title ?? ""),
        metaDescription: String(frontmatter.meta_description ?? ""),
        updatedAt: String(frontmatter.data_aggiornamento ?? formatDate(fs.statSync(filePath).mtime)),
        url: `${SITE_URL}/blog/${String(frontmatter.slug ?? "")}`,
      };
    })
    .filter((post) => post.slug);
}

export function getIndexableRoutes() {
  const blogPosts = getBlogPosts();
  const latestBlogUpdate =
    blogPosts.reduce((latest, post) => (post.updatedAt > latest ? post.updatedAt : latest), "1970-01-01") ||
    getFileLastModified("src/pages/BlogIndex.tsx");

  return [
    ...INDEXABLE_STATIC_ROUTES.map((route) => ({
      ...route,
      url: `${SITE_URL}${route.path}`,
      lastmod:
        route.path === "/blog" ? latestBlogUpdate : getFileLastModified(route.sourceFile),
    })),
    ...blogPosts.map((post) => ({
      path: `/blog/${post.slug}`,
      url: post.url,
      title: post.title,
      summary: post.metaDescription,
      lastmod: post.updatedAt,
      changefreq: "monthly",
      priority: "0.8",
      waitFor: "article",
      output: `blog/${post.slug}/index.html`,
      sourceFile: path.relative(ROOT_DIR, post.filePath),
    })),
  ];
}

export function getPrerenderRoutes() {
  return [
    ...getIndexableRoutes().map(({ path, waitFor, output }) => ({ path, waitFor, output })),
    ...UTILITY_PRERENDER_ROUTES,
  ];
}

export const DISALLOWED_PATHS = [
  "/admin",
  "/dashboard",
  "/clienti",
  "/incassi",
  "/calendario",
  "/scadenziario",
  "/pagamenti",
  "/tool",
  "/impostazioni",
  "/feedback",
  "/wizard",
  "/messaggi",
  "/supporto",
  "/report",
  "/classifica",
  "/budget",
  "/benchmark",
  "/guide-per-te",
  "/task",
  "/mfa/",
  "/login",
  "/auth",
  "/reset-password",
  "/conferma-email",
  "/referral/",
  "/r/",
  "/bento-demo",
];

export const ALLOWED_BOTS = [
  "Googlebot",
  "Bingbot",
  "Twitterbot",
  "facebookexternalhit",
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-SearchBot",
  "Claude-User",
  "PerplexityBot",
  "Google-Extended",
  "Applebot-Extended",
  "CCBot",
  "Bytespider",
  "cohere-ai",
  "anthropic-ai",
];

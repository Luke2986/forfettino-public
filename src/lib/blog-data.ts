/**
 * Blog data layer — static import of markdown files with frontmatter parsing.
 * No runtime fetch, no gray-matter (Node.js dep incompatible with Vite browser).
 */

// Raw markdown imports (Vite ?raw)
import blog01Raw from "../../_bmad-output/content/blog-01-calcolo-tasse-regime-forfettario-2026.md?raw";
import blog02Raw from "../../_bmad-output/content/blog-02-scadenze-fiscali-forfettario-2026.md?raw";
import blog03Raw from "../../_bmad-output/content/blog-03-aprire-partita-iva-forfettaria-2026.md?raw";
import blog04Raw from "../../_bmad-output/content/blog-04-contributi-inps-forfettario-2026.md?raw";
import blog05Raw from "../../_bmad-output/content/blog-05-forfettario-o-ordinario-2026.md?raw";
import blog06Raw from "../../_bmad-output/content/blog-06-fatturazione-elettronica-forfettari-2026.md?raw";
import blog07Raw from "../../_bmad-output/content/blog-07-coefficiente-redditivita-forfettario-ateco.md?raw";
import blog08Raw from "../../_bmad-output/content/blog-08-superamento-soglia-85000-forfettario.md?raw";
import blog09Raw from "../../_bmad-output/content/blog-09-forfettario-lavoro-dipendente.md?raw";
import blog10Raw from "../../_bmad-output/content/blog-10-costi-partita-iva-forfettaria-2026.md?raw";
import blog11Raw from "../../_bmad-output/content/blog-11-gestione-separata-vs-artigiani-commercianti.md?raw";
import blog12Raw from "../../_bmad-output/content/blog-12-riduzione-contributi-inps-35-forfettario.md?raw";
import blog13Raw from "../../_bmad-output/content/blog-13-agevolazioni-nuove-partite-iva-2026.md?raw";

export interface BlogPost {
  slug: string;
  title: string;
  meta_description: string;
  keyword_primaria: string;
  keyword_secondarie: string[];
  schema_markup: string[];
  og_image: string;
  cta_target: string;
  data_aggiornamento: string;
  content: string;
}

/**
 * Parse YAML frontmatter from raw markdown string.
 * Handles simple key: value, quoted strings, and YAML arrays (  - item).
 */
function parseFrontmatter(raw: string): { data: Record<string, unknown>; content: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { data: {}, content: raw };

  const yamlBlock = match[1];
  const content = match[2];
  const data: Record<string, unknown> = {};

  const lines = yamlBlock.split("\n");
  let currentKey = "";

  for (const line of lines) {
    // Array item: "  - value"
    const arrayMatch = line.match(/^\s+-\s+(.+)$/);
    if (arrayMatch && currentKey) {
      const arr = data[currentKey];
      if (Array.isArray(arr)) {
        arr.push(stripQuotes(arrayMatch[1].trim()));
      }
      continue;
    }

    // Key-value: "key: value"
    const kvMatch = line.match(/^(\w[\w_]*)\s*:\s*(.*)$/);
    if (kvMatch) {
      const key = kvMatch[1];
      const value = kvMatch[2].trim();
      currentKey = key;

      if (value === "" || value === "|") {
        // Next lines are array items or multiline
        data[key] = [];
      } else {
        data[key] = stripQuotes(value);
      }
    }
  }

  return { data, content };
}

function stripQuotes(s: string): string {
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

function parsePost(raw: string): BlogPost {
  const { data, content } = parseFrontmatter(raw);
  return {
    slug: String(data.slug ?? ""),
    title: String(data.title ?? ""),
    meta_description: String(data.meta_description ?? ""),
    keyword_primaria: String(data.keyword_primaria ?? ""),
    keyword_secondarie: Array.isArray(data.keyword_secondarie) ? data.keyword_secondarie.map(String) : [],
    schema_markup: Array.isArray(data.schema_markup) ? data.schema_markup.map(String) : [],
    og_image: String(data.og_image ?? ""),
    cta_target: String(data.cta_target ?? ""),
    data_aggiornamento: String(data.data_aggiornamento ?? ""),
    content,
  };
}

const allPosts: BlogPost[] = [
  parsePost(blog01Raw),
  parsePost(blog02Raw),
  parsePost(blog03Raw),
  parsePost(blog04Raw),
  parsePost(blog05Raw),
  parsePost(blog06Raw),
  parsePost(blog07Raw),
  parsePost(blog08Raw),
  parsePost(blog09Raw),
  parsePost(blog10Raw),
  parsePost(blog11Raw),
  parsePost(blog12Raw),
  parsePost(blog13Raw),
];

export function getAllBlogPosts(): BlogPost[] {
  return allPosts;
}

export function getBlogPostBySlug(slug: string): BlogPost | undefined {
  return allPosts.find((p) => p.slug === slug);
}

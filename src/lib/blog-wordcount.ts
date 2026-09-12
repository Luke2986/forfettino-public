/**
 * Blog word count helper — conta parole del contenuto markdown di un post blog.
 *
 * Usato da BlogPost.tsx per popolare `Article.wordCount` nello schema @graph.
 * Deve essere deterministico: stesso input → stesso output (zero rumore nei diff).
 *
 * Strategia:
 * 1. Strip frontmatter YAML (se presente)
 * 2. Strip code fences (```...```)
 * 3. Strip markdown inline (bold, italic, link, inline code)
 * 4. Strip heading markers (#, ##, ###)
 * 5. Strip list markers (-, *, 1.)
 * 6. Strip table separators (|, ---)
 * 7. Split su whitespace, filter stringhe vuote
 */

function stripFrontmatter(content: string): string {
  // Frontmatter format: "---\n...\n---\n"
  const match = content.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
  return match ? content.slice(match[0].length) : content;
}

function stripCodeFences(content: string): string {
  return content.replace(/```[\s\S]*?```/g, "");
}

function stripInlineMarkdown(content: string): string {
  return (
    content
      // links [text](url) → text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      // images ![alt](url) → (nothing, alt counts as text after)
      .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
      // bold/italic **text** __text__ *text* _text_
      .replace(/(\*{1,2}|_{1,2})([^*_\n]+?)\1/g, "$2")
      // inline code `code` → code
      .replace(/`([^`\n]+)`/g, "$1")
      // strikethrough ~~text~~
      .replace(/~~([^~]+)~~/g, "$1")
  );
}

function stripStructuralMarkers(content: string): string {
  return (
    content
      // heading markers: leading # ## ### etc
      .replace(/^#{1,6}\s+/gm, "")
      // list markers: "- ", "* ", "1. "
      .replace(/^\s*[-*]\s+/gm, "")
      .replace(/^\s*\d+\.\s+/gm, "")
      // blockquote markers
      .replace(/^\s*>\s?/gm, "")
      // horizontal rules
      .replace(/^-{3,}$/gm, "")
      .replace(/^={3,}$/gm, "")
      // table separator rows "|---|---|"
      .replace(/^\s*\|?[\s:|-]+\|?\s*$/gm, "")
      // table pipe characters (keep cell content)
      .replace(/\|/g, " ")
      // HTML tags (safety)
      .replace(/<[^>]+>/g, " ")
  );
}

/**
 * Conta le parole di un contenuto markdown blog.
 * Input: raw markdown (con o senza frontmatter).
 * Output: numero intero di parole (0 se vuoto).
 */
export function computeWordCount(content: string): number {
  if (!content || typeof content !== "string") return 0;

  let text = stripFrontmatter(content);
  text = stripCodeFences(text);
  text = stripInlineMarkdown(text);
  text = stripStructuralMarkers(text);

  const words = text
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 0);

  return words.length;
}

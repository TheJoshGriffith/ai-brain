import matter from "gray-matter";

export interface ParsedMarkdown {
  /** YAML frontmatter as a plain object (empty if none). */
  frontmatter: Record<string, unknown>;
  /** Markdown body with frontmatter stripped. */
  body: string;
}

/** Splits YAML frontmatter from the Markdown body. Never throws on bad YAML. */
export function parseMarkdown(content: string): ParsedMarkdown {
  try {
    const { data, content: body } = matter(content);
    return { frontmatter: (data as Record<string, unknown>) ?? {}, body };
  } catch {
    return { frontmatter: {}, body: content };
  }
}

export interface WikiLink {
  /** The raw target text inside the brackets (before any `|alias` or `#section`). */
  target: string;
  /** Optional display alias from `[[target|alias]]`. */
  alias?: string;
}

const WIKILINK_RE = /\[\[([^\]\n]+?)\]\]/g;

/**
 * Extracts `[[wiki links]]` from Markdown, supporting `[[target|alias]]` and
 * `[[target#section]]`. De-duplicates by target (case-insensitive), preserving
 * the first alias seen.
 */
export function extractWikiLinks(content: string): WikiLink[] {
  const seen = new Map<string, WikiLink>();
  for (const match of content.matchAll(WIKILINK_RE)) {
    const inner = match[1]?.trim();
    if (!inner) continue;
    const [left, alias] = inner.split("|", 2);
    const target = (left ?? "").split("#", 1)[0]?.trim();
    if (!target) continue;
    const key = target.toLowerCase();
    if (!seen.has(key)) {
      seen.set(key, alias?.trim() ? { target, alias: alias.trim() } : { target });
    }
  }
  return [...seen.values()];
}

/** Converts a title into a URL-safe slug. */
export function slugify(input: string): string {
  const base = input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
  return base || "untitled";
}

/**
 * Derives a display title from a document: explicit frontmatter `title`,
 * else the first `# Heading`, else the first non-empty line, else "Untitled".
 */
export function deriveTitle(content: string, frontmatter: Record<string, unknown>): string {
  if (typeof frontmatter.title === "string" && frontmatter.title.trim()) {
    return frontmatter.title.trim();
  }
  const heading = /^#\s+(.+)$/m.exec(content);
  if (heading?.[1]) return heading[1].trim();
  const firstLine = content.split("\n").map((l) => l.trim()).find(Boolean);
  return firstLine?.slice(0, 120) || "Untitled";
}

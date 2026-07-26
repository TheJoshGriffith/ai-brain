"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { fencePluginFor, linkPluginFor } from "@/lib/markdown-plugins";

/**
 * Strips a leading YAML frontmatter block. The frontmatter is structured data
 * (parsed into `documents.frontmatter` on save) — not part of the readable body.
 */
function stripFrontmatter(md: string): string {
  return md.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
}

/** Rewrites `[[target|alias]]` into Markdown links to the resolver route. */
function rewriteWikiLinks(md: string): string {
  return md.replace(/\[\[([^\]\n]+?)\]\]/g, (whole, inner: string) => {
    const [left, alias] = inner.split("|", 2);
    const target = (left ?? "").split("#", 1)[0]?.trim();
    if (!target) return whole;
    const text = (alias ?? left ?? "").trim() || target;
    return `[${text}](/links/${encodeURIComponent(target)})`;
  });
}

/**
 * Code renderer that routes fenced blocks with a registered language
 * (e.g. ```tibiamap) to their fence plugin; everything else renders normally.
 */
function Code({ className, children, ...props }: React.HTMLAttributes<HTMLElement>) {
  const language = /language-(\w+)/.exec(className ?? "")?.[1];
  const plugin = fencePluginFor(language);
  if (plugin) {
    return <plugin.Component code={String(children ?? "")} />;
  }
  return (
    <code className={className} {...props}>
      {children}
    </code>
  );
}

/** Anchor renderer that routes registered hrefs (e.g. tibiamaps.io positions) to their plugin. */
function Anchor({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  const plugin = linkPluginFor(href);
  if (plugin) {
    return <plugin.Component href={href!}>{children}</plugin.Component>;
  }
  return (
    <a href={href} {...props}>
      {children}
    </a>
  );
}

/** Slug for heading anchors. Must match between the TOC and the heading renderers. */
function headingSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

/** Visible text of a heading line of markdown (links/emphasis stripped). */
function headingText(line: string): string {
  return line
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`]/g, "")
    .trim();
}

interface TocEntry {
  level: 2 | 3;
  text: string;
  slug: string;
}

/** Extracts ##/### headings, skipping fenced code blocks. */
function extractToc(md: string): TocEntry[] {
  const entries: TocEntry[] = [];
  let inFence = false;
  for (const line of md.split("\n")) {
    if (/^```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = line.match(/^(#{2,3})\s+(.+)$/);
    if (!m) continue;
    const text = headingText(m[2] ?? "");
    if (!text) continue;
    entries.push({ level: m[1]!.length as 2 | 3, text, slug: headingSlug(text) });
  }
  return entries;
}

function Toc({ entries }: { entries: TocEntry[] }) {
  if (entries.length < 3) return null;
  return (
    <details className="md-toc" open>
      <summary>On this page</summary>
      <nav>
        {entries.map((e, i) => (
          <a key={i} href={`#${e.slug}`} data-level={e.level}>
            {e.text}
          </a>
        ))}
      </nav>
    </details>
  );
}

/** Recursively flattens React children to their visible text. */
function nodeText(node: React.ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join("");
  if (typeof node === "object" && "props" in node) {
    return nodeText((node.props as { children?: React.ReactNode }).children);
  }
  return "";
}

function makeHeading(Tag: "h2" | "h3") {
  return function Heading({ children }: { children?: React.ReactNode }) {
    return <Tag id={headingSlug(nodeText(children))}>{children}</Tag>;
  };
}

const H2 = makeHeading("h2");
const H3 = makeHeading("h3");

export function MarkdownPreview({ content }: { content: string }) {
  const body = rewriteWikiLinks(stripFrontmatter(content));
  return (
    <div className="md">
      <Toc entries={extractToc(body)} />
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ code: Code, a: Anchor, h2: H2, h3: H3 }}>
        {body}
      </ReactMarkdown>
    </div>
  );
}

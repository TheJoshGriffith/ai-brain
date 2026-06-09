"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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

export function MarkdownPreview({ content }: { content: string }) {
  return (
    <div className="md">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{rewriteWikiLinks(content)}</ReactMarkdown>
    </div>
  );
}

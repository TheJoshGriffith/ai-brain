"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { fencePluginFor } from "@/lib/markdown-plugins";

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

export function MarkdownPreview({ content }: { content: string }) {
  return (
    <div className="md">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ code: Code }}>
        {rewriteWikiLinks(content)}
      </ReactMarkdown>
    </div>
  );
}

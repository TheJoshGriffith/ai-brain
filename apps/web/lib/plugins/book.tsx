"use client";

/**
 * `book` fence plugin — renders in-game book/letter text as a collapsible
 * "readable" card instead of a wall of text.
 *
 * ```book
 * title: The Moonshadow Temple (Book)
 *
 * The Moonshadow Temple
 *
 * If some old legends are true, ...
 * ```
 */
function BookBlock({ code }: { code: string }) {
  const lines = code.split("\n");
  let title = "";
  let start = 0;
  const first = (lines[0] ?? "").trim();
  const titleMatch = first.match(/^title:\s*(.+)$/);
  if (titleMatch) {
    title = (titleMatch[1] ?? "").trim();
    start = 1;
  }
  const body = lines.slice(start).join("\n").trim();
  const paragraphs = body.split(/\n\s*\n/).filter(Boolean);
  const preview = (paragraphs[0] ?? "").slice(0, 120);

  return (
    <details className="book-block">
      <summary>
        <span className="book-icon" aria-hidden>📖</span>
        <span className="book-title">
          {title ? (
            <a href={`/links/${encodeURIComponent(title)}`} onClick={(e) => e.stopPropagation()}>
              {title}
            </a>
          ) : (
            "Book"
          )}
        </span>
        <span className="book-preview">{preview}…</span>
      </summary>
      <div className="book-pages">
        {paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
    </details>
  );
}

const bookPlugin = {
  language: "book",
  Component: BookBlock,
};

export default bookPlugin;

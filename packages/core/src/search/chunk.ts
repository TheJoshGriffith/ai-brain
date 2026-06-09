import { parseMarkdown } from "../markdown/parse";

/**
 * Splits document content into embedding-sized chunks. Frontmatter is stripped;
 * the body is split on blank lines and greedily packed up to ~maxChars, so
 * paragraphs stay intact where possible. Oversized paragraphs are hard-split.
 */
export function chunkContent(content: string, maxChars = 1200): string[] {
  const { body } = parseMarkdown(content);
  const paragraphs = body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = "";
  const flush = () => {
    if (current.trim()) chunks.push(current.trim());
    current = "";
  };

  for (const para of paragraphs) {
    if (para.length > maxChars) {
      flush();
      for (let i = 0; i < para.length; i += maxChars) {
        chunks.push(para.slice(i, i + maxChars));
      }
      continue;
    }
    if (current.length + para.length + 2 > maxChars) flush();
    current = current ? `${current}\n\n${para}` : para;
  }
  flush();
  return chunks;
}

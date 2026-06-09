import assert from "node:assert/strict";
import { test } from "node:test";
import { deriveTitle, extractWikiLinks, parseMarkdown, slugify } from "./parse";

test("slugify normalises titles", () => {
  assert.equal(slugify("Hello, World!"), "hello-world");
  assert.equal(slugify("  Spaces   and--dashes  "), "spaces-and-dashes");
  assert.equal(slugify("Café Déjà Vu"), "cafe-deja-vu");
  assert.equal(slugify("!!!"), "untitled");
});

test("parseMarkdown splits frontmatter", () => {
  const { frontmatter, body } = parseMarkdown("---\ntitle: Hi\ntags: [a, b]\n---\n# Body\n");
  assert.equal(frontmatter.title, "Hi");
  assert.deepEqual(frontmatter.tags, ["a", "b"]);
  assert.equal(body.trim(), "# Body");
});

test("parseMarkdown tolerates no frontmatter and bad YAML", () => {
  assert.deepEqual(parseMarkdown("plain text").frontmatter, {});
  assert.equal(parseMarkdown("plain text").body, "plain text");
});

test("extractWikiLinks handles aliases, sections, and dedupes", () => {
  const links = extractWikiLinks(
    "See [[Roadmap]] and [[Roadmap|the plan]]. Also [[Specs#api]] and [[ Roadmap ]].",
  );
  assert.equal(links.length, 2);
  assert.deepEqual(links[0], { target: "Roadmap" });
  assert.deepEqual(links[1], { target: "Specs" });
});

test("extractWikiLinks ignores empties", () => {
  assert.deepEqual(extractWikiLinks("[[]] and [[ ]] and text"), []);
});

test("deriveTitle prefers frontmatter, then heading, then first line", () => {
  assert.equal(deriveTitle("# Heading", { title: "FM" }), "FM");
  assert.equal(deriveTitle("# Heading\nmore", {}), "Heading");
  assert.equal(deriveTitle("just a line\nmore", {}), "just a line");
  assert.equal(deriveTitle("", {}), "Untitled");
});

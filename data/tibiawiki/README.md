# TibiaWiki dataset

Artifacts generated from the official TibiaWiki (tibia.fandom.com) Fandom database dump
(`tibiawiki_pages_current.xml.7z`, dump date **2026-03-09**). Regenerable — the `.db`/`.jsonl`
are gitignored. Fresh dumps: bottom of <https://tibia.fandom.com/wiki/Special:Statistics>.

## Files

| File | What |
| --- | --- |
| `tibiawiki.db` | SQLite — the structured dataset. Use this from TibiaData / TibiaGuru. |
| `tibiawiki_docs.jsonl` | One AI Brain document per wiki page (YAML frontmatter + Markdown, `[[wiki links]]` preserved). Input for the ingestion script. |
| `manifest.json` | Per-entity-type table name, row count, and column list. |

## SQLite schema (`tibiawiki.db`)

Core tables:

- `pages(id, title, slug, infobox_type, wikitext, plaintext)` — all 22,440 main-namespace,
  non-redirect pages. `wikitext` is the raw source; `plaintext` is stripped for search.
- `pages_fts` — FTS5 index over title + plaintext: `SELECT title FROM pages_fts WHERE pages_fts MATCH 'demon helmet'`
- `redirects(from_title, to_title)` — 6,059 alias titles (useful for name resolution).
- `page_links(from_id, to_title)` — 128,804 internal link edges (the wiki graph).
- `map_points(page_id, x, y, z, label, source)` — 5,748 map coordinates (absolute sqm,
  tibiamaps convention) extracted from `{{Mapper Coords}}` and NPC positions across 2,921 pages.

One table per infobox type (29 total, see `manifest.json`), columns = union of infobox
parameters seen for that type, values are cleaned text (wikitext markup stripped where lossless):

`creatures` (2,123 × 64 cols: hp, exp, armor, elemental *dmgmod*s, bestiary…), `objects` (9,601 × 96:
itemid, objectclass, attributes…), `npcs` (1,217 × 75: job, city, posx/posy/posz, buysell…), `books`,
`buildings`, `quests`, `spells`, `achievements`, `hunts`, `mounts`, `outfits`, `imbuements`,
`charms`, `keys`, `worlds`, `effects`, `missiles`, `corpses`, `updates`, `transcripts`, …

Every entity table has `page_id → pages.id` (join for full article text) and `title`.

```sql
-- e.g. all bosses with >5k hp
SELECT title, hp, exp FROM creatures WHERE isboss='yes' AND CAST(hp AS INT) > 5000;
```

## Ingest into AI Brain

```bash
AI_BRAIN_TOKEN=<PAT: spaces:read spaces:write documents:write> \
  node scripts/ingest-tibiawiki.mjs            # full run, resumable (default --url http://10.0.0.20:3007)
node scripts/ingest-tibiawiki.mjs --limit 20   # smoke test
```

Creates a **TibiaWiki** space and one document per page. Infobox data lands in each document's
frontmatter (`tibiawiki:` key → queryable jsonb in Postgres); `[[wiki links]]` become the AI Brain
link graph; tags are `tibiawiki` + entity type. Progress is checkpointed to
`tibiawiki_docs.jsonl.progress`; re-run to resume/retry. Note: the embedding worker will take a
while to index 22k docs; hybrid search improves as it catches up.

Frontmatter is also directly queryable in Postgres, e.g.:

```sql
SELECT title, frontmatter->'tibiawiki'->>'hp' AS hp
FROM documents WHERE frontmatter->'tibiawiki'->>'type' = 'Creature';
```

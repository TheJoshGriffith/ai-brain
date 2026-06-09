-- Runs once on first initialisation of the Postgres data volume.
-- pgvector ships in the pgvector/pgvector image but must be enabled per-database.
CREATE EXTENSION IF NOT EXISTS vector;

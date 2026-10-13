-- Adds a saved Pattern Lab draft to projects. Safe to run more than once.
--
-- db/schema.sql only runs on a brand-new database, so existing databases
-- need this applied by hand:
--   Docker:  docker compose exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" < db/migrations/002_project_pattern.sql
--   Local:   psql -U postgres -d stitch_studio -f db/migrations/002_project_pattern.sql

-- JSONB rather than separate columns: the draft's shape (measurements,
-- fabric, seam allowance, which pieces are included) will keep evolving
-- with the Pattern Lab, and it's always read and written as one unit.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS pattern JSONB;

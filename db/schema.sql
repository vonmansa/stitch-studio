-- Stitch Studio — initial schema (Phase 1)
--
-- Run this once against your local database, e.g.:
--   createdb stitch_studio
--   psql -d stitch_studio -f db/schema.sql

-- A Postgres ENUM restricts the column to a fixed set of values at the
-- database level, so "status" can never end up with a typo'd value even
-- if the app-layer validation is ever bypassed.
CREATE TYPE project_status AS ENUM ('planning', 'in-progress', 'done');

CREATE TABLE projects (
    id              SERIAL PRIMARY KEY,
    name            TEXT NOT NULL,
    pattern_name    TEXT,
    fabric_type     TEXT,
    notes           TEXT,
    status          project_status NOT NULL DEFAULT 'planning',
    photo_filename  TEXT,
    pattern         JSONB,  -- saved Pattern Lab draft, see db/migrations/002
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Keeps updated_at accurate without every UPDATE statement having to
-- remember to set it manually.
CREATE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER projects_set_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

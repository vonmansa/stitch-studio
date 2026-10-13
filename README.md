# Stitch Studio

Sewing project tracker: CRUD for projects (with photo upload), a
garment yardage calculator, and a pants pattern-making workflow:

- **Fit Studio** (`/fit`) — drag handles on a pants model to change the
  fit; measurements shown in inches and cm, with fit presets.
- **Pattern Lab** (`/pattern`) — drafts front/back, waistband, fly and
  pocket pieces from those measurements; true-scale SVG download, tiled
  Letter/A4 printing (or save as PDF), a body-vs-garment ease check, and
  saving the pattern to a project.

React + Vite frontend, Express backend, PostgreSQL database. Runs either
with Docker Compose (one command) or locally with plain Node/npm.

## Running with Docker

```bash
cp .env.example .env        # Postgres credentials used by docker-compose.yml
docker compose up --build   # http://localhost:8080 (API also on :4000)
```

The schema loads automatically the first time the database volume is
created. If your database volume already existed before a migration was
added, apply it once:

```bash
set -a; . ./.env; set +a
docker compose exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" < db/migrations/002_project_pattern.sql
```

`docker compose down` stops everything and keeps your data;
`docker compose down -v` also deletes the database and uploaded photos.

## Running locally (without Docker)

### Prerequisites

- Node.js (v20+) and npm
- PostgreSQL running locally. On this machine it was installed via:
  ```
  brew install postgresql@16
  brew services start postgresql@16
  ```

### First-time setup

```bash
# 1. Create the database and load the schema
createdb -O postgres stitch_studio
psql -U postgres -d stitch_studio -f db/schema.sql
# (databases created before a migration was added: run db/migrations/*.sql too)

# 2. Install dependencies
cd server && npm install
cd ../client && npm install
```

`server/.env` already points at `localhost:5432`, database
`stitch_studio`, user `postgres`, no password — matching the Homebrew
default install. Edit it if your setup differs.

### Start the dev servers

Two terminals:

```bash
# Terminal 1 — backend (http://localhost:4000)
cd server && npm run dev

# Terminal 2 — frontend (http://localhost:5173)
cd client && npm run dev
```

Open http://localhost:5173. The Vite dev server proxies `/api` and
`/uploads` requests to the backend (see `client/vite.config.js`), so
the frontend never needs to know the backend's port directly.

## What's here

- `server/src/db.js` — PostgreSQL connection pool
- `server/src/routes/projects.js` + `controllers/projectsController.js` —
  CRUD REST endpoints, photo upload via multer
- `server/src/data/yardageTable.js` — the yardage lookup table/logic
- `server/src/routes/yardage.js` — exposes garment config + calculation
  as REST endpoints
- `client/src/pages/` — one file per screen (list, form, detail,
  calculator, Fit Studio, Pattern Lab)
- `client/src/fit/` — the pattern-making logic: `pantsModel.js` (fit
  model geometry), `patternDraft.js` + `detailPieces.js` (pattern
  drafting), `fitCheck.js` (ease rules), `PatternSheet.jsx` /
  `PrintTiles.jsx` (sheet layout and tiled printing), and
  `MeasurementsContext.jsx` (shared state, saved in localStorage)
- `client/src/api/client.js` — the only place that calls `fetch`
- `db/schema.sql` — table definition, run once to set up the database
- `db/migrations/` — changes for databases created before they existed

## API reference

| Method | Path                  | Description                          |
|--------|------------------------|---------------------------------------|
| GET    | /api/projects          | list all projects                    |
| GET    | /api/projects/:id      | get one project                      |
| POST   | /api/projects          | create (multipart/form-data, optional `photo`) |
| PUT    | /api/projects/:id      | update (multipart/form-data)         |
| DELETE | /api/projects/:id      | delete (also removes photo file)     |
| PUT    | /api/projects/:id/pattern | save a Pattern Lab draft (JSON, validated) |
| GET    | /api/yardage/garment-types | measurement fields per garment type |
| POST   | /api/yardage/calculate | `{ garmentType, measurements }` → estimate |

## Not in scope yet

No auth, no automated tests, no deployment. The pattern draft is a
simplified trouser block (no darts, pockets are side-seam bags and back
patch pockets) — sew a muslin before cutting good fabric.

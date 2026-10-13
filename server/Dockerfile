# ---- Stage 1: install dependencies ----
# A separate stage just for `npm ci` means Docker can cache this layer
# and skip reinstalling everything when only src/ changes, not
# package.json. It also keeps npm's cache and any dev tooling it
# downloads out of the final image, since this whole stage is discarded
# after the build finishes.
FROM node:20-alpine AS deps

WORKDIR /app

# Copy only the manifest files first, not the whole app. Docker caches
# each instruction as a layer keyed on its inputs, so as long as these
# two files don't change, `npm ci` is skipped entirely on rebuilds.
COPY package.json package-lock.json ./

# `npm ci` (not `npm install`) installs exactly the versions pinned in
# package-lock.json and errors out if the lockfile is out of sync —
# the reproducibility guarantee you want for a build, vs. `npm install`
# which is allowed to silently update the lockfile.
# `--omit=dev` skips devDependencies (just nodemon here) since
# file-watching has no purpose in a production container.
RUN npm ci --omit=dev

# ---- Stage 2: runtime image ----
# Fresh, clean base for the actual image that ships — none of the layer
# history from the deps stage (npm's cache, etc.) carries over, only
# the files explicitly copied with --from=deps below.
FROM node:20-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production

# Pull the already-built node_modules over from the deps stage instead
# of running npm again here.
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src

# The app writes uploaded photos to ./uploads relative to its own
# location (see src/middleware/upload.js), and creates the directory
# itself if missing — but it needs to be owned by the user the process
# actually runs as, which we set up next.
#
# node:alpine ships with a preexisting unprivileged "node" user
# (uid/gid 1000), so instead of inventing our own, we just use it and
# hand it ownership of /app. Running as this non-root user means that
# if the app is ever compromised via a dependency vuln or a bad
# request, the attacker doesn't get root inside the container.
RUN mkdir -p uploads && chown -R node:node /app

USER node

EXPOSE 4000

# Lets `docker ps` / `docker compose ps` report "healthy" or
# "unhealthy" instead of just "running", by periodically hitting the
# app's own /api/health route from inside the container.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:4000/api/health || exit 1

CMD ["node", "src/index.js"]

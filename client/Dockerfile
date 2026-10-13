# ---- Stage 1: build the static assets ----
FROM node:20-alpine AS build

WORKDIR /app

# Same caching trick as the server: install deps before copying source,
# so editing a .jsx file doesn't force a full npm reinstall on rebuild.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Vite compiles the React app into plain HTML/CSS/JS in ./dist. Once
# that's done, nothing about Node.js, npm, or React's dev tooling is
# needed to serve the result — which is the whole reason this is a
# separate stage from the one that ships.
RUN npm run build

# ---- Stage 2: serve with nginx ----
# A brand new, much smaller base image. None of the ~200MB+ of
# node_modules from the build stage crosses over — only the compiled
# dist/ folder does, via the explicit COPY --from=build below. This is
# the main payoff of a multi-stage build: the shipped image only
# contains a static file server and the static files themselves.
FROM nginx:1.27-alpine AS runtime

# Replace nginx's default site config with ours — adds the SPA fallback
# and proxies /api and /uploads to the backend container.
COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

# nginx:alpine already runs its worker processes (the ones that
# actually handle requests) as an unprivileged "nginx" user out of the
# box, so there's no separate USER directive needed here the way there
# was for the Node server.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]

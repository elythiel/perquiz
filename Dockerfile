# syntax=docker/dockerfile:1
#
# One process, one volume, no root. The image carries the built server, the
# migrations it replays at boot, and nothing else.

# --- Build ---------------------------------------------------------------
FROM node:24-alpine AS build
WORKDIR /app
RUN corepack enable
# No toolchain, and MEASURED rather than assumed (2026-08-27): both native
# dependencies arrive as musl binaries, so nothing is compiled here.
#  - sharp resolves `@img/sharp-linuxmusl-*` from the lockfile, which already
#    carries every platform variant;
#  - better-sqlite3 v13 ships prebuildify binaries inside its own tarball
#    (`prebuilds/linuxmusl-{x64,arm64}.node`), so node-gyp never runs.
# Both end up in `.output/server/node_modules`, which is what the runtime stage
# copies — hence no python3/make/g++ in either stage. Should a future bump lose
# a musl prebuild, the install will start compiling and fail here, loudly.
# Sources are copied before the install: the postinstall (`nuxt prepare`)
# needs nuxt.config.ts.
COPY . .
RUN yarn install --immutable && yarn build

# --- Runtime -------------------------------------------------------------
FROM node:24-alpine
WORKDIR /app
# Hardening:
#  - Alpine patches (libssl/libcrypto);
#  - removal of npm, corepack and yarn 1. The runtime only ever runs
#    `node .output/server/index.mjs`: those three are useless here and ship
#    their own vulnerable dependencies (tar, brace-expansion, ip-address,
#    undici), which accounted for 8 of the image's 10 CVEs.
# `apk upgrade` makes the build non-reproducible; replace it with a
# digest-pinned base the day we want bit-for-bit identical builds.
RUN apk upgrade --no-cache \
 && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx \
           /usr/local/lib/node_modules/corepack /usr/local/bin/corepack \
           /opt/yarn-v* /usr/local/bin/yarn /usr/local/bin/yarnpkg
ENV NODE_ENV=production \
    NUXT_DATA_DIR=/app/data \
    PORT=3000
COPY --from=build /app/.output ./.output
# The migrations are a RUNTIME input, not a build artefact: the server replays
# them at boot from this path (server/database/client.ts). Bundling the SQL
# into .output instead would mean hand-writing a migration runner.
COPY --from=build /app/server/database/migrations ./server/database/migrations
# All persistent state (app.db + photos) fits in this single volume.
#
# The tree is created here, and owned by `node`, for the sake of the line below:
# a container that has dropped privileges cannot chown a fresh volume, and
# Docker copies the image's ownership into a named volume when it first mounts
# it. The app still builds its own tree at boot — that is what covers a bind
# mount masking this content — so this is about permissions, not about layout.
RUN mkdir -p /app/data/photos && chown -R node:node /app/data
# Nothing here needs root: the server listens on 3000 and writes under
# /app/data. A bind mount from the host must be writable by uid 1000, or the
# app cannot open its database — see the README.
USER node
VOLUME ["/app/data"]
EXPOSE 3000
# Answers "is the server serving?", and no more than that. `/login` is the one
# page that needs no session (SPEC §1), and it is deliberately not a route that
# touches SQLite: a health probe that reads the database would take the game
# down over a lock it should have waited on. busybox wget, already in the base.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget --spider -q -T 4 http://127.0.0.1:3000/login || exit 1
CMD ["node", ".output/server/index.mjs"]

# syntax=docker/dockerfile:1
#
# Image skeleton (M0). M9 finalises it: native dependencies (sharp /
# better-sqlite3 on musl), non-root user, healthcheck.

# --- Build ---------------------------------------------------------------
FROM node:24-alpine AS build
WORKDIR /app
RUN corepack enable
# Sources are copied before the install: the postinstall (`nuxt prepare`)
# needs nuxt.config.ts.
COPY . .
RUN yarn install --immutable && yarn build

# --- Runtime -------------------------------------------------------------
FROM node:24-alpine
WORKDIR /app
# Hardening (M9 will finish the job: non-root user, healthcheck):
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
# All persistent state (app.db + photos) fits in this single volume.
# The build-time mkdir only seeds a named volume; a bind mount of a host
# directory, on the other hand, masks the image's content — hence the mkdir at
# startup. To be removed once M1 creates the directory tree at application boot
# (useful outside Docker too), going back to CMD ["node", ...].
RUN mkdir -p /app/data/photos
VOLUME ["/app/data"]
EXPOSE 3000
CMD ["sh", "-c", "mkdir -p \"$NUXT_DATA_DIR/photos\" && exec node .output/server/index.mjs"]

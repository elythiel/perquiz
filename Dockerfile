# syntax=docker/dockerfile:1
#
# Squelette d'image (M0). M9 le finalise : dépendances natives (sharp /
# better-sqlite3 sur musl), utilisateur non-root, healthcheck.

# --- Build ---------------------------------------------------------------
FROM node:24-alpine AS build
WORKDIR /app
RUN corepack enable
# Les sources sont copiées avant l'install : le postinstall (`nuxt prepare`)
# a besoin de nuxt.config.ts.
COPY . .
RUN yarn install --immutable && yarn build

# --- Runtime -------------------------------------------------------------
FROM node:24-alpine
WORKDIR /app
# Durcissement (M9 finira le travail : utilisateur non-root, healthcheck) :
#  - correctifs Alpine (libssl/libcrypto) ;
#  - suppression de npm, corepack et yarn 1. Le runtime n'exécute que
#    `node .output/server/index.mjs` : ces trois-là ne servent à rien ici et
#    embarquent leurs propres dépendances vulnérables (tar, brace-expansion,
#    ip-address, undici), qui représentaient 8 CVE sur 10 de l'image.
# `apk upgrade` rend le build non reproductible ; à remplacer par une base
# épinglée par digest le jour où on veut des builds bit-à-bit identiques.
RUN apk upgrade --no-cache \
 && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx \
           /usr/local/lib/node_modules/corepack /usr/local/bin/corepack \
           /opt/yarn-v* /usr/local/bin/yarn /usr/local/bin/yarnpkg
ENV NODE_ENV=production \
    NUXT_DATA_DIR=/app/data \
    PORT=3000
COPY --from=build /app/.output ./.output
# Tout l'état persistant (app.db + photos) tient dans ce seul volume.
# Le mkdir de build ne sert qu'à amorcer un volume nommé ; un bind mount d'un
# répertoire hôte, lui, masque le contenu de l'image — d'où le mkdir au
# démarrage. À retirer quand M1 créera l'arborescence au boot applicatif
# (utile aussi hors Docker), en repassant à CMD ["node", ...].
RUN mkdir -p /app/data/photos
VOLUME ["/app/data"]
EXPOSE 3000
CMD ["sh", "-c", "mkdir -p \"$NUXT_DATA_DIR/photos\" && exec node .output/server/index.mjs"]

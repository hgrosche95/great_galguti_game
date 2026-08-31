FROM node:22-slim AS build
WORKDIR /app

COPY server/package.json server/package-lock.json ./server/
COPY server/prisma ./server/prisma
RUN cd server && npm ci

COPY server ./server
COPY src ./src

RUN cd server && npm run build

FROM build AS prune
WORKDIR /app
RUN cd server && npm prune --omit=dev

FROM node:22-slim
WORKDIR /app

# 'prisma migrate deploy' laeuft beim Containerstart, bevor der eigentliche
# Server (das esbuild-Bundle in dist/index.js) startet - dafuer braucht es
# zur Laufzeit die Prisma-CLI (node_modules), das Schema und die
# Migrationsdateien, nicht nur das Bundle selbst.
COPY --from=prune /app/server/node_modules ./node_modules
COPY --from=prune /app/server/prisma ./prisma
COPY --from=prune /app/server/prisma.config.ts ./prisma.config.ts
COPY --from=prune /app/server/package.json ./package.json
COPY --from=prune /app/server/dist/index.js ./index.js

EXPOSE 8080
CMD ["sh", "-c", "npx prisma migrate deploy && node index.js"]

FROM node:22-slim AS build
WORKDIR /app

COPY server/package.json server/package-lock.json ./server/
RUN cd server && npm ci

COPY server ./server
COPY src ./src

RUN cd server && npm run build

FROM node:22-slim
WORKDIR /app

COPY --from=build /app/server/dist/index.js ./index.js

EXPOSE 8080
CMD ["node", "index.js"]

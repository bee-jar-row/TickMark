# One image: builds the Vue app, then runs the Express API which also serves it.
FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY shared ./shared
COPY server/package*.json ./server/
RUN npm --prefix server install --omit=dev
COPY client/package*.json ./client/
RUN npm --prefix client install
COPY server ./server
COPY client ./client
RUN npm --prefix client run build

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production PORT=3000 DATA_DIR=server/data
COPY --from=build /app/shared ./shared
COPY --from=build /app/server ./server
COPY --from=build /app/client/dist ./client/dist
EXPOSE 3000
VOLUME ["/app/server/data"]
CMD ["node", "server/src/index.js"]

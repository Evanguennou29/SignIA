FROM node:24-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY assets-lock.json vite.config.ts tsconfig.json ./
COPY scripts/assets.mjs ./scripts/assets.mjs
COPY frontend ./frontend
RUN npm run assets && npm run build

FROM nginxinc/nginx-unprivileged:stable-alpine

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080

# syntax=docker/dockerfile:1

FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine AS runtime
ENV PORT=80
ENV API_URL=http://localhost:3000
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY docker/40-write-app-config.sh /docker-entrypoint.d/40-write-app-config.sh
RUN chmod +x /docker-entrypoint.d/40-write-app-config.sh
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80

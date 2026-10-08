FROM node:24 AS builder
WORKDIR /cadastro_clientes

COPY package*.json ./
COPY packages/ ./packages
COPY apps/web/package.json ./apps/web/

RUN npm install

COPY apps/web/ ./apps/web
WORKDIR /cadastro_clientes/apps/web
RUN npm run build

FROM nginx:alpine
COPY --from=builder /cadastro_clientes/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
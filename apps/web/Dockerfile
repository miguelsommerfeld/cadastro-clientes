FROM node:24 AS builder
WORKDIR /cadastro_clientes

ARG VITE_API_BASE_URL=/api/v1
ARG VITE_API_CUSTOMERS_PATH=customers
ARG VITE_API_DELETED_CUSTOMERS_PATH=customers/deleted
ARG VITE_API_CUSTOMER_RESTORE_PATH=customers/restore
ARG VITE_API_CUSTOMER_PERMANENT_DELETE_PATH=customers/permanent
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL} \
    VITE_API_CUSTOMERS_PATH=${VITE_API_CUSTOMERS_PATH} \
    VITE_API_DELETED_CUSTOMERS_PATH=${VITE_API_DELETED_CUSTOMERS_PATH} \
    VITE_API_CUSTOMER_RESTORE_PATH=${VITE_API_CUSTOMER_RESTORE_PATH} \
    VITE_API_CUSTOMER_PERMANENT_DELETE_PATH=${VITE_API_CUSTOMER_PERMANENT_DELETE_PATH}

COPY package*.json ./
COPY packages/ ./packages
COPY apps/web/package.json ./apps/web/

RUN npm install

COPY apps/web/ ./apps/web
WORKDIR /cadastro_clientes/apps/web
RUN npm run build

FROM nginx:alpine
COPY --from=builder /cadastro_clientes/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/templates/default.conf.template

EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
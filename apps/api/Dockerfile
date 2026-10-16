FROM node:24
WORKDIR /cadastro_clientes

COPY packages/ ./packages
COPY package*.json ./
COPY apps/api/package*.json apps/api/
RUN npm install

COPY apps/api ./apps/api
WORKDIR /cadastro_clientes/apps/api
RUN npm run build

EXPOSE 3333
CMD ["npm", "start"]
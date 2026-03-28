FROM node:18-alpine

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm ci --omit=dev

COPY . .

EXPOSE 3004

CMD ["node", "--max-old-space-size=128", "src/server.js"]
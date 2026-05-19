FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev 2>/dev/null || npm install --omit=dev

COPY server.js ./
COPY public ./public

RUN mkdir -p data uploads

ENV PORT=3456
EXPOSE 3456

CMD ["node", "server.js"]

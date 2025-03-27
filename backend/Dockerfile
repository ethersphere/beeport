FROM node:lts-alpine

ENV PORT=3333
RUN apk add --no-cache tini # Install tini

WORKDIR /app
COPY . .

RUN npm install express http-proxy-middleware viem cors dotenv
USER nobody
EXPOSE ${PORT}

ENTRYPOINT ["/sbin/tini", "--", "node", "index.js"]

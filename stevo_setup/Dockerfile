# Eigenes Basis-Image statt BUILD_FROM: neuere Supervisor-Versionen setzen BUILD_FROM ohne build.yaml nicht mehr.
# alpine ist für aarch64 und amd64 vorhanden; --platform vom Supervisor wählt das passende.
FROM alpine:3.21
RUN apk add --no-cache nodejs npm
WORKDIR /app
COPY package.json /app/
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force
COPY server.js ui.html /app/
CMD [ "node", "/app/server.js" ]

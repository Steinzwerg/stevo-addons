ARG BUILD_FROM
FROM $BUILD_FROM
RUN apk add --no-cache nodejs npm
WORKDIR /app
COPY package.json /app/
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force
COPY server.js ui.html /app/
CMD [ "node", "/app/server.js" ]

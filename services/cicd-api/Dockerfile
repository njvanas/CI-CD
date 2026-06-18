FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends git openssh-client ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
COPY scripts ./scripts
COPY content ./content
COPY src ./src
COPY admin ./admin
COPY services/cicd-api ./services/cicd-api

WORKDIR /app/services/cicd-api
EXPOSE 3000
CMD ["node", "server.mjs"]

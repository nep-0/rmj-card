FROM node:24-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends fontconfig \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci && npm cache clean --force

COPY src ./src
COPY NotoSansSC-Regular.otf ./NotoSansSC-Regular.otf
RUN install -D -m 0644 NotoSansSC-Regular.otf /usr/local/share/fonts/NotoSansSC-Regular.otf \
  && fc-cache --force \
  && install -d -o node -g node -m 0755 /app/data

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

USER node
CMD ["npm", "start"]

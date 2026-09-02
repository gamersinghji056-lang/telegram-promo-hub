FROM node:24-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl tar \
  && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_linux_x86_64.tar.gz -o /tmp/piper.tar.gz \
  && mkdir -p /opt/piper \
  && tar -xzf /tmp/piper.tar.gz -C /opt/piper --strip-components=1 \
  && ln -s /opt/piper/piper /usr/local/bin/piper \
  && rm /tmp/piper.tar.gz

WORKDIR /app
COPY server.mjs ./server.mjs

ENV PIPER_BIN=/usr/local/bin/piper
ENV LARA_VOICE_CACHE_DIR=/app/.cache
ENV LARA_VOICE_MODEL_DIR=/app/.cache/models

CMD ["node", "server.mjs"]

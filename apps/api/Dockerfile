FROM node:24-bookworm-slim AS node-runtime
FROM python:3.12-slim-bookworm
COPY --from=node-runtime /usr/local/bin/node /usr/local/bin/node
COPY --from=node-runtime /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
    && apt-get update && apt-get install -y --no-install-recommends \
    libreoffice-writer libreoffice-calc libreoffice-impress fonts-dejavu-core libgomp1 \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY apps/api/server/requirements.lock apps/api/server/requirements.lock
RUN python -m venv /opt/file-tools && /opt/file-tools/bin/pip install --no-cache-dir -r apps/api/server/requirements.lock
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/file-tools packages/file-tools
RUN npm ci --omit=dev --workspace=@celi/api --include-workspace-root=false --ignore-scripts
COPY apps/api/src apps/api/src
COPY apps/api/server apps/api/server
ENV FILE_TOOLS_PYTHON=/opt/file-tools/bin/python
ENV FILE_TOOLS_OFFICE=/usr/bin/libreoffice
ENV FILE_TOOLS_RUNTIME_ROOT=/app/.file-tools
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=80
RUN /opt/file-tools/bin/python apps/api/server/file_worker.py --prepare-office \
    && groupadd --gid 10001 app && useradd --uid 10001 --gid app --create-home app \
    && mkdir -p /app/.file-tools/jobs && chown -R app:app /app/.file-tools
USER app
EXPOSE 80
CMD ["node", "apps/api/src/server.mjs"]

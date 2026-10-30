FROM node:22-bookworm-slim AS node-runtime
FROM python:3.12-slim-bookworm
COPY --from=node-runtime /usr/local/bin/node /usr/local/bin/node
COPY --from=node-runtime /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
    && apt-get update && apt-get install -y --no-install-recommends \
    libreoffice-writer libreoffice-calc libreoffice-impress fonts-dejavu-core libgomp1 \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY server/requirements.lock server/requirements.lock
RUN python -m venv /opt/file-tools && /opt/file-tools/bin/pip install --no-cache-dir -r server/requirements.lock
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV FILE_TOOLS_PYTHON=/opt/file-tools/bin/python
ENV FILE_TOOLS_OFFICE=/usr/bin/libreoffice
RUN npm run build \
    && /opt/file-tools/bin/python server/file_worker.py --prepare-office \
    && groupadd --gid 10001 app && useradd --uid 10001 --gid app --create-home app \
    && mkdir -p /app/.file-tools/jobs && chown -R app:app /app/.file-tools /app/.next
USER app
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "node_modules/next/dist/bin/next", "start", "-H", "0.0.0.0"]

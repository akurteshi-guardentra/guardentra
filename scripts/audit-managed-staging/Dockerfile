# Build ONLY from the allowlisted context described in README.md.
FROM node:22-bookworm-slim
WORKDIR /runner
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY core.mjs run.mjs manifest.json ./
COPY migrations/ ./migrations/
USER node
ENTRYPOINT ["node", "run.mjs"]

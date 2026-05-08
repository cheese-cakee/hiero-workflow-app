# SPDX-License-Identifier: Apache-2.0

FROM node:22-alpine

WORKDIR /app

# Copy lockfile first for layer caching
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy source code
COPY src/ ./src/

# Probot requires the private key at runtime
# Mount it as a volume or set PRIVATE_KEY_PATH env var

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD node -e "const http = require('http'); http.get('http://localhost:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

USER node

CMD ["node", "src/index.js"]

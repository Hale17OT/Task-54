FROM node:22-alpine AS base
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
COPY apps/api/package.json ./apps/api/
COPY libs/shared/package.json ./libs/shared/
RUN npm install --workspace=apps/api --workspace=libs/shared --include-workspace-root

# Copy source
COPY libs/shared ./libs/shared
COPY apps/api ./apps/api
COPY tsconfig.base.json ./

# Build
RUN npm run build --workspace=apps/api

# Create data directories
RUN mkdir -p /app/data/pdfs /app/data/media /app/logs

# Production stage
FROM node:22-alpine AS production
WORKDIR /app

COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/apps/api/dist ./apps/api/dist
COPY --from=base /app/apps/api/package.json ./apps/api/
COPY --from=base /app/libs/shared ./libs/shared
COPY --from=base /app/package.json ./
COPY --from=base /app/data ./data
COPY --from=base /app/tsconfig.base.json ./

RUN mkdir -p /app/logs

EXPOSE 3000

WORKDIR /app/apps/api
CMD ["node", "dist/apps/api/src/main.js"]

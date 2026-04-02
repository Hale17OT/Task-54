FROM node:22-alpine AS build
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
COPY apps/web/package.json ./apps/web/
COPY libs/shared/package.json ./libs/shared/
RUN npm install --workspace=apps/web --workspace=libs/shared --include-workspace-root

# Copy source
COPY libs/shared ./libs/shared
COPY apps/web ./apps/web
COPY tsconfig.base.json ./

# Build
RUN npm run build --workspace=apps/web

# Serve with nginx
FROM nginx:alpine AS production
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

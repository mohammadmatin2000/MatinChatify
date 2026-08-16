# ============================================================
# React Build
# ============================================================

FROM node:22-alpine AS build

WORKDIR /app

# اول dependency ها
COPY package*.json ./

RUN npm ci

# سورس React
COPY . .

# ساخت Production Build
RUN npm run build


# ============================================================
# Production
# ============================================================

FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
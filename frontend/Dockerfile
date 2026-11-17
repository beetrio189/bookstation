FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# vite build tự đọc .env / .env.local (VITE_* được gắn cứng vào JS lúc build)
RUN npm run build

# Chỉ còn file tĩnh: nginx phục vụ, đường dẫn lạ trả index.html (nginx.conf)
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 3000

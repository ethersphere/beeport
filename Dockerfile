FROM node:lts-alpine as builder
WORKDIR /app
COPY . .

RUN npm install
RUN npm run build

#webserver
FROM nginx:stable-alpine
ENV PORT=80
COPY --from=builder /app/out /usr/share/nginx/html
RUN chown -R nginx /usr/share/nginx/html
RUN echo "real_ip_header X-Forwarded-For;" \
    "real_ip_recursive on;" \
    "set_real_ip_from 0.0.0.0/0;" > /etc/nginx/conf.d/ip.conf
RUN sed -i '/index  index.html index.htm/c\        try_files $uri $uri/ /index.html =404;' /etc/nginx/conf.d/default.conf
RUN if [ -f /usr/share/nginx/html/404.html ]; then sed -i 's/#error_page/error_page/g' /etc/nginx/conf.d/default.conf; fi
EXPOSE ${PORT}
CMD ["nginx", "-g", "daemon off;"]

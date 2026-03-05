FROM nginx:stable-alpine

RUN rm -f /etc/nginx/conf.d/default.conf

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY security_headers.conf /etc/nginx/security_headers.conf

EXPOSE 80 443
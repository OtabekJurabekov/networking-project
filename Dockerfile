# Build stage: copy static assets (kept here for future build step extensibility)
FROM nginx:alpine AS production

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy our custom nginx config
COPY website/nginx.conf /etc/nginx/conf.d/default.conf

# Copy static website files
COPY website/ /usr/share/nginx/html/

# Remove the nginx.conf from the web root (it's not a web asset)
RUN rm /usr/share/nginx/html/nginx.conf

# Nginx listens on 80
EXPOSE 80

# Healthcheck using wget (available in alpine)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost/health || exit 1

CMD ["nginx", "-g", "daemon off;"]

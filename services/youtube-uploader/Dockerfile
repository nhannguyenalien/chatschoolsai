FROM node:22-alpine
WORKDIR /app
COPY server.js ./
ENV NODE_ENV=production UPLOADER_PORT=3000
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:3000/health || exit 1
CMD ["node", "server.js"]

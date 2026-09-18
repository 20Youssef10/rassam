FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY server.js ./
ENV STORAGE_PORT=8080
ENV STORAGE_URI=filesystem:///data
EXPOSE 8080
VOLUME ["/data"]
CMD ["node", "server.js"]

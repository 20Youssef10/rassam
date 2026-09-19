FROM node:22-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY server.js ./
ENV ROOM_PORT=3002
EXPOSE 3002
USER node
CMD ["node", "server.js"]

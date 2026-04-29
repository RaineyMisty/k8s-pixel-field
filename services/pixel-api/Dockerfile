FROM node:22-alpine

WORKDIR /app

COPY package.json ./
COPY server.js ./
COPY data ./data

ENV HOST=0.0.0.0
ENV PORT=8080
ENV DATA_DIR=/data
ENV DATA_FILE=/data/pixels.json

RUN mkdir -p /data

EXPOSE 8080

CMD ["npm", "start"]

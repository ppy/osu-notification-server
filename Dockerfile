FROM node:18-alpine

WORKDIR /app

# rarely changed dependencies installation
COPY package.json yarn.lock ./
RUN yarn

# actual build
COPY tsconfig.json .
COPY src src
RUN yarn build

ENV NOTIFICATION_SERVER_LISTEN_HOST 0.0.0.0
ENV NOTIFICATION_SERVER_LISTEN_PORT 2345
EXPOSE 2345

RUN addgroup --system osuweb && adduser --system -G osuweb osuweb
USER osuweb

CMD ["yarn", "serve"]

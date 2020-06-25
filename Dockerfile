FROM node:12-alpine

WORKDIR /app

# rarely changed dependencies installation
COPY package.json yarn.lock ./
RUN yarn

# actual build
COPY tsconfig.json .
COPY src src
RUN yarn build

ENV NOTIFICATION_SERVER_LISTEN_HOST 0.0.0.0

RUN adduser --system osuweb
USER osuweb

CMD ["yarn", "serve"]

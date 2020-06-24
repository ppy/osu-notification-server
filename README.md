# osu!notification server

## Requirements

- node 10+

## Setup

Copy (or symlink) following files from osu!web project to this project's root directory:
- `oauth-public.key` (located in `storage` in osu!web)
- `.env`

Configurations:

- Only through environment variable:
  - `WEBSOCKET_BASEDIR`: set if you need to explicitly specify path to the files above.
  - `APP_ENV`: defaults to `development`. The `.env.${APP_ENV}` file will be loaded first before `.env`.
- Either environment variable or in `.env` files:
  - Refer to `src/config.ts`.

Lastly, osu!web needs to be configured to use redis-based session.

## Run

1. `yarn`
2. `yarn build`
3. `yarn serve`

## Development

Watch and rebuild automatically with `yarn watch`. The server doesn't auto-restart though.

### Code linting (style check)

Run `yarn lint --fix` and additionally do manual fixes if needed.

### Testing

To be added.

## Docker

To build:

    # repository should be username/repository when using docker hub for convenient push
    docker build --tag <repository>:<tag> .

To run, the following items need to be passed to the container:
- environment variables: either directly using docker command or bind mount to `/app/.env`
- oauth public key: bind mount to `/app/oauth-public.key`
- listening port: for the host

Example:

    docker run \
      --rm \
      --publish 3000:3000 \
      -v /path/to/.env:/app/.env \
      -v /path/to/oauth-public.key:/app/oauth-public.key \
      -e NOTIFICATION_REDIS_HOST=redis \
      ppy/osu-notification-server:latest

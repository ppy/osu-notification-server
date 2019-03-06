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
  - `WEBSOCKET_PORT`: defaults to 3000.

Lastly, osu!web needs to be configured to use redis-based session.

## Run

1. `yarn`
2. `yarn build`
3. `yarn serve`

## Development

Watch and rebuild automatically with `yarn watch`. The server doesn't auto-restart though.

### Code linting (style check)

Run `yarn lint` and additionally do manual fixes if needed.

### Testing

To be added.

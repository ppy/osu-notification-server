// Copyright (c) ppy Pty Ltd <contact@ppy.sh>. Licensed under the GNU Affero General Public License v3.0.
// See the LICENCE file in the repository root for full licence text.

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { RedisOptions } from 'ioredis';
import { PoolOptions as DbConfig } from 'mysql2';
import { ServerOptions as ServerConfig } from 'ws';

interface Config {
  appKey: string;
  baseDir: string;
  db: DbConfig;
  dbName: DbNames;
  debug: boolean;
  env: string;
  oauthPublicKey: Buffer;
  redis: RedisConfigs;
  server: ServerConfig;
}

interface DbNames {
  chat: string;
}

interface RedisConfigs {
  app: RedisOptions;
  notification: RedisOptions;
}

let baseDir = process.env.WEBSOCKET_BASEDIR;

if (baseDir == null) {
  baseDir = path.resolve(`${__dirname}/..`);
}

const env = process.env.APP_ENV || 'development';

dotenv.config({ path: `${baseDir}/.env.${env}` });
dotenv.config({ path: `${baseDir}/.env` });

if (typeof process.env.APP_KEY !== 'string') {
  throw new Error('APP_KEY environment variable is not set.');
}

const config: Config = {
  appKey: process.env.APP_KEY,
  baseDir,
  db: {
    database: process.env.DB_DATABASE || 'osu',
    host: process.env.DB_HOST || 'localhost',
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT ? +process.env.DB_PORT : undefined,
    user: process.env.DB_USERNAME || 'osuweb',
  },
  dbName: {
    chat: process.env.DB_NAME_CHAT || 'osu_chat',
  },
  debug: process.env.APP_DEBUG === 'true',
  env,
  oauthPublicKey: process.env.PASSPORT_PUBLIC_KEY == null || process.env.PASSPORT_PUBLIC_KEY === ''
    ? fs.readFileSync(`${baseDir}/oauth-public.key`)
    : Buffer.from(process.env.PASSPORT_PUBLIC_KEY),
  redis: {
    app: {
      db: +(process.env.REDIS_DB || 0),
      host: process.env.REDIS_HOST || '127.0.0.1',
      password: process.env.REDIS_PASSWORD,
      port: +(process.env.REDIS_PORT || 6379),
    },
    notification: {
      db: +(process.env.NOTIFICATION_REDIS_DB || 0),
      host: process.env.NOTIFICATION_REDIS_HOST || '127.0.0.1',
      password: process.env.NOTIFICATION_REDIS_PASSWORD,
      port: +(process.env.NOTIFICATION_REDIS_PORT || 6379),
    },
  },
  server: {
    host: process.env.NOTIFICATION_SERVER_LISTEN_HOST || '127.0.0.1',
    port: +(process.env.NOTIFICATION_SERVER_LISTEN_PORT || 2345),
  },
};

export default config;

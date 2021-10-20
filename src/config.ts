/**
 *    Copyright (c) ppy Pty Ltd <contact@ppy.sh>.
 *
 *    This file is part of osu!web. osu!web is distributed with the hope of
 *    attracting more community contributions to the core ecosystem of osu!.
 *
 *    osu!web is free software: you can redistribute it and/or modify
 *    it under the terms of the Affero GNU General Public License version 3
 *    as published by the Free Software Foundation.
 *
 *    osu!web is distributed WITHOUT ANY WARRANTY; without even the implied
 *    warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 *    See the GNU Affero General Public License for more details.
 *
 *    You should have received a copy of the GNU Affero General Public License
 *    along with osu!web.  If not, see <http://www.gnu.org/licenses/>.
 */

import * as path from 'path';
import * as dotenv from 'dotenv';
import { PoolOptions as DbConfig } from 'mysql2';
import { ClientOpts as RedisConfig, RetryStrategyOptions as RedisRetryStrategyOptions } from 'redis';
import { ServerOptions as ServerConfig } from 'ws';

interface Config {
  appKey: string;
  baseDir: string;
  db: DbConfig;
  dbName: DbNames;
  debug: boolean;
  env: string;
  redis: RedisConfigs;
  server: ServerConfig;
}

interface DbNames {
  chat: string;
}

interface RedisConfigs {
  app: RedisConfig;
  notification: RedisConfig;
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

const redisRetry = (type: string) => (options: RedisRetryStrategyOptions) => {
  const wait = 1000; // in milliseconds
  const maxAttempts = 60;

  if (options.attempt > maxAttempts) {
    throw new Error(`Failed connecting to redis (${type})`);
  }

  return wait;
};

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
  redis: {
    app: {
      host: process.env.REDIS_HOST,
      port: +(process.env.REDIS_PORT || 6379),
      retry_strategy: redisRetry('app'),
    },
    notification: {
      host: process.env.NOTIFICATION_REDIS_HOST,
      port: +(process.env.NOTIFICATION_REDIS_PORT || 6379),
      retry_strategy: redisRetry('notification'),
    },
  },
  server: {
    host: process.env.NOTIFICATION_SERVER_LISTEN_HOST || '127.0.0.1',
    port: +(process.env.NOTIFICATION_SERVER_LISTEN_PORT || 2345),
  },
};

export default config;

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

import * as dotenv from 'dotenv';
import * as http from 'http';
import * as mysql from 'mysql2/promise';
import * as path from 'path';
import 'source-map-support/register';
import * as WebSocket from 'ws';
import LaravelSession from './laravel-session';
import logger from './logger';
import OAuthVerifier from './oauth-verifier';
import RedisSubscriber from './redis-subscriber';
import UserConnection from './user-connection';

// helper functions
const getUserSession = async (req: http.IncomingMessage) => {
  let userSession = await oAuthVerifier.verifyRequest(req);

  if (userSession == null) {
    userSession = await laravelSession.verifyRequest(req);
  }

  if (userSession == null) {
    throw new Error('Authentication failed');
  }

  return userSession;
};

// env loading
let baseDir = process.env.WEBSOCKET_BASEDIR;

if (baseDir == null) {
  baseDir = path.resolve(`${__dirname}/..`);
}

const env = process.env.APP_ENV || 'development';
dotenv.config({path: `${baseDir}/.env.${env}`});
dotenv.config({path: `${baseDir}/.env`});

if (typeof process.env.APP_KEY !== 'string') {
  throw new Error('APP_KEY environment variable is not set.');
}

// variables
const db = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT == null ? undefined : +process.env.DB_PORT,

  password: process.env.DB_PASSWORD,
  user: process.env.DB_USERNAME || 'osuweb',

  database: process.env.DB_DATABASE || 'osu',
});

const redisSubscriber = new RedisSubscriber({
  host: process.env.REDIS_HOST_BROADCAST,
  port: process.env.REDIS_PORT_BROADCAST == null ? 6379 : +process.env.REDIS_PORT_BROADCAST,
});

const oAuthVerifier = new OAuthVerifier({
  baseDir,
  db,
});

const laravelSession = new LaravelSession({
  appKey: process.env.APP_KEY,
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT == null ? 6379 : +process.env.REDIS_PORT,
});

// initialise server
const port = process.env.WEBSOCKET_PORT == null ? 3000 : +process.env.WEBSOCKET_PORT;
const wss = new WebSocket.Server({port});
logger(`listening on ${port}`);

wss.on('connection', async (ws: WebSocket, req: http.IncomingMessage) => {
  let userSession;

  try {
    userSession = await getUserSession(req);
  } catch (err) {
    ws.send('authentication failed');
    ws.close();
    return;
  }

  const connection = new UserConnection(userSession, {db, redisSubscriber, ws});

  connection.boot();
});

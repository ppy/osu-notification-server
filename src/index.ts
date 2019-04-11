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

import * as http from 'http';
import * as mysql from 'mysql2/promise';
import 'source-map-support/register';
import * as WebSocket from 'ws';
import config from './config';
import LaravelSession from './laravel-session';
import logger from './logger';
import OAuthVerifier from './oauth-verifier';
import RedisSubscriber from './redis-subscriber';
import UserSession from './types/user-session';
import UserConnection from './user-connection';

// helper functions
const getIp = (req: http.IncomingMessage) => {
  let ret = req.connection.remoteAddress;

  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor !== '') {
    ret = forwardedFor.split(/\s*,\s*/)[0];
  }

  return ret;
};

const getUserSession = async (req: http.IncomingMessage) => {
  let userSession: UserSession | undefined = await oAuthVerifier.verifyRequest(req);

  if (userSession == null) {
    userSession = await laravelSession.verifyRequest(req);
  }

  if (userSession == null) {
    throw new Error('Authentication failed');
  }

  userSession.ip = getIp(req);

  return userSession;
};

// variables
const db = mysql.createPool(config.db);
const redisSubscriber = new RedisSubscriber(config.redis.notification);
const oAuthVerifier = new OAuthVerifier({ baseDir: config.baseDir, db });
const laravelSession = new LaravelSession({ appKey: config.appKey, ...config.redis.app });

// initialise server
const wss = new WebSocket.Server(config.server);
logger.info(`listening on ${config.server.host}:${config.server.port}`);

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

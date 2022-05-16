// Copyright (c) ppy Pty Ltd <contact@ppy.sh>. Licensed under the GNU Affero General Public License v3.0.
// See the LICENCE file in the repository root for full licence text.

import * as http from 'http';
import { StatsD } from 'hot-shots';
import * as mysql from 'mysql2/promise';
import 'source-map-support/register';
import * as WebSocket from 'ws';
import config from './config';
import LaravelSession from './laravel-session';
import logger from './logger';
import noop from './noop';
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
  const ip = getIp(req);
  let failReason = '';
  let userSession: UserSession | null = null;

  try {
    userSession = await oAuthVerifier.verifyRequest(req);

    if (userSession == null) {
      userSession = await laravelSession.verifyRequest(req);
    }
  } catch (err) {
    failReason = err.message;
  }

  if (userSession == null) {
    logger.info(`authentication failed from ${ip}: ${failReason || 'missing authentication header/cookie'}`);

    throw new Error('Authentication failed');
  }

  userSession.ip = ip;

  return userSession;
};

// variables
const authenticationFailedMessage = JSON.stringify({ error: 'authentication failed' });
const db = mysql.createPool(config.db);
const dogstatsd = new StatsD({ prefix: 'osu.notification.' });
const redisSubscriber = new RedisSubscriber({ dogstatsd, redisConfig: config.redis.notification });
const oAuthVerifier = new OAuthVerifier({ db, publicKey: config.oauthPublicKey });
const laravelSession = new LaravelSession({ appKey: config.appKey, redisConfig: config.redis.app });

// initialise server
const wss = new WebSocket.Server(config.server);
logger.info(`listening on ${config.server.host}:${config.server.port}`);

wss.on('connection', (ws: WebSocket, req: http.IncomingMessage) => {
  ws.on('error', (error) => logger.info('websocket error:', error));

  getUserSession(req).then((session) => {
    const connection = new UserConnection({ db, redisSubscriber, session, ws });

    connection.boot();
  }).catch(() => {
    ws.send(authenticationFailedMessage, noop);
    ws.terminate();
  });
});

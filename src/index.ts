// Copyright (c) ppy Pty Ltd <contact@ppy.sh>. Licensed under the GNU Affero General Public License v3.0.
// See the LICENCE file in the repository root for full licence text.

import * as http from 'http';
import { StatsD } from 'hot-shots';
import * as mysql from 'mysql2/promise';
import { WebSocketServer } from 'ws';
import config from './config.js';
import LaravelSession from './laravel-session.js';
import logger from './logger.js';
import noop from './noop.js';
import OAuthVerifier from './oauth-verifier.js';
import RedisSubscriber from './redis-subscriber.js';
import UserSession from './types/user-session.js';
import UserConnection from './user-connection.js';

// helper functions
const getIp = (req: http.IncomingMessage) => {
  let ret = req.socket.remoteAddress;

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
  } catch (err: unknown) {
    failReason = (err as Error).message;
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
const connectionReadyMessage = JSON.stringify({ event: 'connection.ready' });
const db = mysql.createPool(config.db);
const dogstatsd = new StatsD({ prefix: 'osu.notification.' });
const redisSubscriber = new RedisSubscriber({ dogstatsd, redisConfig: config.redis.notification });
const oAuthVerifier = new OAuthVerifier({ db, publicKey: config.oauthPublicKey });
const laravelSession = new LaravelSession({
  appKey: config.appKey,
  redisConfig: config.redis.app,
  sessionPrefix: config.sessionPrefix,
});

// initialise server
const wss = new WebSocketServer(config.server);
logger.info(`listening on ${config.server.host}:${config.server.port}`);

wss.on('connection', (ws, req) => {
  ws.on('error', (error) => logger.info('websocket error:', error));

  getUserSession(req).then((session) => {
    const connection = new UserConnection({ db, redisSubscriber, session, ws });

    connection.boot();
    ws.send(connectionReadyMessage, noop);
  }).catch(() => {
    ws.send(authenticationFailedMessage, noop);
    ws.terminate();
  });
});

// Copyright (c) ppy Pty Ltd <contact@ppy.sh>. Licensed under the GNU Affero General Public License v3.0.
// See the LICENCE file in the repository root for full licence text.

import * as mysql from 'mysql2/promise';
import * as WebSocket from 'ws';
import logger from './logger';
import noop from './noop';
import RedisSubscriber from './redis-subscriber';
import Message from './types/message';
import UserSession from './types/user-session';

interface Params {
  db: mysql.Pool;
  redisSubscriber: RedisSubscriber;
  session: UserSession;
  ws: WebSocket;
}

export default class UserConnection {
  get isActive() {
    return this.active;
  }

  private active = false;
  private heartbeatInterval?: NodeJS.Timeout;
  private lastHeartbeat = false;
  private redisSubscriber: RedisSubscriber;
  private session: UserSession;
  private ws: WebSocket;

  constructor(params: Params) {
    this.redisSubscriber = params.redisSubscriber;
    this.session = params.session;
    this.ws = params.ws;
  }

  boot = () => {
    this.active = true;
    this.lastHeartbeat = true;
    this.subscribe();
    this.ws.on('close', this.close);
    this.ws.on('pong', this.heartbeatOnline);
    this.heartbeatInterval = setInterval(this.heartbeat, 20000);
    logger.debug(`user ${this.session.userId} (${this.session.ip}) connected`);
  };

  close = () => {
    if (this.active) {
      logger.debug(`user ${this.session.userId} (${this.session.ip}) disconnected`);
    }

    this.active = false;
    this.ws.terminate();
    this.redisSubscriber.unsubscribe(null, this);

    if (this.heartbeatInterval != null) {
      clearInterval(this.heartbeatInterval);
    }
  };

  event = (channel: string, messageString: string, message: Message) => {
    switch (channel) {
      case this.userSessionChannel():
        return this.sessionCheck(message);
      default:
        if (this.session.requiresVerification && !this.session.verified) {
          return;
        }

        logger.debug(`sending event ${message.event} to ${this.session.userId} (${this.session.ip})`);
        if (typeof message.data !== 'object') {
          return;
        }

        this.ws.send(messageString, noop);
    }
  };

  heartbeat = () => {
    if (!this.lastHeartbeat || !this.active) {
      logger.debug(`user ${this.session.userId} (${this.session.ip}) no ping response`);
      this.close();
      return;
    }

    this.lastHeartbeat = false;
    this.ws.ping(noop);
  };

  heartbeatOnline = () => {
    this.lastHeartbeat = true;
  };

  sessionCheck = (message: Message) => {
    switch (message.event) {
      case 'logout':
        for (const key of message.data.keys) {
          if (key === this.session.key) {
            this.ws.send(JSON.stringify({ event: 'logout' }), () => {
              logger.debug(`user ${this.session.userId} (${this.session.ip}) logged out`);
              this.ws.close();
            });
          }
        }
        break;
      case 'verification_requirement_change':
        this.session.requiresVerification = message.data.requires_verification;
        break;
      case 'verified':
        if (message.data.key === this.session.key) {
          this.session.verified = true;
          this.ws.send(JSON.stringify({ event: 'verified' }), noop);
        }
        break;
    }
  };

  subscribe = () => {
    this.redisSubscriber.subscribe(this.subscriptions(), this);
  };

  subscriptions = () => [
    `notification_read:${this.session.userId}`,
    this.userSessionChannel(),
    `private:user:${this.session.userId}`,
  ];

  userSessionChannel = () => `user_session:${this.session.userId}`;
}

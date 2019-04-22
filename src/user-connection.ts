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

import * as mysql from 'mysql2/promise';
import * as WebSocket from 'ws';
import logger from './logger';
import RedisSubscriber from './redis-subscriber';
import UserSession from './types/user-session';

interface UserConnectionConfig {
  db: mysql.Pool;
  redisSubscriber: RedisSubscriber;
  ws: WebSocket;
}

function ignoreError() {
  // do nothing with the error
}

export default class UserConnection {
  private active: boolean = false;
  private config: UserConnectionConfig;
  private pingTimeout?: NodeJS.Timeout;
  private session: UserSession;

  constructor(session: UserSession, config: UserConnectionConfig) {
    this.config = config;
    this.session = session;
  }

  boot = () => {
    this.active = true;
    this.subscribe();
    this.config.ws.on('close', this.close);
    this.config.ws.on('pong', this.delayedPing);
    this.delayedPing();
    logger.debug(`user ${this.session.userId} (${this.session.ip}) connected`);
  }

  close = () => {
    logger.debug(`user ${this.session.userId} (${this.session.ip}) disconnected`);

    this.active = false;
    this.config.redisSubscriber.unsubscribe(null, this);

    if (this.pingTimeout != null) {
      clearTimeout(this.pingTimeout);
    }
  }

  delayedPing = () => {
    this.pingTimeout = setTimeout(() => {
      this.config.ws.ping(ignoreError);
    }, 10000);
  }

  event = (channel: string, messageString: string) => {
    const message = JSON.parse(messageString);

    switch (channel) {
      case this.subscriptionUpdateChannel():
        this.updateSubscription(message);
        break;
      case this.userSessionChannel():
        this.sessionCheck(message);
        break;
      default:
        logger.debug(`sending event ${message.event} to ${this.session.userId} (${this.session.ip})`);
        if (typeof message.data === 'object' && message.data.source_user_id !== this.session.userId) {
          this.config.ws.send(messageString, ignoreError);
        }
    }
  }

  sessionCheck = (message: any) => {
    if (message.event === 'logout') {
      for (const key of message.data.keys) {
        if (key === this.session.key) {
          this.config.ws.send(JSON.stringify({ event: 'logout' }), () => {
            logger.debug(`user ${this.session.userId} (${this.session.ip}) logged out`);
            this.config.ws.close();
          });
        }
      }
    }
  }

  subscribe = async () => {
    const subscriptions = await this.subscriptions();

    // may be closed during await above
    if (!this.active) {
      return;
    }

    this.config.redisSubscriber.subscribe(subscriptions, this);
  }

  subscriptionUpdateChannel = () => {
    return `user_subscription:${this.session.userId}`;
  }

  subscriptions = async () => {
    const ret = [];

    const forumTopic = this.forumTopicSubscriptions();
    const beatmapset = this.beatmapsetSubscriptions();

    ret.push(...await forumTopic);
    ret.push(...await beatmapset);
    ret.push(`notification_read:${this.session.userId}`);
    ret.push(this.subscriptionUpdateChannel());
    ret.push(this.userSessionChannel());

    return ret;
  }

  updateSubscription = (message: any) => {
    const action = message.event === 'remove' ? 'unsubscribe' : 'subscribe';

    logger.debug(`user ${this.session.userId} (${this.session.ip}) ${action} to ${message.data.channel}`);
    this.config.redisSubscriber[action](message.data.channel, this);
  }

  userSessionChannel = () => {
    return `user_session:${this.session.userId}`;
  }

  private beatmapsetSubscriptions = async () => {
    const [rows, fields] = await this.config.db.execute(`
      SELECT beatmapset_id
      FROM beatmapset_watches
      WHERE user_id = ?
    `, [this.session.userId]);

    return rows.map((row: any) => {
      return `new:beatmapset:${row.beatmapset_id}`;
    });
  }

  private forumTopicSubscriptions = async () => {
    const [rows, fields] = await this.config.db.execute(`
      SELECT topic_id
      FROM phpbb_topics_watch
      WHERE user_id = ?
        AND mail = true
    `, [this.session.userId]);

    return rows.map((row: any) => {
      return `new:forum_topic:${row.topic_id}`;
    });
  }
}

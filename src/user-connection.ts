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
import RedisSubscriber from './redis-subscriber';

interface UserConnectionConfig {
  db: mysql.Pool;
  redisSubscriber: RedisSubscriber;
  ws: WebSocket;
}

interface UserSession {
  key: string;
  userId: number;
}

export default class UserConnection {
  private config: UserConnectionConfig;
  private pingTimeout?: NodeJS.Timeout;
  private session: UserSession;

  constructor(session: UserSession, config: UserConnectionConfig) {
    this.config = config;
    this.session = session;
  }

  boot = () => {
    this.subscribe();
    this.config.ws.on('close', this.close);
    this.config.ws.on('pong', this.delayedPing);
    this.delayedPing();
  }

  close = () => {
    this.config.redisSubscriber.unsubscribe(null, this);

    if (this.pingTimeout != null) {
      clearTimeout(this.pingTimeout);
    }
  }

  delayedPing = () => {
    this.pingTimeout = setTimeout(() => {
      if (this.isActive()) {
        this.config.ws.ping();
      }
    }, 10000);
  }

  event = (channel: string, message: string) => {
    if (!this.isActive()) {
      return;
    }

    switch (channel) {
      case this.subscriptionUpdateChannel():
        this.updateSubscription(message);
        break;
      case this.userSessionChannel():
        this.sessionCheck(message);
      default:
        this.config.ws.send(message);
    }
  }

  isActive = () => {
    return this.config.ws.readyState === WebSocket.OPEN;
  }

  sessionCheck = (messageString: string) => {
    if (!this.isActive()) {
      return;
    }

    const message = JSON.parse(messageString);
    if (message.event === 'logout') {
      for (const key of message.data.keys) {
        if (key === this.session.key) {
          this.config.ws.close();
        }
      }
    }
  }

  subscribe = async () => {
    const subscriptions = await this.subscriptions();
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

  updateSubscription = (message: string) => {
    const data = JSON.parse(message).data;
    const action = data.action === 'remove' ? 'unsubscribe' : 'subscribe';

    this.config.redisSubscriber[action](data.channel, this);
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
    `, [this.session.userId]);

    return rows.map((row: any) => {
      return `new:forum_topic:${row.topic_id}`;
    });
  }
}

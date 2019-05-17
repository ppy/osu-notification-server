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
import config from './config';
import logger from './logger';
import RedisSubscriber from './redis-subscriber';
import UserSession from './types/user-session';

interface Params {
  db: mysql.Pool;
  redisSubscriber: RedisSubscriber;
  session: UserSession;
  ws: WebSocket;
}

function ignoreError() {
  // do nothing with the error
}

export default class UserConnection {
  get isActive() {
    return this.active;
  }

  private active: boolean = false;
  private db: mysql.Pool;
  private heartbeatInterval?: NodeJS.Timeout;
  private lastHeartbeat: boolean = false;
  private redisSubscriber: RedisSubscriber;
  private session: UserSession;
  private ws: WebSocket;

  constructor(params: Params) {
    this.db = params.db;
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
  }

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
  }

  event = (channel: string, messageString: string, message: any) => {
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
          this.ws.send(messageString, ignoreError);
        }
    }
  }

  heartbeat = () => {
    if (!this.lastHeartbeat || !this.active) {
      logger.debug(`user ${this.session.userId} (${this.session.ip}) no ping response`);
      this.close();
      return;
    }

    this.lastHeartbeat = false;
    this.ws.ping(ignoreError);
  }

  heartbeatOnline = () => {
    this.lastHeartbeat = true;
  }

  sessionCheck = (message: any) => {
    if (message.event === 'logout') {
      for (const key of message.data.keys) {
        if (key === this.session.key) {
          this.ws.send(JSON.stringify({ event: 'logout' }), () => {
            logger.debug(`user ${this.session.userId} (${this.session.ip}) logged out`);
            this.ws.close();
          });
        }
      }
    }
  }

  subscribe = async () => {
    const subscriptions = await this.subscriptions();

    this.redisSubscriber.subscribe(subscriptions, this);
  }

  subscriptions = async () => {
    const ret = [];

    const forumTopic = this.forumTopicSubscriptions();
    const beatmapset = this.beatmapsetSubscriptions();
    const chatChannels = this.chatSubscriptions();

    ret.push(...await forumTopic);
    ret.push(...await beatmapset);
    ret.push(...await chatChannels);
    ret.push(`notification_read:${this.session.userId}`);
    ret.push(this.subscriptionUpdateChannel());
    ret.push(this.userSessionChannel());

    return ret;
  }

  subscriptionUpdateChannel = () => {
    return `user_subscription:${this.session.userId}`;
  }

  updateSubscription = (message: any) => {
    const action = message.event === 'remove' ? 'unsubscribe' : 'subscribe';

    logger.debug(`user ${this.session.userId} (${this.session.ip}) ${action} to ${message.data.channel}`);
    this.redisSubscriber[action](message.data.channel, this);
  }

  userSessionChannel = () => {
    return `user_session:${this.session.userId}`;
  }

  private beatmapsetSubscriptions = async () => {
    const [rows, fields] = await this.db.execute(`
      SELECT beatmapset_id
      FROM beatmapset_watches
      WHERE user_id = ?
    `, [this.session.userId]);

    return rows.map((row: any) => {
      return `new:beatmapset:${row.beatmapset_id}`;
    });
  }

  private chatSubscriptions = async () => {
    const chatDb = config.dbName.chat;
    const [rows, fields] = await this.db.execute(`
      SELECT ${chatDb}.user_channels.channel_id
      FROM ${chatDb}.user_channels
      JOIN ${chatDb}.channels on ${chatDb}.channels.channel_id = ${chatDb}.user_channels.channel_id
      WHERE ${chatDb}.user_channels.user_id = ?
      AND ${chatDb}.channels.type IN (
        'PM'
      );
    `, [this.session.userId]);

    return rows.map((row: any) => {
      return `new:channel:${row.channel_id}`;
    });
  }

  private forumTopicSubscriptions = async () => {
    const [rows, fields] = await this.db.execute(`
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

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

import * as redis from 'redis';
import logger from './logger';
import UserConnection from './user-connection';

interface UserConnections {
  [key: string]: Set<UserConnection>;
}

export default class RedisSubscriber {
  private userConnections: UserConnections;
  private redis: redis.RedisClient;

  constructor(config: redis.ClientOpts) {
    this.redis = redis.createClient(config);
    this.redis.on('message', (channel: string, message: string) => {
      logger.debug(`received message from channel ${channel}`);

      if (this.userConnections[channel] == null) {
        return;
      }

      this.userConnections[channel].forEach((connection) => connection.event(channel, message));
    });

    this.userConnections = {};
  }

  subscribe(channels: string | string[], connection: UserConnection) {
    if (!connection.isActive) {
      return;
    }

    if (!Array.isArray(channels)) {
      channels = [channels];
    }

    const toSubscribe = [];

    for (const channel of channels) {
      if (this.userConnections[channel] == null) {
        this.userConnections[channel] = new Set();
      }

      if (this.userConnections[channel].size === 0) {
        toSubscribe.push(channel);
      }

      this.userConnections[channel].add(connection);
    }

    if (toSubscribe.length > 0) {
      this.redis.subscribe(...toSubscribe);
    }
  }

  unsubscribe(channels: string | string[] | null, connection: UserConnection) {
    if (channels == null) {
      channels = Object.keys(this.userConnections);
    }

    if (!Array.isArray(channels)) {
      channels = [channels];
    }

    const toUnsubscribe = [];

    for (const channel of channels) {
      if (this.userConnections[channel].size === 0) {
        continue;
      }

      this.userConnections[channel].delete(connection);

      if (this.userConnections[channel].size === 0) {
        toUnsubscribe.push(channel);
      }
    }

    if (toUnsubscribe.length > 0) {
      this.redis.unsubscribe(...toUnsubscribe);
    }
  }
}

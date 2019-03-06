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
import UserConnection from './user-connection';

interface Config {
  host?: string;
  port?: number;
}

interface UserConnections {
  [key: string]: UserConnection[];
}

export default class RedisSubscriber {
  private userConnections: UserConnections;
  private redis: redis.RedisClient;

  constructor(config: Config) {
    this.redis = redis.createClient(config);
    this.redis.on('message', (channel: string, message: string) => {
      if (this.userConnections[channel] == null) {
        return;
      }

      this.userConnections[channel].forEach((connection) => connection.event(channel, message));
    });

    this.userConnections = {};
  }

  public subscribe(channels: string | string[], connection: UserConnection) {
    const toSubscribe = [];

    if (typeof channels === 'string') {
      channels = [channels];
    }

    for (const channel of channels) {
      if (this.userConnections[channel] == null) {
        this.userConnections[channel] = [];
      }

      if (this.userConnections[channel].length === 0) {
        toSubscribe.push(channel);
      }

      this.userConnections[channel].push(connection);
    }

    this.redis.subscribe(...toSubscribe);
  }

  public unsubscribe(channels: string | string[] | null, connection: UserConnection) {
    const toUnsubscribe = [];

    if (typeof channels === 'string') {
      channels = [channels];
    }

    if (channels == null) {
      channels = Object.keys(this.userConnections);
    }

    for (const channel of channels) {
      if (this.userConnections[channel].length === 0) {
        continue;
      }

      this.userConnections[channel] = this.userConnections[channel]
        .filter((regConnection: UserConnection) => regConnection !== connection);

      if (this.userConnections[channel].length === 0) {
        toUnsubscribe.push(channel);
      }
    }

    this.redis.unsubscribe(...toUnsubscribe);
  }
}

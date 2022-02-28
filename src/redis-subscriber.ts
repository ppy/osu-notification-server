// Copyright (c) ppy Pty Ltd <contact@ppy.sh>. Licensed under the GNU Affero General Public License v3.0.
// See the LICENCE file in the repository root for full licence text.

import { StatsD } from 'hot-shots';
import * as redis from 'redis';
import logger from './logger';
import Message from './types/message';
import UserConnection from './user-connection';

interface Params {
  dogstatsd: StatsD;
  redisConfig: redis.ClientOpts;
}

interface UserConnections {
  [key: string]: Set<UserConnection>;
}

export default class RedisSubscriber {
  private dogstatsd: StatsD;
  private redis: redis.RedisClient;
  private userConnections: UserConnections = {};

  constructor(params: Params) {
    this.dogstatsd = params.dogstatsd;
    this.redis = redis.createClient(params.redisConfig);
    this.redis.on('message', this.onMessage);
  }

  onMessage = (channel: string, messageString: string) => {
    logger.debug(`received message from channel ${channel}`);

    const connections = this.userConnections[channel];

    if (connections == null || connections.size === 0) {
      return;
    }

    try {
      // assume typing is correct if it parses, for now.
      const message = JSON.parse(messageString) as Message;

      connections.forEach((connection) => connection.event(channel, messageString, message));
      this.dogstatsd.increment('sent', connections.size);
    } catch {
      // do nothing
      // TODO: log error?
    }
  };

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
      const connections = this.userConnections[channel];

      if (connections != null) {
        connections.delete(connection);
      }

      if (connections == null || connections.size === 0) {
        delete this.userConnections[channel];
        toUnsubscribe.push(channel);
      }
    }

    if (toUnsubscribe.length > 0) {
      this.redis.unsubscribe(...toUnsubscribe);
    }
  }
}

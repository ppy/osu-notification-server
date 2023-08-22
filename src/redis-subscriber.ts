// Copyright (c) ppy Pty Ltd <contact@ppy.sh>. Licensed under the GNU Affero General Public License v3.0.
// See the LICENCE file in the repository root for full licence text.

import { StatsD } from 'hot-shots';
import { RedisClientOptions, createClient } from 'redis';
import logger from './logger';
import Message from './types/message';
import UserConnection from './user-connection';

interface Params {
  dogstatsd: StatsD;
  redisConfig: RedisClientOptions;
}

export default class RedisSubscriber {
  private dogstatsd: StatsD;
  private redis;
  private userConnections: Partial<Record<string, Set<UserConnection>>> = {};

  constructor(params: Params) {
    this.dogstatsd = params.dogstatsd;
    this.redis = createClient(params.redisConfig);
    this.redis.on('error', () => { /* dummy listener to apply reconnectStrategy */ });
    void this.redis.connect();
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
      const set = this.userConnections[channel] ??= new Set();
      if (set.size === 0) {
        toSubscribe.push(channel);
      }

      set.add(connection);
    }

    if (toSubscribe.length > 0) {
      for (const channel of toSubscribe) {
        void this.redis.subscribe(channel, this.onMessage);
      }
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
      void this.redis.unsubscribe(toUnsubscribe);
    }
  }

  private readonly onMessage = (messageString: string, channel: string) => {
    logger.debug(`received message from channel ${channel}`);

    const connections = this.userConnections[channel];

    if (connections == null || connections.size === 0) {
      return;
    }

    try {
      // assume typing is correct if it parses, for now.
      const message = JSON.parse(messageString) as Message;

      connections.forEach((connection) => connection.event(channel, messageString, message));
      this.dogstatsd.increment('sent', connections.size, { event: message.event });
    } catch {
      // do nothing
      // TODO: log error?
    }
  };
}

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

import UserConnectionConfig from "./types/user-connection-config";

export default class UserConnection {
  private config: UserConnectionConfig;
  private userId: number;

  constructor(userId: number, config: UserConnectionConfig) {
    this.config = config;
    this.userId = userId;
  }

  public boot = () => {
    this.subscribe();
    this.config.ws.on("close", this.close);
  }

  public close = () => {
    this.config.redisSubscriber.unsubscribeAll(this);
  }

  public event = (channel: string, message: string) => {
    switch (channel) {
      case this.subscriptionUpdateChannel():
        this.updateSubscription(message);
        break;
    }
  }

  public subscribe = async () => {
    const subscriptions = await this.subscriptions();
    this.config.redisSubscriber.subscribe(subscriptions, this);
  }

  public subscriptionUpdateChannel = () => {
    return `user_subscription:${this.userId}`;
  }

  public subscriptions = async () => {
    const ret = [];

    const forumTopic = this.forumTopicSubscriptions();
    const beatmapset = this.beatmapsetSubscriptions();

    ret.push(...await forumTopic);
    ret.push(...await beatmapset);
    ret.push(this.subscriptionUpdateChannel());

    return ret;
  }

  public updateSubscription = (message: string) => {
    const data = JSON.parse(message).data;
    const action = data.action === "remove" ? "unsubscribe" : "subscribe";

    this.config.redisSubscriber[action](data.channel, this);
  }

  private beatmapsetSubscriptions = async () => {
    const [rows, fields] = await this.config.db.execute(`
      SELECT beatmapset_id
      FROM beatmapset_watches
      WHERE user_id = ?
    `, [this.userId]);

    return rows.map((row: any) => {
      return `beatmapset:${row.beatmapset_id}`;
    });
  }

  private forumTopicSubscriptions = async () => {
    const [rows, fields] = await this.config.db.execute(`
      SELECT topic_id
      FROM phpbb_topics_watch
      WHERE user_id = ?
    `, [this.userId]);

    return rows.map((row: any) => {
      return `forum_topic:${row.topic_id}`;
    });
  }
}

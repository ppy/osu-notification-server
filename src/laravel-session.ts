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

import * as cookie from 'cookie';
import * as crypto from 'crypto';
import * as http from 'http';
import { unserialize } from 'php-serialize';
import * as redis from 'redis';
import * as url from 'url';
import { promisify } from 'util';

interface Params {
  appKey: string;
  redisConfig: redis.ClientOpts;
}

interface EncryptedSession {
  iv: string;
  mac: string;
  value: string;
}

interface Session {
  csrf: string;
  key: string;
  userId: number;
}

const isEncryptedSession = (arg: any): arg is EncryptedSession => {
  if (typeof arg !== 'object') {
    return false;
  }

  return typeof arg.iv === 'string' &&
    typeof arg.value === 'string' &&
    typeof arg.mac === 'string';
};

const getCookie = (req: http.IncomingMessage, key: string) => {
  if (req.headers.cookie != null) {
    return cookie.parse(req.headers.cookie)[key];
  }
};

export default class LaravelSession {
  private key: Buffer;
  private redis: redis.RedisClient;
  private redisGet: any;

  constructor(params: Params) {
    this.redis = redis.createClient(params.redisConfig);
    this.redisGet = promisify(this.redis.get).bind(this.redis);
    this.key = Buffer.from(params.appKey.slice('base64:'.length), 'base64');
  }

  async getSessionDataFromRequest(req: http.IncomingMessage): Promise<Session | null> {
    const key = this.keyFromSession(getCookie(req, 'osu_session'));

    if (key == null) {
      return null;
    }

    const serializedData = await this.redisGet(key);

    const rawData = unserialize(unserialize(serializedData), {}, {strict: false});

    return {
      csrf: rawData._token,
      key,
      // login_<authName>_<hashedAuthClass>
      userId: rawData.login_web_59ba36addc2b2f9401580f014c7f58ea4e30989d,
    };
  }

  keyFromSession(session: string = '') {
    if (session == null || session === '') {
      return;
    }

    let encryptedSession;
    try {
      encryptedSession = JSON.parse(
        Buffer.from(session, 'base64').toString(),
      );
    } catch (err) {
      throw new Error('Failed parsing session data');
    }

    if (!isEncryptedSession(encryptedSession)) {
      throw new Error('Session data is missing required fields');
    }

    this.verifyHmac(encryptedSession);

    return `osu-next:${this.decrypt(encryptedSession)}`;
  }

  async verifyRequest(req: http.IncomingMessage) {
    if (req.url == null) {
      return null;
    }

    const session = await this.getSessionDataFromRequest(req);

    if (session == null || session.userId == null) {
      return null;
    }

    let csrf;
    const params = url.parse(req.url, true).query;

    if (typeof params.csrf !== 'string' || params.csrf === '') {
      throw new Error('missing csrf token');
    }

    csrf = Buffer.from(params.csrf);

    let hasValidToken;

    try {
      hasValidToken = crypto.timingSafeEqual(Buffer.from(session.csrf), csrf);
    } catch (err) {
      throw new Error(`failed checking csrf token: ${err.message}`);
    }

    if (hasValidToken) {
      return {
        key: session.key,
        userId: session.userId,
      };
    } else {
      throw new Error('invalid csrf token');
    }
  }

  private decrypt(encryptedSession: EncryptedSession) {
    const iv = Buffer.from(encryptedSession.iv, 'base64');
    const value = Buffer.from(encryptedSession.value, 'base64');
    const decrypter = crypto.createDecipheriv('AES-256-CBC', this.key, iv);

    return Buffer.concat([decrypter.update(value), decrypter.final()]).toString();
  }

  private verifyHmac(session: EncryptedSession) {
    const reference = Buffer.from(session.mac, 'hex');
    const computed = crypto
      .createHmac('sha256', this.key)
      .update(`${session.iv}${session.value}`)
      .digest();

    if (!crypto.timingSafeEqual(computed, reference)) {
      throw new Error('Session data failed HMAC verification');
    }
  }
}

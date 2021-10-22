/**
 * Copyright (c) ppy Pty Ltd <contact@ppy.sh>.
 *
 * This file is part of osu!web. osu!web is distributed with the hope of
 * attracting more community contributions to the core ecosystem of osu!.
 *
 * osu!web is free software: you can redistribute it and/or modify
 * it under the terms of the Affero GNU General Public License version 3
 * as published by the Free Software Foundation.
 *
 * osu!web is distributed WITHOUT ANY WARRANTY; without even the implied
 * warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with osu!web.  If not, see <http://www.gnu.org/licenses/>.
 */

import * as fs from 'fs';
import * as http from 'http';
import * as url from 'url';
import * as jwt from 'jsonwebtoken';
import * as mysql from 'mysql2/promise';

interface Params {
  baseDir: string;
  db: mysql.Pool;
}

interface OAuthJWT {
  aud: string;
  iat: number;
  jti: string;
  nbf: number;
  scopes: string[];
  sub: string;
}

const isOAuthJWT = (arg: unknown): arg is OAuthJWT => typeof arg === 'object';

export default class OAuthVerifier {
  db: mysql.Pool;
  oAuthTokenSignatureKey: Buffer;

  constructor(params: Params) {
    this.db = params.db;
    this.oAuthTokenSignatureKey = fs.readFileSync(`${params.baseDir}/oauth-public.key`);
  }

  getToken = (req: http.IncomingMessage) => {
    let token;
    const authorization = req.headers.authorization;

    // no authorization header, try from query string
    if (authorization == null) {
      if (req.url == null) {
        return;
      }

      const params = url.parse(req.url, true).query;

      if (typeof params.access_token === 'string') {
        token = params.access_token;
      }
    } else {
      const matches = /^Bearer (.+)$/.exec(authorization);

      if (matches != null) {
        token = matches[1];
      }
    }

    if (token == null) {
      return;
    }

    const parsedToken = jwt.verify(token, this.oAuthTokenSignatureKey);

    if (isOAuthJWT(parsedToken)) {
      return parsedToken.jti;
    }
  };

  verifyRequest = async (req: http.IncomingMessage) => {
    const oAuthToken = this.getToken(req);

    if (oAuthToken == null) {
      return null;
    }

    const [rows] = await this.db.execute<mysql.RowDataPacket[]>(`
      SELECT user_id, scopes
      FROM oauth_access_tokens
      WHERE revoked = false AND expires_at > now() AND id = ?
    `, [
      oAuthToken,
    ]);

    if (rows.length === 0) {
      throw new Error('token doesn\'t exist');
    }

    const userId = rows[0].user_id;
    const scopes = JSON.parse(rows[0].scopes);

    for (const scope of scopes) {
      if (scope === '*' || scope === 'read') {
        return {
          key: `oauth:${oAuthToken}`,
          requiresVerification: false,
          userId,
          verified: false,
        };
      }
    }

    throw new Error('token doesn\'t have the required scope');
  };
}

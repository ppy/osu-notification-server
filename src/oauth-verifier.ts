// Copyright (c) ppy Pty Ltd <contact@ppy.sh>. Licensed under the GNU Affero General Public License v3.0.
// See the LICENCE file in the repository root for full licence text.

import * as http from 'http';
import * as url from 'url';
import * as jwt from 'jsonwebtoken';
import * as mysql from 'mysql2/promise';

interface Params {
  db: mysql.Pool;
  publicKey: Buffer;
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
    this.oAuthTokenSignatureKey = params.publicKey;
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

    interface AccessTokenRow extends mysql.RowDataPacket {
      scopes: string;
      user_id: number;
      verified: boolean;
    }
    const [rows] = await this.db.execute<AccessTokenRow[]>(`
      SELECT scopes, user_id, verified
      FROM oauth_access_tokens
      WHERE revoked = false AND expires_at > now() AND id = ?
    `, [
      oAuthToken,
    ]);

    const row = rows[0];
    if (row == null) {
      throw new Error('token doesn\'t exist');
    }

    const scopes = JSON.parse(row.scopes) as string[];

    for (const scope of scopes) {
      if (scope === '*' || scope === 'chat.read') {
        return {
          key: `oauth:${oAuthToken}`,
          requiresVerification: true,
          scopes: new Set(scopes),
          userId: row.user_id,
          verified: row.verified, // this should match osu-web AuthApi
        };
      }
    }

    throw new Error('token doesn\'t have the required scope');
  };
}

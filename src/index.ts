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

import * as dotenv from "dotenv";
import * as fs from "fs";
import * as http from "http";
import * as jwt from "jsonwebtoken";
import * as mysql from "mysql2/promise";
import * as path from "path";
import "source-map-support/register";
import * as url from "url";
import * as WebSocket from "ws";
import LaravelSession from "./laravel-session";
import RedisSubscriber from "./redis-subscriber";
import UserConnection from "./user-connection";

interface OAuthJWT {
  aud: string;
  jti: string;
  iat: number;
  nbf: number;
  sub: string;
  scopes: string[];
}

let baseDir = process.env.WEBSOCKET_BASEDIR;

if (baseDir == null) {
  baseDir = path.resolve(`${__dirname}/..`);
}

const env = process.env.APP_ENV || "development";
dotenv.config({path: `${baseDir}/.env.${env}`});
dotenv.config({path: `${baseDir}/.env`});

const redisSubscriber = new RedisSubscriber({
  host: process.env.REDIS_HOST_BROADCAST,
  port: process.env.REDIS_PORT_BROADCAST == null ? 6379 : +process.env.REDIS_PORT_BROADCAST,
});
const port = process.env.WEBSOCKET_PORT == null ? 3000 : +process.env.WEBSOCKET_PORT;
const wss = new WebSocket.Server({port});

const db = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT == null ? undefined : +process.env.DB_PORT,

  password: process.env.DB_PASSWORD,
  user: process.env.DB_USERNAME || "osuweb",

  database: process.env.DB_DATABASE || "osu",
});

if (typeof process.env.APP_KEY !== "string") {
  throw new Error("APP_KEY environment variable is not set.");
}
const laravelSession = new LaravelSession({
  appKey: process.env.APP_KEY,
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT == null ? 6379 : +process.env.REDIS_PORT,
});

const oAuthTokenSignatureKey = fs.readFileSync(`${baseDir}/oauth-public.key`);
const isOAuthJWT = (arg: object|string): arg is OAuthJWT => {
  return typeof arg === "object";
};

const getOAuthToken = (req: http.IncomingMessage) => {
  let token;
  const authorization = req.headers.authorization;

  // no authorization header, try from query string
  if (authorization == null) {
    if (req.url == null) {
      return;
    }

    const params = url.parse(req.url, true).query;

    if (typeof params.access_token === "string") {
      token = params.access_token;
    }
  } else {
    const matches = authorization.match(/^Bearer (.+)$/);

    if (matches != null) {
      token = matches[1];
    }
  }

  if (token == null) {
    return;
  }

  const parsedToken = jwt.verify(token, oAuthTokenSignatureKey);

  if (isOAuthJWT(parsedToken)) {
    return parsedToken.jti;
  }
};

const verifyOAuthToken = async (req: http.IncomingMessage) => {
  const oAuthToken = getOAuthToken(req);

  if (oAuthToken == null) {
    return;
  }

  const [rows, fields] = await db.execute(`
    SELECT user_id, scopes
    FROM oauth_access_tokens
    WHERE revoked = false AND expires_at > now() AND id = ?
  `, [
    oAuthToken,
  ]);

  if (rows.length === 0) {
    throw new Error("authentication failed");
  }

  const userId = rows[0].user_id;
  const scopes = JSON.parse(rows[0].scopes);

  for (const scope of scopes) {
    if (scope === "*" || scope === "read") {
      return userId;
    }
  }
};

const getUserId = async (req: http.IncomingMessage) => {
  let userId = await verifyOAuthToken(req);
  if (userId == null) {
    userId = await laravelSession.verifyRequest(req);
  }

  if (userId == null) {
    throw new Error("Authentication failed");
  }

  return userId;
};

wss.on("connection", async (ws: WebSocket, req: http.IncomingMessage) => {
  let userId;

  try {
    userId = await getUserId(req);
  } catch (err) {
    ws.send("authentication failed");
    ws.close();
    return;
  }

  const connection = new UserConnection(userId, {db, redisSubscriber, ws});

  connection.boot();
});

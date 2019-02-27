import * as dotenv from "dotenv";
import * as fs from "fs";
import * as http from "http";
import * as jwt from "jsonwebtoken";
import * as mysql from "mysql2/promise";
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

const env = process.env.APP_ENV || "development";
dotenv.config({path: `${__dirname}/../.env.${env}`});
dotenv.config({path: `${__dirname}/../.env`});

const redisSubscriber = new RedisSubscriber();
const port = process.env.WEBSOCKET_PORT == null ? 3000 : +process.env.WEBSOCKET_PORT;
const wss = new WebSocket.Server({port});

const db = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    port: process.env.DB_PORT == null ? undefined : +process.env.DB_PORT,

    password: process.env.DB_PASSWORD,
    user: process.env.DB_USERNAME || "osuweb",

    database: process.env.DB_DATABASE || "osu",
});

const oAuthTokenSignatureKey = fs.readFileSync(`${__dirname}/../oauth-public.key`);
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
        const session = new LaravelSession();

        userId = await session.verifyRequest(req);
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

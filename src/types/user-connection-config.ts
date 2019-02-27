import * as mysql from "mysql2/promise";
import * as WebSocket from "ws";
import RedisSubscriber from "../redis-subscriber";

export default interface UserConnectionConfig {
    db: mysql.Pool;
    redisSubscriber: RedisSubscriber;
    ws: WebSocket;
}

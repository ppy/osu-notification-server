import * as redis from "redis";
import UserConnection from "./user-connection";

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
        this.redis.on("message", (channel: string, message: string) => {
            if (this.userConnections[channel] == null) {
                return;
            }

            this.userConnections[channel].forEach((connection) => connection.event(channel, message));
        });

        this.userConnections = {};
    }

    public subscribe(channel: string, connection: UserConnection) {
        if (this.userConnections[channel] == null) {
            this.userConnections[channel] = [];
        }

        if (this.userConnections[channel].length === 0) {
            this.redis.subscribe(channel);
        }

        this.userConnections[channel].push(connection);
    }

    public unsubscribe(channel: string, connection: UserConnection) {
        if (this.userConnections[channel].length === 0) {
            return;
        }

        this.userConnections[channel] = this.userConnections[channel]
            .filter((regConnection: UserConnection) => regConnection !== connection);

        if (this.userConnections[channel].length === 0) {
            this.redis.unsubscribe(channel);
        }
    }

    public unsubscribeAll(connection: UserConnection) {
        for (const channel of Object.keys(this.userConnections)) {
            this.unsubscribe(channel, connection);
        }
    }
}

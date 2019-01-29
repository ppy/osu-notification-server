import * as redis from "redis";
import MessageCallback from "./types/message-callback";

interface MessageCallbacks {
    [key: string]: MessageCallback[];
}

export default class RedisSubscriber {
    private messageCallbacks: MessageCallbacks;
    private redis: redis.RedisClient;

    constructor() {
        this.redis = redis.createClient();
        this.redis.on("message", (channel: string, message: string) => {
            if (this.messageCallbacks[channel] == null) {
                return;
            }

            this.messageCallbacks[channel].forEach((callback) => callback(channel, message));
        });

        this.messageCallbacks = {};
    }

    public subscribe(channel: string, callback: MessageCallback) {
        if (this.messageCallbacks[channel] == null) {
            this.messageCallbacks[channel] = [];
        }

        if (this.messageCallbacks[channel].length === 0) {
            this.redis.subscribe(channel);
        }

        this.messageCallbacks[channel].push(callback);
    }

    public unsubscribe(channel: string, callback: MessageCallback) {
        if (this.messageCallbacks[channel].length === 0) {
            return;
        }

        this.messageCallbacks[channel] = this.messageCallbacks[channel]
            .filter((regCallback: MessageCallback) => regCallback !== callback);

        if (this.messageCallbacks[channel].length === 0) {
            this.redis.unsubscribe(channel);
        }
    }

    public unsubscribeAll(callback: MessageCallback) {
        for (const channel of Object.keys(this.messageCallbacks)) {
            this.unsubscribe(channel, callback);
        }
    }
}

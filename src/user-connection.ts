import UserConnectionConfig from "./types/user-connection-config";

export default class UserConnection {
    private config: UserConnectionConfig;
    private userId: number;

    constructor(userId: number, config: UserConnectionConfig) {
        this.config = config;
        this.userId = userId;
    }

    public boot = () => {
        this.config.redisSubscriber.subscribe("global", this);
        this.config.ws.on("close", this.close);
    }

    public close = () => {
        this.config.redisSubscriber.unsubscribeAll(this);
    }

    public event = (channel: string, message: string) => {
        "x";
    }
}

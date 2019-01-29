interface Options {
    strict: boolean;
    encoding?: "utf8" | "binary";
}

declare module "php-serialize" {
    function unserialize(item: string, scope?: object, options?: Options): any;
}

declare module 'node-cache' {
  interface Options {
    stdTTL?: number;
    checkperiod?: number;
    useClones?: boolean;
    deleteOnExpire?: boolean;
    maxKeys?: number;
  }

  class NodeCache {
    constructor(options?: Options);
    set<T>(key: string, value: T, ttl?: number): boolean;
    get<T>(key: string): T | undefined;
    del(key: string | string[]): number;
    has(key: string): boolean;
    keys(): string[];
    getStats(): { hits: number; misses: number; keys: number; ksize: number; vsize: number };
    flushAll(): void;
    close(): void;
  }

  export = NodeCache;
}

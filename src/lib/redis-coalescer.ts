import { Redis } from "@upstash/redis";

type RedisLike = {
  get: (...args: any[]) => Promise<any>;
  mget: (...args: any[]) => Promise<any[]>;
  set: (...args: any[]) => Promise<any>;
  mset: (...args: any[]) => Promise<any>;
  [key: string]: any;
};

type Resolver<T> = {
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

let rawRedis: Redis | null | undefined;
let sharedRedis: Redis | null | undefined;

function createRawRedis(): Redis | null {
  if (rawRedis !== undefined) return rawRedis;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  rawRedis = url && token ? new Redis({ url, token }) : null;
  return rawRedis;
}

function normalizedKeys(args: any[]): string[] {
  const values =
    args.length === 1 && Array.isArray(args[0])
      ? args[0]
      : args;

  return values.map((key) => String(key));
}

function hasRedisOptions(options: unknown): boolean {
  return Boolean(
    options &&
      typeof options === "object" &&
      Object.keys(options as Record<string, unknown>).length > 0
  );
}

export function createCoalescedRedisForTesting<T extends RedisLike>(
  raw: T
): T {
  let pendingReads = new Map<
    string,
    Array<Resolver<unknown>>
  >();
  let readFlushScheduled = false;

  let pendingWrites = new Map<string, unknown>();
  let pendingWriteWaiters: Array<Resolver<unknown>> = [];
  let writeFlushScheduled = false;

  let mutationChain: Promise<void> = Promise.resolve();

  const scheduleReadFlush = (): void => {
    if (readFlushScheduled) return;
    readFlushScheduled = true;

    queueMicrotask(() => {
      readFlushScheduled = false;

      const batch = pendingReads;
      pendingReads = new Map();

      if (batch.size === 0) return;

      const keys = [...batch.keys()];

      const operation = mutationChain.then(async () => {
        const values = await raw.mget(...keys);

        for (let index = 0; index < keys.length; index++) {
          const value = values[index] ?? null;

          for (const waiter of batch.get(keys[index]) ?? []) {
            waiter.resolve(value);
          }
        }
      });

      operation.catch((error) => {
        for (const waiters of batch.values()) {
          for (const waiter of waiters) waiter.reject(error);
        }
      });
    });
  };

  const queueGet = (key: string): Promise<unknown> => {
    if (pendingWrites.has(key)) {
      return Promise.resolve(pendingWrites.get(key));
    }

    return new Promise((resolve, reject) => {
      const waiters = pendingReads.get(key) ?? [];
      waiters.push({ resolve, reject });
      pendingReads.set(key, waiters);
      scheduleReadFlush();
    });
  };

  const captureWriteBatch = (): void => {
    if (pendingWrites.size === 0) {
      const waiters = pendingWriteWaiters;
      pendingWriteWaiters = [];

      for (const waiter of waiters) waiter.resolve("OK");
      return;
    }

    const writes = pendingWrites;
    const waiters = pendingWriteWaiters;

    pendingWrites = new Map();
    pendingWriteWaiters = [];

    const payload = Object.fromEntries(writes);

    const operation = mutationChain.then(async () => {
      const result = await raw.mset(payload);

      for (const waiter of waiters) {
        waiter.resolve(result ?? "OK");
      }
    });

    mutationChain = operation.catch(() => undefined);

    operation.catch((error) => {
      for (const waiter of waiters) waiter.reject(error);
    });
  };

  const scheduleWriteFlush = (): void => {
    if (writeFlushScheduled) return;
    writeFlushScheduled = true;

    queueMicrotask(() => {
      writeFlushScheduled = false;
      captureWriteBatch();
    });
  };

  const queueWrites = (
    values: Record<string, unknown>
  ): Promise<unknown> => {
    for (const [key, value] of Object.entries(values)) {
      pendingWrites.set(key, value);
    }

    return new Promise((resolve, reject) => {
      pendingWriteWaiters.push({ resolve, reject });
      scheduleWriteFlush();
    });
  };

  const forcePendingWrites = async (): Promise<void> => {
    if (writeFlushScheduled || pendingWrites.size > 0) {
      writeFlushScheduled = false;
      captureWriteBatch();
    }

    await mutationChain;
  };

  const proxy = new Proxy(raw as RedisLike, {
    get(target, property, receiver) {
      if (property === "get") {
        return (key: string) => queueGet(String(key));
      }

      if (property === "mget") {
        return (...args: any[]) =>
          Promise.all(
            normalizedKeys(args).map((key) => queueGet(key))
          );
      }

      if (property === "set") {
        return (
          key: string,
          value: unknown,
          options?: Record<string, unknown>
        ) => {
          if (!hasRedisOptions(options)) {
            return queueWrites({ [String(key)]: value });
          }

          return forcePendingWrites().then(() =>
            raw.set(key, value, options)
          );
        };
      }

      if (property === "mset") {
        return (values: Record<string, unknown>) => {
          if (
            values &&
            typeof values === "object" &&
            !Array.isArray(values)
          ) {
            return queueWrites(values);
          }

          return forcePendingWrites().then(() =>
            (raw.mset as any)(values)
          );
        };
      }

      const value = Reflect.get(target, property, receiver);

      if (typeof value !== "function") return value;

      // Commands with atomic/TTL/existence semantics must not be buffered.
      // Flush plain writes first so command ordering remains correct.
      const directMutationMethods = new Set([
        "append",
        "decr",
        "decrby",
        "del",
        "expire",
        "expireat",
        "getdel",
        "getset",
        "incr",
        "incrby",
        "incrbyfloat",
        "move",
        "persist",
        "pexpire",
        "pexpireat",
        "rename",
        "renamenx",
        "sadd",
        "setex",
        "srem",
        "unlink",
      ]);

      if (directMutationMethods.has(String(property))) {
        return (...args: any[]) =>
          forcePendingWrites().then(() =>
            value.apply(target, args)
          );
      }

      return value.bind(target);
    },
  });

  return proxy as T;
}

export function getCoalescedRedis(): Redis | null {
  if (sharedRedis !== undefined) return sharedRedis;

  const raw = createRawRedis();
  sharedRedis = raw
    ? createCoalescedRedisForTesting(raw as any)
    : null;

  return sharedRedis ?? null;
}

import { waitUntil } from "@vercel/functions";

const serialQueues = new Map<string, Promise<void>>();

function registerTask(task: Promise<void>): void {
  try {
    waitUntil(task);
  } catch {
    // Local development or a non-Vercel runtime may not expose a request
    // lifecycle. The promise has already started, with errors handled below.
    void task;
  }
}

function safeTask(
  label: string,
  work: () => Promise<void>
): Promise<void> {
  return Promise.resolve()
    .then(work)
    .catch((error) => {
      console.error(`[post-response:${label}]`, error);
    });
}

export function runPostResponse(
  label: string,
  work: () => Promise<void>
): void {
  registerTask(safeTask(label, work));
}

export function runPostResponseSerial(
  queueKey: string,
  label: string,
  work: () => Promise<void>
): void {
  const previous = serialQueues.get(queueKey) ?? Promise.resolve();

  const task = previous
    .catch(() => undefined)
    .then(() => safeTask(label, work));

  let tracked: Promise<void>;

  tracked = task.finally(() => {
    if (serialQueues.get(queueKey) === tracked) {
      serialQueues.delete(queueKey);
    }
  });

  serialQueues.set(queueKey, tracked);
  registerTask(tracked);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runAfterCommandReply(
  fn: () => Promise<void>,
  delayMs = 12000
): Promise<void> {
  try {
    await delay(delayMs);
    await fn();
  } catch (err) {
    console.error("Delayed announcement failed:", err);
  }
}

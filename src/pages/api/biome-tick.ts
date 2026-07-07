import type { NextApiRequest, NextApiResponse } from "next";
import { getChannelState, setChannelState } from "@/lib/state";
import { processBiomeTick, getBiomeStatus } from "@/lib/biome-engine";
import { text, verifyCron } from "@/lib/api-helpers";
import { recordBiomeVisit } from "@/lib/global-stats";
import { formatAchievementUnlocks } from "@/lib/achievements";
import { sendNightbotMessage } from "@/lib/nightbot";
import { recordMegaBiome } from "@/lib/mega-feature-system";
import { maybeStartActivityWorldEvent } from "@/lib/activity-of-knowledge-system";

function getFirst(input: string | string[] | undefined): string | undefined {
  return Array.isArray(input) ? input[0] : input;
}

function isDisabledFlag(input: string | string[] | undefined): boolean {
  const value = (getFirst(input) ?? "").trim().toLowerCase();
  return ["0", "false", "off", "no", "silent"].includes(value);
}

function normalizeChannel(input: string): string {
  return input
    .trim()
    .replace(/^@+/, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "");
}

function cleanId(input: string): string {
  return input.trim().replace(/[^a-zA-Z0-9_-]/g, "");
}

function resolveCronChannel(req: NextApiRequest): { channelId: string; channelName: string } {
  const rawChannel =
    getFirst(req.query.channel) ??
    process.env.DEFAULT_CHANNEL_NAME ??
    process.env.DEFAULT_CHANNEL ??
    process.env.DEFAULT_CHANNEL_ID ??
    "default";

  const channelName = normalizeChannel(rawChannel) || "default";

  // IMPORTANT:
  // Normal Nightbot commands store biome state by Twitch providerId.
  // Old biome-tick used channelName as channelId, causing cron messages to
  // announce one state while !biome read a totally different state.
  const rawChannelId =
    getFirst(req.query.channelId) ??
    process.env.DEFAULT_CHANNEL_ID ??
    (/^\d+$/.test(rawChannel) ? rawChannel : "") ??
    channelName;

  const channelId = cleanId(rawChannelId) || channelName;

  return { channelId, channelName };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (!verifyCron(req)) {
    return res.status(401).send("Unauthorized");
  }

  const { channelId, channelName } = resolveCronChannel(req);

  let state = await getChannelState(channelId, channelName);

  const now = Date.now();

  if (!state.lastTickAt || state.lastTickAt > now + 60000) {
    state.lastTickAt = now;
  }

  const elapsed = Math.max(1000, now - state.lastTickAt);

  // Do not let processBiomeTick send messages before the state is saved.
  // We save first, then send a fresh status from the saved state.
  let result = await processBiomeTick(state, elapsed, null, false);
  let biomeChanged = result.biomeChanged;
  let changeMessage = result.changeMessage;

  // Safety: if old data somehow leaves an expired biome, force one tiny tick.
  if (result.state.biomeExpiresAt <= now) {
    const retry = await processBiomeTick(result.state, 1000, null, false);
    result = retry;
    biomeChanged = biomeChanged || retry.biomeChanged;
    changeMessage = retry.changeMessage ?? changeMessage;
  }

  // Cron should not slowly replay hours of old time. Save the tick as current.
  result.state.lastTickAt = now;

  await setChannelState(result.state);

  const unlocked = await recordBiomeVisit(
    result.state.biomeId,
    result.state.biomeExpiresAt
  );

  const unlockText = formatAchievementUnlocks(unlocked);

  if (biomeChanged) {
    await recordMegaBiome({
      channelId,
      channelName,
      biomeId: result.state.biomeId,
      timeOfDay: result.state.timeOfDay,
      expiresAt: result.state.biomeExpiresAt,
    });

    const activityEvent = await maybeStartActivityWorldEvent({
      channelId,
      channelName,
      biomeId: result.state.biomeId,
    });

    if (changeMessage) {
      await sendNightbotMessage(changeMessage, channelName);
    }

    if (activityEvent.message) {
      await sendNightbotMessage(activityEvent.message, channelName);
    }
  }

  // Default behavior: every cron tick sends the current biome + remaining duration.
  // Use &status=0 only if you want the cron to announce biome changes but not status.
  const shouldSendStatus = !isDisabledFlag(req.query.status);

  if (shouldSendStatus) {
    await sendNightbotMessage(getBiomeStatus(result.state), channelName);
  }

  if (unlockText) {
    await sendNightbotMessage(unlockText, channelName);
  }

  const parts: string[] = [
    `tick ok for ${channelName}`,
    `channelId=${channelId}`,
    `biome=${result.state.biomeId}`,
  ];

  if (biomeChanged) parts.push("changed");
  if (typeof shouldSendStatus !== "undefined" && shouldSendStatus) parts.push("status sent");
  if (unlocked.length > 0) parts.push("achievement");

  return text(res, parts.join(" | "));
}

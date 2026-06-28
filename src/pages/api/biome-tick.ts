import type { NextApiRequest, NextApiResponse } from "next";
import { getChannelState, setChannelState } from "@/lib/state";
import { processBiomeTick } from "@/lib/biome-engine";
import { text, verifyCron } from "@/lib/api-helpers";
import { recordBiomeVisit } from "@/lib/global-stats";
import { formatAchievementUnlocks } from "@/lib/achievements";
import { sendNightbotMessage } from "@/lib/nightbot";

function normalizeChannel(input: string): string {
  return input
    .trim()
    .replace(/^@+/, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "");
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (!verifyCron(req)) {
    return res.status(401).send("Unauthorized");
  }

  const rawChannel =
    typeof req.query.channel === "string"
      ? req.query.channel
      : process.env.DEFAULT_CHANNEL_NAME ?? process.env.DEFAULT_CHANNEL_ID ?? "default";

  const channelName = normalizeChannel(rawChannel);
  const channelId = channelName || "default";

  const state = await getChannelState(channelId, channelName);

  const elapsed = Date.now() - state.lastTickAt;
  const result = await processBiomeTick(state, elapsed, channelName);

  await setChannelState(result.state);

  const unlocked = await recordBiomeVisit(
    result.state.biomeId,
    result.state.biomeExpiresAt
  );

  const unlockText = formatAchievementUnlocks(unlocked);

  if (unlockText) {
    await sendNightbotMessage(unlockText, channelName);
  }

  const parts: string[] = [`tick ok for ${channelName}`];

  if (result.changeMessage) parts.push("changed");
  if (result.statusMessage) parts.push("status sent");
  if (unlocked.length > 0) parts.push("achievement");

  return text(res, parts.join(" | "));
}

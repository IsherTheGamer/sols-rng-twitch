import type { NextApiRequest, NextApiResponse } from "next";
import { getChannelState, setChannelState } from "@/lib/state";
import { processBiomeTick } from "@/lib/biome-engine";
import { text, verifyCron } from "@/lib/api-helpers";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!verifyCron(req)) {
    return res.status(401).send("Unauthorized");
  }

  const channelId = process.env.DEFAULT_CHANNEL_ID ?? "default";
  const state = await getChannelState(channelId);
  const elapsed = Date.now() - state.lastTickAt;
  const result = await processBiomeTick(state, elapsed);
  await setChannelState(result.state);

  const parts: string[] = ["tick ok"];
  if (result.changeMessage) parts.push("changed");
  if (result.statusMessage) parts.push("status sent");
  return text(res, parts.join(" "));
}

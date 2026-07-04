import type { NextApiRequest, NextApiResponse } from "next";
import { text, verifyCron } from "@/lib/api-helpers";
import { sendDiscordTestAlert } from "@/lib/discord-alerts";

function normalizeChannel(input: string): string {
  return input
    .trim()
    .replace(/^@+/, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "");
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!verifyCron(req)) {
    return res.status(401).send("Unauthorized");
  }

  const rawChannel =
    typeof req.query.channel === "string"
      ? req.query.channel
      : process.env.DEFAULT_CHANNEL_NAME ?? process.env.DEFAULT_CHANNEL_ID ?? "default";

  const channelName = normalizeChannel(rawChannel);

  await sendDiscordTestAlert(channelName);

  return text(res, `Discord test sent for ${channelName}.`);
}

import type { NextApiRequest, NextApiResponse } from "next";
import { text, verifyCron } from "@/lib/api-helpers";
import { getNextFunFact } from "@/lib/fun-facts";
import { sendNightbotMessage } from "@/lib/nightbot";

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function truthy(value: string | string[] | undefined): boolean {
  return ["1", "true", "yes", "on"].includes(first(value).toLowerCase());
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!process.env.CRON_SECRET || !verifyCron(req)) {
    return text(res, "❌ Fun-fact cron locked. Add ?token=YOUR_CRON_SECRET.");
  }

  const channel =
    first(req.query.channel)
      .trim()
      .replace(/^@+/, "")
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "") ||
    process.env.DEFAULT_CHANNEL_NAME ||
    "zipittt";

  const channelId =
    first(req.query.channelId).replace(/[^a-zA-Z0-9_-]/g, "") ||
    process.env.DEFAULT_CHANNEL_ID ||
    "904797805";

  const message = await getNextFunFact(channelId);

  if (truthy(req.query.preview) || truthy(req.query.dry)) {
    return text(res, `[PREVIEW] ${message}`);
  }

  const sent = await sendNightbotMessage(message, channel);

  if (!sent) {
    return text(
      res,
      `❌ Fun fact was generated but Nightbot could not send it. Check Nightbot OAuth/token for channel=${channel}.`
    );
  }

  return text(res, `✅ Sent to ${channel}: ${message}`);
}

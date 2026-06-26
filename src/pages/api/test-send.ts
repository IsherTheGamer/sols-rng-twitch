import type { NextApiRequest, NextApiResponse } from "next";
import { getChannelContext, sendNightbotMessage } from "@/lib/nightbot";
import { text, error } from "@/lib/api-helpers";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { isMod, user } = getChannelContext(req);

  if (!isMod) {
    return error(res, "Mod only.");
  }

  const hasToken = !!process.env.NIGHTBOT_TOKEN;

  if (!hasToken) {
    return text(res, "SEND TEST FAILED: NIGHTBOT_TOKEN is missing in Vercel.");
  }

  const displayName = user?.displayName ?? user?.name ?? "Tester";

  const ok = await sendNightbotMessage(
    `🌍 GLOBAL SEND TEST: ${displayName}, if you see this, Nightbot API sending works.`
  );

  if (!ok) {
    return text(
      res,
      "SEND TEST FAILED: token exists, but Nightbot API rejected the message."
    );
  }

  return text(res, "SEND TEST OK: Nightbot API message was accepted.");
}

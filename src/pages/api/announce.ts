import type { NextApiRequest, NextApiResponse } from "next";
import { getChannelContext } from "@/lib/nightbot";
import { text, error, parseQuery } from "@/lib/api-helpers";
import {
  ANNOUNCEMENT_THRESHOLDS,
  formatAnnouncementSettings,
  getAnnouncementSettings,
  normalizeAnnouncementThreshold,
  setAnnouncementSettings,
} from "@/lib/global-announcements";

function getArgs(req: NextApiRequest): string[] {
  return parseQuery(req).split(/\s+/).filter(Boolean);
}

function helpText() {
  return "Use: !announce | !announce off/on | !announce roll glorious | !announce potion transcendent";
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { channelId, isMod } = getChannelContext(req);

  if (!isMod) {
    return error(res, "Mod only.");
  }

  const args = getArgs(req);
  const current = await getAnnouncementSettings(channelId);

  if (args.length === 0) {
    return text(res, `${formatAnnouncementSettings(current)} | ${helpText()}`);
  }

  const first = args[0].toLowerCase();

  if (first === "off" || first === "disable" || first === "disabled") {
    const next = {
      ...current,
      enabled: false,
      updatedAt: Date.now(),
    };

    await setAnnouncementSettings(channelId, next);

    return text(res, formatAnnouncementSettings(next));
  }

  if (first === "on" || first === "enable" || first === "enabled") {
    const next = {
      ...current,
      enabled: true,
      updatedAt: Date.now(),
    };

    await setAnnouncementSettings(channelId, next);

    return text(res, formatAnnouncementSettings(next));
  }

  if (first === "roll" || first === "rolls") {
    const threshold = normalizeAnnouncementThreshold(args[1]);

    if (!threshold) {
      return error(
        res,
        `Unknown roll threshold. Use: ${ANNOUNCEMENT_THRESHOLDS.join(", ")}`
      );
    }

    const next = {
      ...current,
      enabled: true,
      rollMinTier: threshold,
      updatedAt: Date.now(),
    };

    await setAnnouncementSettings(channelId, next);

    return text(res, formatAnnouncementSettings(next));
  }

  if (
    first === "potion" ||
    first === "potions" ||
    first === "pop" ||
    first === "pops"
  ) {
    const threshold = normalizeAnnouncementThreshold(args[1]);

    if (!threshold) {
      return error(
        res,
        `Unknown potion threshold. Use: ${ANNOUNCEMENT_THRESHOLDS.join(", ")}`
      );
    }

    const next = {
      ...current,
      enabled: true,
      potionMinTier: threshold,
      updatedAt: Date.now(),
    };

    await setAnnouncementSettings(channelId, next);

    return text(res, formatAnnouncementSettings(next));
  }

  const threshold = normalizeAnnouncementThreshold(first);

  if (!threshold) {
    return error(res, `Unknown setting. ${helpText()}`);
  }

  const next = {
    ...current,
    enabled: true,
    rollMinTier: threshold,
    potionMinTier: threshold,
    updatedAt: Date.now(),
  };

  await setAnnouncementSettings(channelId, next);

  return text(res, formatAnnouncementSettings(next));
}

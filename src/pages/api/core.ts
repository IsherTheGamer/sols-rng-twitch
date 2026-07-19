import type { NextApiRequest, NextApiResponse } from "next";
import { parseQuery, text } from "@/lib/api-helpers";
import { getChannelContext } from "@/lib/nightbot";
import {
  attemptCoreUpgrade,
  chooseCorePath,
  formatCoreRecipe,
  formatCoreStatus,
  formatCoreTokenGuide,
  setCoreFocus,
  switchCorePath,
  useCoreToken,
} from "@/lib/core-system";
import {
  CORE_ACTIONS,
  resolveCoreFocus,
  resolveCorePath,
  resolveCoreToken,
  resolveTextAlias,
} from "@/lib/command-aliases";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { channelId, user } = getChannelContext(req);
  const args = parseQuery(req).trim().split(/\s+/).filter(Boolean);

  if (args.length === 0) return text(res, await formatCoreStatus(channelId, user));

  const actionResult = resolveTextAlias(args[0], CORE_ACTIONS, "Core action");
  if (!actionResult.value) return text(res, actionResult.error ?? "Unknown Core action.");
  const action = actionResult.value;

  if (action === "status") return text(res, await formatCoreStatus(channelId, user));
  if (action === "upgrade") return text(res, await attemptCoreUpgrade(channelId, user));
  if (action === "recipe") return text(res, await formatCoreRecipe(channelId, user));

  if (action === "focus") {
    const focus = resolveCoreFocus(args.slice(1).join(" "));
    if (!focus.value) return text(res, focus.error ?? "Unknown Core focus.");
    return text(res, await setCoreFocus(channelId, user, focus.value));
  }

  if (action === "choose" || action === "switch") {
    const path = resolveCorePath(args.slice(1).join(" "));
    if (!path.value) return text(res, path.error ?? "Unknown Core path.");
    return text(
      res,
      action === "choose"
        ? await chooseCorePath(channelId, user, path.value)
        : await switchCorePath(channelId, user, path.value)
    );
  }

  if (action === "tokens") {
    const rawToken = args.slice(1).join(" ");
    if (!rawToken) return text(res, await formatCoreTokenGuide(channelId, user, ""));
    const token = resolveCoreToken(rawToken);
    if (!token.value) return text(res, token.error ?? "Unknown Core token.");
    return text(res, await formatCoreTokenGuide(channelId, user, token.value));
  }

  if (action === "token") {
    const subAction = resolveTextAlias(
      args[1] ?? "",
      [
        { id: "use", label: "use", aliases: ["activate", "consume"], value: "use" as const },
        { id: "guide", label: "guide", aliases: ["info", "show", "help"], value: "guide" as const },
      ],
      "Core token action"
    );

    if (!subAction.value) {
      // Preserve the convenient !core token quest shortcut.
      const direct = resolveCoreToken(args.slice(1).join(" "));
      if (!direct.value) return text(res, direct.error ?? subAction.error ?? "Unknown Core token.");
      return text(res, await formatCoreTokenGuide(channelId, user, direct.value));
    }

    const token = resolveCoreToken(args.slice(2).join(" "));
    if (!token.value) return text(res, token.error ?? "Unknown Core token.");

    return text(
      res,
      subAction.value === "use"
        ? await useCoreToken(channelId, user, token.value)
        : await formatCoreTokenGuide(channelId, user, token.value)
    );
  }

  return text(res, await formatCoreStatus(channelId, user));
}

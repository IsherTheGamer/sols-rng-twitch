import type { NextApiRequest, NextApiResponse } from "next";
import { parseQuery, text, verifyCron } from "@/lib/api-helpers";
import { getChannelContext } from "@/lib/nightbot";
import {
  addDynamicRollAccess,
  clearDynamicRollAccess,
  getDynamicRollAllowlist,
  isRollAccessManager,
  normalizeRollAccessName,
  removeDynamicRollAccess,
} from "@/lib/roll-access";

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function cronAuthorized(req: NextApiRequest): boolean {
  return Boolean(process.env.CRON_SECRET) && verifyCron(req);
}

function parseAction(req: NextApiRequest): {
  action: string;
  target: string;
} {
  const raw = parseQuery(req).trim();
  const parts = raw.split(/\s+/).filter(Boolean);

  const action = (
    first(req.query.action) ||
    parts.shift() ||
    "list"
  ).toLowerCase();

  const target =
    first(req.query.username) ||
    first(req.query.target) ||
    parts.join(" ");

  return { action, target: normalizeRollAccessName(target) };
}

function formatList(usernames: string[]): string {
  if (usernames.length === 0) return "none";

  const shown = usernames.slice(0, 20);
  const hidden = usernames.length - shown.length;

  return `${shown.join(", ")}${hidden > 0 ? ` (+${hidden} more)` : ""}`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { channelId: contextChannelId, user } = getChannelContext(req);
  const channelId = first(req.query.channelId).replace(/[^a-zA-Z0-9_-]/g, "") || contextChannelId;

  if (!isRollAccessManager(user) && !cronAuthorized(req)) {
    return text(
      res,
      "❌ Roll access locked. Only isherthegamer and zipittt can manage the 10k allowlist."
    );
  }

  const { action, target } = parseAction(req);

  try {
    if (action === "list" || action === "status") {
      const entries = await getDynamicRollAllowlist(channelId);
      return text(
        res,
        `10k roll allowlist (${entries.length}): ${formatList(
          entries.map((entry) => entry.username)
        )}`
      );
    }

    if (action === "add" || action === "allow") {
      if (!target) return text(res, "Usage: !rollaccess add username");

      const result = await addDynamicRollAccess({
        channelId,
        username: target,
        addedBy: user,
      });

      return text(
        res,
        result.added
          ? `✅ Added ${target} to the 10k roll allowlist. Total: ${result.entries.length}.`
          : `${target} already has 10k roll access.`
      );
    }

    if (action === "remove" || action === "delete" || action === "revoke") {
      if (!target) return text(res, "Usage: !rollaccess remove username");

      const result = await removeDynamicRollAccess({
        channelId,
        username: target,
      });

      return text(
        res,
        result.removed
          ? `✅ Removed ${target} from the 10k roll allowlist. Total: ${result.entries.length}.`
          : `${target} was not in the dynamic allowlist.`
      );
    }

    if (action === "check") {
      if (!target) return text(res, "Usage: !rollaccess check username");

      const entries = await getDynamicRollAllowlist(channelId);
      const found = entries.some((entry) => entry.username === target);

      return text(
        res,
        found
          ? `✅ ${target} is in the dynamic 10k roll allowlist.`
          : `${target} is not in the dynamic allowlist. They may still be allowed through Vercel env settings.`
      );
    }

    if (action === "clear") {
      const removed = await clearDynamicRollAccess(channelId);
      return text(res, `✅ Cleared ${removed} dynamic roll-access entr${removed === 1 ? "y" : "ies"}.`);
    }

    return text(
      res,
      "Commands: !rollaccess add <user> | remove <user> | check <user> | list | clear"
    );
  } catch (error) {
    return text(
      res,
      `❌ Roll-access update failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

import type { NextApiRequest, NextApiResponse } from "next";
import { getChannelContext } from "@/lib/nightbot";
import { isBroadcasterUser } from "@/lib/profile";
import { isPopopAllowlisted } from "@/lib/popop-access";
import {
  grantTokensToUsername,
  refundActiveTokenBuffs,
  useToken,
} from "@/lib/inventory";
import { text, error, parseQuery } from "@/lib/api-helpers";
import { truncate } from "@/lib/format";

function parseAmount(parts: string[]): {
  amount: number;
  remaining: string[];
} {
  if (parts.length === 0) {
    return {
      amount: 1,
      remaining: parts,
    };
  }

  const last = parts[parts.length - 1].toLowerCase();
  const match = last.match(/^(\d+)(k)?$/);

  if (!match) {
    return {
      amount: 1,
      remaining: parts,
    };
  }

  const base = parseInt(match[1], 10);
  const amount = match[2] === "k" ? base * 1000 : base;

  return {
    amount: Math.max(1, amount),
    remaining: parts.slice(0, -1),
  };
}

function usage(): string {
  return "Usage: !token use <token> [amount] | !token refund | !token give <user> <token> [amount]";
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const {
    channel,
    channelId,
    channelLoginName,
    user,
  } = getChannelContext(req);

  if (!user) {
    return error(res, "Token only works from Twitch chat.");
  }

  const query = parseQuery(req).trim();
  const parts = query.split(/\s+/).filter(Boolean);
  const action = parts[0]?.toLowerCase();

  if (!action) {
    return text(res, usage());
  }

  if (action === "refund") {
    const result = await refundActiveTokenBuffs({
      channelId,
      user,
    });

    if (result.refunded.length === 0) {
      return text(res, "You have no active token buffs to refund.");
    }

    const count = result.refunded.reduce((sum, buff) => sum + buff.amount, 0);

    return text(res, `Refunded ${count} active token(s) back into inventory.`);
  }

  if (action === "use") {
    const afterAction = parts.slice(1);

    if (afterAction.length === 0) {
      return error(res, "Use what token? Example: !token use clover");
    }

    const parsed = parseAmount(afterAction);
    const tokenQuery = parsed.remaining.join(" ");

    if (!tokenQuery) {
      return error(res, "Use what token? Example: !token use bound 2");
    }

    const result = await useToken({
      channelId,
      user,
      tokenQuery,
      amount: parsed.amount,
    });

    if (!result.ok) {
      return error(res, result.message);
    }

    return text(res, truncate(result.message, 390));
  }

  if (action === "give") {
    const broadcaster = isBroadcasterUser(user, channel);
    const allowlisted = isPopopAllowlisted(user, channelLoginName);

    if (!broadcaster && !allowlisted) {
      return error(res, "Token give is trusted-user only.");
    }

    const target = parts[1];

    if (!target) {
      return error(res, "Give to who? Example: !token give viewer clover 1");
    }

    const afterTarget = parts.slice(2);

    if (afterTarget.length === 0) {
      return error(res, "Give what token? Example: !token give viewer bound 2");
    }

    const parsed = parseAmount(afterTarget);
    const tokenQuery = parsed.remaining.join(" ");

    if (!tokenQuery) {
      return error(res, "Give what token? Example: !token give viewer clover");
    }

    const result = await grantTokensToUsername({
      channelId,
      username: target,
      tokenQuery,
      amount: parsed.amount,
    });

    if (!result.ok) {
      return error(res, result.message);
    }

    return text(res, truncate(result.message, 390));
  }

  return error(res, usage());
}

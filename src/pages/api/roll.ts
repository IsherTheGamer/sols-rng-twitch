import { runAfterCommandReply } from "@/lib/delayed-announcement";
import type { NextApiRequest, NextApiResponse } from "next";
import {
  addGlobalRolls,
  getGlobalLuck,
  getAchievementBonuses,
  recordAuraRolls,
} from "@/lib/global-stats";
import { formatAchievementUnlocks } from "@/lib/achievements";
import { getChannelContext } from "@/lib/nightbot";
import { cooldownKey, formatRemaining } from "@/lib/state";
import { rollOnce, topRarest, type RollHitResult } from "@/lib/roll-engine";
import {
  applyCooldown,
  checkCooldown,
  ROLL_COOLDOWN_MS,
} from "@/lib/cooldowns";
import { text, error } from "@/lib/api-helpers";
import { formatRollResult, formatMultiRoll } from "@/lib/format";
import { withTick } from "@/lib/run-with-tick";
import { isBroadcasterUser, recordViewerRolls } from "@/lib/profile";
import { announceAuraResults } from "@/lib/global-announcements";
import { isRollMultiAllowlisted } from "@/lib/roll-access";
import {
  consumeRollTokenBuffsForRolls,
  formatConsumedRollTokenEffects,
} from "@/lib/inventory";
import type { ChannelState } from "@/types/data";
import { getViewerCoreLuck, recordCoreRolls } from "@/lib/core-system";
import { getServerLuckMultiplier, recordSocialRolls } from "@/lib/social-system";
import { getMegaLuckMultiplier, recordMegaRolls } from "@/lib/mega-feature-system";

const VIEWER_MULTIROLL_LIMIT = 3;
const VIP_MULTIROLL_LIMIT = 10;
const MOD_MULTIROLL_LIMIT = 20;
const TRUSTED_MULTIROLL_LIMIT = 10000;
const MAX_DISPLAY_RESULTS = 5;

export const config = {
  maxDuration: 30,
};

const SPECIAL_BIOME_IDS = new Set([
  "glitched",
  "dreamspace",
  "abnormality",
  "blood_rain",
  "starfall",
  "singularity",
  "cyberspace",
  "red_full_moon",
  "graveyard",
  "pumpkin_moon",
  "blazing_sun",
  "aurora",
  "snowy",
]);

function parseAmount(rawArgs: string | undefined): number {
  const raw = (rawArgs ?? "").trim().toLowerCase();
  if (!raw) return 1;
  const first = raw.split(/\s+/)[0];
  const match = first.match(/^(\d+)(k|m)?$/);
  if (!match) return 1;
  const base = parseInt(match[1], 10);
  if (!Number.isFinite(base) || base < 1) return 1;
  const suffix = match[2];
  if (suffix === "k") return base * 1000;
  if (suffix === "m") return base * 1000000;
  return base;
}

function getUserLevel(userLevel: string | undefined | null): string {
  return (userLevel ?? "everyone").toLowerCase().trim();
}

function isVipUser(userLevel: string | undefined | null): boolean {
  const level = getUserLevel(userLevel);
  return level === "vip" || level === "regular" || level === "subscriber";
}

function getRoleRollLimit(options: {
  userLevel: string | undefined | null;
  isMod: boolean;
  trustedMultiroll: boolean;
}): number {
  if (options.trustedMultiroll) return TRUSTED_MULTIROLL_LIMIT;
  if (options.isMod) return MOD_MULTIROLL_LIMIT;
  if (isVipUser(options.userLevel)) return VIP_MULTIROLL_LIMIT;
  return VIEWER_MULTIROLL_LIMIT;
}

function getRoleRollLimitName(options: {
  userLevel: string | undefined | null;
  isMod: boolean;
  trustedMultiroll: boolean;
}): string {
  if (options.trustedMultiroll) return "trusted/broadcaster";
  if (options.isMod) return "mod";
  if (isVipUser(options.userLevel)) return "VIP";
  return "viewer";
}

function isSpecialBiomeActive(state: ChannelState): boolean {
  if (state.biomeId && SPECIAL_BIOME_IDS.has(state.biomeId)) return true;
  if (state.bloodRainExpiresAt > Date.now()) return true;
  if (state.activeDevBiome && state.devExpiresAt > Date.now()) return true;
  return false;
}

function calculateRollLuck(options: {
  baseLuck: number;
  tokenFlatLuck: number;
  tokenPercentLuck: number;
  tokenRareBiomePercentLuck: number;
  tokenFinalLuckMultiplier: number;
  achievementFlatLuck: number;
  achievementFinalLuckMultiplier: number;
  rareBiomeActive: boolean;
}): number {
  const tokenPercent =
    options.tokenPercentLuck +
    (options.rareBiomeActive ? options.tokenRareBiomePercentLuck : 0);

  return (
    ((options.baseLuck + options.tokenFlatLuck) * (1 + tokenPercent) +
      options.achievementFlatLuck) *
    options.achievementFinalLuckMultiplier *
    options.tokenFinalLuckMultiplier
  );
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { channel, channelId, channelName, channelLoginName, user, isMod } =
    getChannelContext(req);

  const amount = parseAmount(req.query.args as string | undefined);
  const broadcaster = isBroadcasterUser(user, channel);
  const allowlisted = isRollMultiAllowlisted(user, channelLoginName);
  const trustedMultiroll = broadcaster || allowlisted;

  const maxAllowed = getRoleRollLimit({
    userLevel: user?.userLevel,
    isMod,
    trustedMultiroll,
  });

  const limitName = getRoleRollLimitName({
    userLevel: user?.userLevel,
    isMod,
    trustedMultiroll,
  });

  if (amount > maxAllowed) {
    return error(res, `Max ${limitName} multi-roll is ${maxAllowed}.`);
  }

  const achievementBonuses = await getAchievementBonuses();
  const coreLuck = await getViewerCoreLuck(channelId, user);
  const serverLuck = await getServerLuckMultiplier(channelId);
  const megaLuck = await getMegaLuckMultiplier(channelId);

  const cooldownMs = Math.max(
    1000,
    ROLL_COOLDOWN_MS - achievementBonuses.cooldownReductionSeconds * 1000
  );

  if (!isMod && !trustedMultiroll) {
    const key = cooldownKey("roll", channelId, user?.providerId ?? "anon");
    const cd = await checkCooldown(key, cooldownMs);

    if (!cd.allowed) {
      return text(res, `Roll cooldown: ${formatRemaining(Date.now() + cd.remainingMs)}`);
    }

    await applyCooldown(key, cooldownMs);
  }

  const baseRollCount = amount > 1 ? Math.min(amount, maxAllowed) : 1;
  const bonusRolls = Math.floor(achievementBonuses.extraRolls);
  const rollCount = baseRollCount + bonusRolls;
  const displayCount = rollCount > 1 ? Math.min(rollCount, MAX_DISPLAY_RESULTS) : 1;

  const tokenPlan = await consumeRollTokenBuffsForRolls({
    channelId,
    user,
    rolls: rollCount,
  });

  const oneTimeTokenAssisted = tokenPlan.effects.some((effect) =>
    effect.used.some((buff) => buff.consumeOnRoll)
  );

  const globalRollsAfter = await addGlobalRolls(rollCount);
  const firstGlobalRoll = Math.max(1, globalRollsAfter - rollCount + 1);

  return withTick(channelId, channelName, async (state) => {
    const name = user?.displayName ?? user?.name ?? "Player";
    const rareBiomeActive = isSpecialBiomeActive(state);
    const results: RollHitResult[] = [];

    for (let i = 0; i < rollCount; i++) {
      const tokenEffect = tokenPlan.effects[i] ?? {
        flatLuck: 0,
        percentLuck: 0,
        rareBiomePercentLuck: 0,
        finalLuckMultiplier: 1,
        exclusive: false,
        used: [],
      };

      const baseLuck = getGlobalLuck(firstGlobalRoll + i) * coreLuck.multiplier;

      const luck = calculateRollLuck({
        baseLuck,
        tokenFlatLuck: tokenEffect.flatLuck,
        tokenPercentLuck: tokenEffect.percentLuck,
        tokenRareBiomePercentLuck: tokenEffect.rareBiomePercentLuck,
        tokenFinalLuckMultiplier: tokenEffect.finalLuckMultiplier,
        achievementFlatLuck: achievementBonuses.flatLuck,
        achievementFinalLuckMultiplier: achievementBonuses.finalLuckMultiplier * serverLuck.multiplier * megaLuck.multiplier,
        rareBiomeActive,
      });

      const result = rollOnce({
        state,
        luck,
        potionId: tokenEffect.potionId,
      });

      results.push(result);
    }

    const top = topRarest(results, displayCount);

    await recordViewerRolls(
      channelId,
      user,
      results,
      oneTimeTokenAssisted ? "token" : "roll"
    );

    await recordCoreRolls(channelId, user, results);
    await recordSocialRolls(channelId, user, results, oneTimeTokenAssisted ? "token" : "roll");
    await recordMegaRolls({
      channelId,
      channelName: channelLoginName,
      user,
      results,
      source: oneTimeTokenAssisted ? "token" : "roll",
    });

    const unlocked = await recordAuraRolls(results);
    const unlockText = formatAchievementUnlocks(unlocked);
    const tokenUsage = formatConsumedRollTokenEffects(tokenPlan.effects);
    const tokenText = tokenUsage ? ` | Tokens used: ${tokenUsage}` : "";
    const serverBoostText = serverLuck.percent > 0 ? ` | Server Boost +${Math.floor(serverLuck.percent)}%` : "";
    const megaBoostText = megaLuck.percent > 0 ? ` | Event +${Math.floor(megaLuck.percent)}%` : "";
    const suffix = `${unlockText ? ` | ${unlockText}` : ""}${tokenText}${serverBoostText}${megaBoostText}`;

    if (displayCount === 1) {
      const best = top[0];
      text(res, `${formatRollResult(name, best.aura.name, best.effectiveRarity)}${suffix}`);

      await runAfterCommandReply(() =>
        announceAuraResults({
          channelId,
          channelName: channelLoginName,
          displayName: name,
          results,
          source: "roll",
        })
      );

      return;
    }

    const bonusText = bonusRolls > 0 ? ` (+${bonusRolls} achievement bonus)` : "";
    const msg =
      `${name} rolled ${rollCount}x${bonusText} — top ${displayCount}: ` +
      formatMultiRoll(top.map((r) => ({ name: r.aura.name, rarity: r.effectiveRarity })));

    text(res, `${msg}${suffix}`);

    await runAfterCommandReply(() =>
      announceAuraResults({
        channelId,
        channelName: channelLoginName,
        displayName: name,
        results,
        source: "roll",
      })
    );

    return;
  });
}

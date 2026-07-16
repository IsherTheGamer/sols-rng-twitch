import { runAfterCommandReply } from "@/lib/delayed-announcement";
import type { NextApiRequest, NextApiResponse } from "next";
import {
  addGlobalRolls,
  getGlobalRolls,
  getGlobalLuck,
  getAchievementBonuses,
  recordAuraRolls,
} from "@/lib/global-stats";
import { formatAchievementUnlocks } from "@/lib/achievements";
import { getChannelContext } from "@/lib/nightbot";
import { cooldownKey, formatRemaining, getChannelState } from "@/lib/state";
import { rollOnce, topRarest, type RollHitResult } from "@/lib/roll-engine";
import {
  applyCooldown,
  checkCooldown,
  ROLL_COOLDOWN_MS,
} from "@/lib/cooldowns";
import { text, error } from "@/lib/api-helpers";
import { formatRollResult, formatMultiRoll } from "@/lib/format";
import { withTick } from "@/lib/run-with-tick";
import { getViewerProfile, isBroadcasterUser, recordViewerRolls } from "@/lib/profile";
import { announceAuraResults } from "@/lib/global-announcements";
import { isRollMultiAllowlisted } from "@/lib/roll-access";
import {
  consumeRollTokenBuffsForRolls,
  formatConsumedRollTokenEffects,
  type RollTokenPlan,
} from "@/lib/inventory";
import type { ChannelState } from "@/types/data";
import { getViewerCoreLuck, recordCoreRolls } from "@/lib/core-system";
import { getServerLuckMultiplier, recordSocialRolls } from "@/lib/social-system";
import { getMegaLuckMultiplier, recordMegaRolls } from "@/lib/mega-feature-system";
import { recordActivityRolls } from "@/lib/activity-of-knowledge-system";
import { processBiomeTick } from "@/lib/biome-engine";

const VIEWER_MULTIROLL_LIMIT = 15;
const VIP_MULTIROLL_LIMIT = 35;
const MOD_MULTIROLL_LIMIT = 75;
const TRUSTED_MULTIROLL_LIMIT = 10000;
const SAFE_ROLL_THRESHOLD = 2500;
const MAX_SAFE_LUCK_MULTIPLIER = 1000000;
const MAX_DISPLAY_RESULTS = 5;

const ROLL_LIMIT_MILESTONES = [
  1000,
  10000,
  100000,
  1000000,
  10000000,
  100000000,
  1000000000,
] as const;

function getRollLimitProgressBonus(totalRolls: number): number {
  return ROLL_LIMIT_MILESTONES.filter((milestone) => totalRolls >= milestone).length;
}

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

function parseSafeLuckMultiplier(rawArgs: string | undefined): number {
  const parts = (rawArgs ?? "")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length < 2) return 1;

  const raw = parts[1]
    .replace(/,/g, "")
    .replace(/x$/i, "");

  if (!/^\d+(?:\.\d+)?$/.test(raw)) return NaN;

  const multiplier = Number(raw);
  if (!Number.isFinite(multiplier) || multiplier < 1) return NaN;

  return multiplier;
}

function formatSafeLuckMultiplier(multiplier: number): string {
  if (Number.isInteger(multiplier)) {
    return multiplier.toLocaleString("en-US");
  }

  return multiplier
    .toFixed(2)
    .replace(/0+$/, "")
    .replace(/\.$/, "");
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
  rollProgressBonus: number;
}): number {
  if (options.trustedMultiroll) return TRUSTED_MULTIROLL_LIMIT;

  const bonus = Math.max(0, Math.floor(options.rollProgressBonus || 0));
  if (options.isMod) return MOD_MULTIROLL_LIMIT + bonus;
  if (isVipUser(options.userLevel)) return VIP_MULTIROLL_LIMIT + bonus;
  return VIEWER_MULTIROLL_LIMIT + bonus;
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

async function getSafeSimulationState(
  channelId: string,
  channelName: string
): Promise<ChannelState> {
  const storedState = await getChannelState(channelId, channelName);

  // processBiomeTick mutates the object it receives, so clone it first.
  // The simulated tick is intentionally never written back to Redis.
  const previewState = JSON.parse(
    JSON.stringify(storedState)
  ) as ChannelState;

  const elapsed = Date.now() - previewState.lastTickAt;
  const tick = await processBiomeTick(previewState, elapsed, null, false);

  return tick.state;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { channel, channelId, channelName, channelLoginName, user, isMod } =
    getChannelContext(req);

  const rawArgs = req.query.args as string | undefined;
  const amount = parseAmount(rawArgs);
  const requestedSafeLuckMultiplier = parseSafeLuckMultiplier(rawArgs);
  const broadcaster = isBroadcasterUser(user, channel);
  const allowlisted = await isRollMultiAllowlisted(user, channelLoginName, channelId);
  const trustedMultiroll = broadcaster || allowlisted;

  const viewerProfileForLimit = trustedMultiroll || !user ? null : await getViewerProfile(channelId, user);
  const totalProfileRollsForLimit =
    (viewerProfileForLimit?.rolls ?? 0) +
    (viewerProfileForLimit?.tokenRolls ?? 0) +
    (viewerProfileForLimit?.potionRolls ?? 0);
  const rollProgressBonus = trustedMultiroll ? 0 : getRollLimitProgressBonus(totalProfileRollsForLimit);

  const maxAllowed = getRoleRollLimit({
    userLevel: user?.userLevel,
    isMod,
    trustedMultiroll,
    rollProgressBonus,
  });

  const limitName = getRoleRollLimitName({
    userLevel: user?.userLevel,
    isMod,
    trustedMultiroll,
  });

  if (amount > maxAllowed) {
    return error(res, `Max ${limitName} multi-roll is ${maxAllowed}.`);
  }

  const safeSimulation = amount >= SAFE_ROLL_THRESHOLD;

  if (!Number.isFinite(requestedSafeLuckMultiplier)) {
    return error(
      res,
      "Safe luck must be a number from 1 to 1000000. Example: !roll 5000 2"
    );
  }

  if (!safeSimulation && requestedSafeLuckMultiplier !== 1) {
    return error(
      res,
      "Extra luck is only available for 2,500+ safe simulations."
    );
  }

  if (requestedSafeLuckMultiplier > MAX_SAFE_LUCK_MULTIPLIER) {
    return error(
      res,
      `Maximum safe-simulation luck is x${MAX_SAFE_LUCK_MULTIPLIER}.`
    );
  }

  const safeLuckMultiplier = safeSimulation
    ? requestedSafeLuckMultiplier
    : 1;

  const achievementBonuses = await getAchievementBonuses();
  const coreLuck = await getViewerCoreLuck(channelId, user);
  const serverLuck = await getServerLuckMultiplier(channelId);
  const megaLuck = await getMegaLuckMultiplier(channelId);

  const cooldownMs = Math.max(
    1000,
    ROLL_COOLDOWN_MS - achievementBonuses.cooldownReductionSeconds * 1000
  );

  if (!safeSimulation && !isMod && !trustedMultiroll) {
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

  const tokenPlan: RollTokenPlan = safeSimulation
    ? { effects: [] }
    : await consumeRollTokenBuffsForRolls({
        channelId,
        user,
        rolls: rollCount,
      });

  const oneTimeTokenAssisted = tokenPlan.effects.some((effect) =>
    effect.used.some((buff) => buff.consumeOnRoll)
  );

  const globalRollsAfter = safeSimulation
    ? await getGlobalRolls()
    : await addGlobalRolls(rollCount);

  // Safe mode advances a virtual roll index for luck calculations only.
  // Nothing is committed to the global-roll counter.
  const firstGlobalRoll = safeSimulation
    ? Math.max(1, globalRollsAfter + 1)
    : Math.max(1, globalRollsAfter - rollCount + 1);

  const runWithState = safeSimulation
    ? async (fn: (state: ChannelState) => Promise<void>) =>
        fn(await getSafeSimulationState(channelId, channelName))
    : async (fn: (state: ChannelState) => Promise<void>) =>
        withTick(channelId, channelName, fn);

  return runWithState(async (state) => {
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

      const calculatedLuck = calculateRollLuck({
        baseLuck,
        tokenFlatLuck: tokenEffect.flatLuck,
        tokenPercentLuck: tokenEffect.percentLuck,
        tokenRareBiomePercentLuck: tokenEffect.rareBiomePercentLuck,
        tokenFinalLuckMultiplier: tokenEffect.finalLuckMultiplier,
        achievementFlatLuck: achievementBonuses.flatLuck,
        achievementFinalLuckMultiplier:
          achievementBonuses.finalLuckMultiplier *
          serverLuck.multiplier *
          megaLuck.multiplier,
        rareBiomeActive,
      });

      const luck = calculatedLuck * safeLuckMultiplier;

      const result = rollOnce({
        state,
        luck,
        potionId: tokenEffect.potionId,
      });

      results.push(result);
    }

    const top = topRarest(results, displayCount);

    let unlockText = "";

    if (!safeSimulation) {
      await recordViewerRolls(
        channelId,
        user,
        results,
        oneTimeTokenAssisted ? "token" : "roll"
      );

      await recordCoreRolls(channelId, user, results);
      await recordSocialRolls(
        channelId,
        user,
        results,
        oneTimeTokenAssisted ? "token" : "roll"
      );

      await recordMegaRolls({
        channelId,
        channelName: channelLoginName,
        user,
        results,
        source: oneTimeTokenAssisted ? "token" : "roll",
      });

      await recordActivityRolls({
        channelId,
        channelName: channelLoginName,
        user,
        results,
      });

      const unlocked = await recordAuraRolls(results);
      unlockText = formatAchievementUnlocks(unlocked);
    }

    const tokenUsage = formatConsumedRollTokenEffects(tokenPlan.effects);
    const tokenText = tokenUsage ? ` | Tokens used: ${tokenUsage}` : "";
    const serverBoostText =
      serverLuck.percent > 0
        ? ` | Server Boost +${Math.floor(serverLuck.percent)}%`
        : "";
    const megaBoostText =
      megaLuck.percent > 0
        ? ` | Event +${Math.floor(megaLuck.percent)}%`
        : "";
    const safeText = safeSimulation
      ? ` | 🛡 SAFE SIM x${formatSafeLuckMultiplier(
          safeLuckMultiplier
        )} luck: no stats/items/quests/records/alerts changed; tokens ignored`
      : "";
    const suffix = `${safeText}${
      unlockText ? ` | ${unlockText}` : ""
    }${tokenText}${serverBoostText}${megaBoostText}`;

    if (displayCount === 1) {
      const best = top[0];
      text(res, `${formatRollResult(name, best.aura.name, best.effectiveRarity)}${suffix}`);

      if (!safeSimulation) {
        await runAfterCommandReply(() =>
          announceAuraResults({
            channelId,
            channelName: channelLoginName,
            displayName: name,
            results,
            source: "roll",
          })
        );
      }

      return;
    }

    const msg =
      `${name} rolled ${rollCount}x — top ${displayCount}: ` +
      formatMultiRoll(top.map((r) => ({ name: r.aura.name, rarity: r.effectiveRarity })));

    text(res, `${msg}${suffix}`);

    if (!safeSimulation) {
      await runAfterCommandReply(() =>
        announceAuraResults({
          channelId,
          channelName: channelLoginName,
          displayName: name,
          results,
          source: "roll",
        })
      );
    }

    return;
  });
}

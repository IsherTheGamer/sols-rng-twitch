import type { NextApiRequest, NextApiResponse } from "next";
import { getChannelContext } from "@/lib/nightbot";
import {
  getChannelState,
  setChannelState,
  formatRemaining,
} from "@/lib/state";
import { findDevice, biomeMap } from "@/lib/data";
import { rollDeviceBiome } from "@/lib/biome-engine";
import { text, error, parseQuery } from "@/lib/api-helpers";
import { recordBiomeVisit } from "@/lib/global-stats";
import { formatAchievementUnlocks } from "@/lib/achievements";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { channelId, channelName } = getChannelContext(req);

  const query = parseQuery(req);
  const device = findDevice(query);

  if (!device) {
    return error(res, "Use: Strange Controller or Biome Randomizer");
  }

  const state = await getChannelState(channelId, channelName);
  const now = Date.now();

  if (state.deviceServerCooldownUntil > now) {
    return text(
      res,
      `Server device cooldown: ${formatRemaining(
        state.deviceServerCooldownUntil
      )}`
    );
  }

  const userCd =
    device.id === "strange_controller"
      ? state.strangeControllerCooldownUntil
      : state.biomeRandomizerCooldownUntil;

  if (userCd > now) {
    return text(res, `Device cooldown: ${formatRemaining(userCd)}`);
  }

  const activeDev =
    state.activeDevBiome !== null &&
    state.devExpiresAt > now;

  if (activeDev) {
    const devBiome = biomeMap.get(state.activeDevBiome!);

    if (devBiome?.blocksDevices) {
      return error(res, "You're in a unchangable biome.");
    }
  }

  const nextId = rollDeviceBiome(
    state,
    device.id,
    device.usesNaturalRates ?? false
  );

  if (nextId === state.biomeId) {
    return text(
      res,
      `${device.name} used — biome unchanged (${
        biomeMap.get(state.biomeId)?.name ?? state.biomeId
      }).`
    );
  }

  const biome = biomeMap.get(nextId);

  state.biomeId = nextId;
  state.biomeExpiresAt =
    Date.now() + (biome?.durationSeconds ?? 120) * 1000;

  state.deviceServerCooldownUntil =
    now + device.serverCooldownSeconds * 1000;

  if (device.id === "strange_controller") {
    state.strangeControllerCooldownUntil =
      now + device.userCooldownSeconds * 1000;
  } else {
    state.biomeRandomizerCooldownUntil =
      now + device.userCooldownSeconds * 1000;
  }

  await setChannelState(state);

  const unlocked = await recordBiomeVisit(
    state.biomeId,
    state.biomeExpiresAt
  );

  const unlockText = formatAchievementUnlocks(unlocked);
  const suffix = unlockText ? ` | ${unlockText}` : "";

  return text(
    res,
    `${device.name} activated! Biome: ${
      biome?.name ?? nextId
    }. ${biome?.chatSpawn ?? ""}${suffix}`
  );
}

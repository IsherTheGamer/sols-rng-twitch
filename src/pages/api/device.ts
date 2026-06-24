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

  /* ----------------------------
     SERVER COOLDOWN
  ---------------------------- */
  if (state.deviceServerCooldownUntil > now) {
    return text(
      res,
      `Server device cooldown: ${formatRemaining(state.deviceServerCooldownUntil)}`
    );
  }

  /* ----------------------------
     USER COOLDOWN
  ---------------------------- */
  const userCd =
    device.id === "strange_controller"
      ? state.strangeControllerCooldownUntil
      : state.biomeRandomizerCooldownUntil;

  if (userCd > now) {
    return text(
      res,
      `Device cooldown: ${formatRemaining(userCd)}`
    );
  }

  /* ----------------------------
     DEV BIOME BLOCK CHECK
  ---------------------------- */
  const activeDev =
    state.activeDevBiome !== null &&
    state.devExpiresAt > now;

  if (activeDev) {
    const devBiome = biomeMap.get(state.activeDevBiome!);

    if (devBiome?.blocksDevices) {
      return error(res, "You're in a wrong dimension.");
    }
  }

  /* ----------------------------
     ROLL NEXT BIOME
  ---------------------------- */
  const nextId = rollDeviceBiome(
    state,
    device.id,
    device.usesNaturalRates ?? false
  );

  /* ----------------------------
     NO CHANGE CASE
  ---------------------------- */
  if (nextId === state.biomeId) {
    return text(
      res,
      `${device.name} used — biome unchanged (${biomeMap.get(state.biomeId)?.name}).`
    );
  }

  /* ----------------------------
     APPLY CHANGE (INLINE FIX)
     (no applyBiomeChange dependency)
  ---------------------------- */
  state.biomeId = nextId;
  state.biomeExpiresAt = Date.now() + 120000;

  /* ----------------------------
     COOLDOWNS
  ---------------------------- */
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

  /* ----------------------------
     RESPONSE
  ---------------------------- */
  const b = biomeMap.get(nextId);

  return text(
    res,
    `${device.name} activated! Biome: ${b?.name ?? nextId}. ${b?.chatSpawn ?? ""}`
  );
}

import type { BiomeDef, ChannelState } from "../types/data";
import {
  biomeMap,
  NORMAL_POOL_WEIGHTS,
  RANDOMIZER_POOL,
  TIME_CYCLE_SECONDS,
  STATUS_INTERVAL_SECONDS,
} from "./data";
import { rollInt, pickWeighted, pickEqual } from "./rng";
import { formatRemaining } from "./state";
import { formatBiomeStatus } from "./format";
import { sendNightbotMessage } from "./nightbot";

export interface TickResult {
  state: ChannelState;
  biomeChanged: boolean;
  changeMessage: string | null;
  statusMessage: string | null;
}

function getBiome(id: string): BiomeDef {
  return biomeMap.get(id) ?? biomeMap.get("normal")!;
}

function isDevActive(state: ChannelState): boolean {
  return state.activeDevBiome !== null && state.devExpiresAt > Date.now();
}

/* ----------------------------
   BIOME ROLLS
---------------------------- */

function tryRareSpawnPerSecond(state: ChannelState, atMs: number): string | null {
  const isNormalish =
    state.biomeId === "normal" || state.biomeExpiresAt <= atMs;

  if (!isNormalish) return null;

  const dream = biomeMap.get("dreamspace")!;
  if (dream.spawnPerSecond && rollInt(dream.spawnPerSecond) === 1) {
    return "dreamspace";
  }

  return null;
}

function tryGlitchedOnChange(): string | null {
  const glitched = biomeMap.get("glitched")!;
  if (glitched.spawnOnChange && rollInt(glitched.spawnOnChange) === 1) {
    return "glitched";
  }
  return null;
}

function rollNaturalBiome(): string {
  const candidates: Array<{ id: string; chance: number }> = [];

  for (const w of NORMAL_POOL_WEIGHTS) {
    const b = biomeMap.get(w.id);
    if (!b?.spawnPerSecond) continue;

    if (rollInt(b.spawnPerSecond) === 1) {
      candidates.push({ id: w.id, chance: 1 / b.spawnPerSecond });
    }
  }

  if (candidates.length === 0) return "normal";

  return pickWeighted(candidates, (c) => c.chance).id;
}

function rollEventBiomeOverride(state: ChannelState): string | null {
  if (state.timeOfDay === "nighttime") {
    for (const id of ["graveyard", "pumpkin_moon"]) {
      const b = biomeMap.get(id);
      if (!b?.nightChance) continue;

      if (state.activeEvents.some((e) => e.includes("halloween"))) {
        if (rollInt(b.nightChance) === 1) return id;
      }
    }
  }

  if (state.timeOfDay === "daytime") {
    const blazing = biomeMap.get("blazing_sun");

    if (
      blazing?.dayChance &&
      state.activeEvents.some((e) => e.includes("summer")) &&
      rollInt(blazing.dayChance) === 1
    ) {
      return "blazing_sun";
    }
  }

  for (const eventId of state.activeEvents) {
    if (eventId.includes("easter")) return "eggland";
    if (eventId.includes("christmas")) {
      const aurora = biomeMap.get("aurora");

      if (
        aurora?.spawnPerSecond &&
        state.biomeId === "snowy" &&
        rollInt(aurora.spawnPerSecond) === 1
      ) {
        return "aurora";
      }
    }
  }

  return null;
}

/* ----------------------------
   BIOME DURATION
---------------------------- */

function setBiomeDuration(state: ChannelState, biomeId: string, atMs: number) {
  const b = getBiome(biomeId);

  const base = Math.max(Date.now(), atMs);

  if (b.durationUntilNightEnd && state.timeOfDay === "nighttime") {
    state.biomeExpiresAt = state.timeExpiresAt;
  } else if (b.durationUntilNight && state.timeOfDay === "daytime") {
    state.biomeExpiresAt = state.timeExpiresAt;
  } else if (b.durationSeconds) {
    state.biomeExpiresAt = base + b.durationSeconds * 1000;
  } else {
    state.biomeExpiresAt = base + 120000;
  }
}

/* ----------------------------
   CORE BIOME TRANSITION
---------------------------- */

function rollNextBiome(state: ChannelState, atMs: number): string {
  if (isDevActive(state)) {
    return state.activeDevBiome!;
  }

  const rare = tryRareSpawnPerSecond(state, atMs);
  if (rare) return rare;

  const eventOverride = rollEventBiomeOverride(state);
  if (eventOverride) return eventOverride;

  const glitched = tryGlitchedOnChange();
  if (glitched) return glitched;

  return rollNaturalBiome();
}

/* ----------------------------
   SIMULATION LOOP
---------------------------- */

function simulateSeconds(state: ChannelState, seconds: number): TickResult {
  let biomeChanged = false;
  let changeMessage: string | null = null;

  const startTick = state.lastTickAt;

  for (let s = 0; s < seconds; s++) {
    const atMs = startTick + (s + 1) * 1000;

    /* TIME CYCLE */
    while (state.timeExpiresAt <= atMs) {
      state.timeOfDay =
        state.timeOfDay === "daytime" ? "nighttime" : "daytime";

      state.timeExpiresAt += TIME_CYCLE_SECONDS * 1000;
    }

    /* DEV BIOME EXPIRE */
    if (state.devExpiresAt > 0 && state.devExpiresAt <= atMs) {
      state.activeDevBiome = null;
      state.devExpiresAt = 0;
    }

    const expired = state.biomeExpiresAt <= atMs;

    /* 🔥 FIXED CORE LOGIC */
    if (expired) {
      const prev = state.biomeId;

      let next = rollNextBiome(state, atMs);

      // HARD SAFETY: never allow stuck state
      if (!next || next === prev) {
        next = "normal";
      }

      state.biomeId = next;
      setBiomeDuration(state, next, atMs);

      biomeChanged = true;

      const b = getBiome(next);
      changeMessage = b.chatSpawn ?? `[${b.name}] has spawned.`;
    }
  }

  state.lastTickAt = startTick + seconds * 1000;

  let statusMessage: string | null = null;

  const now = Date.now();
  if (
    state.lastStatusAt === 0 ||
    now - state.lastStatusAt >= STATUS_INTERVAL_SECONDS * 1000
  ) {
    state.lastStatusAt = now;

    const b = getBiome(state.biomeId);
    statusMessage = formatBiomeStatus(
      b.name,
      formatRemaining(state.biomeExpiresAt),
      state.timeOfDay
    );
  }

  return { state, biomeChanged, changeMessage, statusMessage };
}

/* ----------------------------
   EXTERNAL API
---------------------------- */

export async function processBiomeTick(
  state: ChannelState,
  elapsedMs: number
): Promise<TickResult> {
  const seconds = Math.max(1, Math.min(120, Math.floor(elapsedMs / 1000)));

  const result = simulateSeconds(state, seconds);

  if (result.changeMessage) {
    await sendNightbotMessage(result.changeMessage);
  }

  if (result.statusMessage) {
    await sendNightbotMessage(result.statusMessage);
  }

  return result;
}

/* ----------------------------
   STATUS
---------------------------- */

export function getBiomeStatus(state: ChannelState): string {
  const b = getBiome(state.biomeId);

  return formatBiomeStatus(
    b.name,
    formatRemaining(state.biomeExpiresAt),
    state.timeOfDay
  );
}
export function rollDeviceBiome(
  state: ChannelState,
  deviceId: string,
  useNaturalRates: boolean
): string {
  // extreme rare override
  if (rollInt(5000) === 1) return "cyberspace";

  if (useNaturalRates) {
    const glitched = tryGlitchedOnChange();
    if (glitched) return glitched;
    return rollNaturalBiome();
  }

  const glitched = tryGlitchedOnChange();
  if (glitched) return glitched;

  const pool = RANDOMIZER_POOL.filter((id) => biomeMap.has(id));
  return pickEqual(pool);
}

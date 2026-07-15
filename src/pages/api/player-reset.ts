import { Redis } from "@upstash/redis";
import type { NextApiRequest, NextApiResponse } from "next";

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) return null;

  redis = new Redis({ url, token });
  return redis;
}

const RESET_CATEGORIES = [
  "profile",
  "inventory",
  "core",
  "knowledge",
  "social",
  "quests",
  "leaderboards",
  "records",
  "cooldowns",
  "access",
  "other",
] as const;

type ResetCategory = (typeof RESET_CATEGORIES)[number];

interface ResetRequestBody {
  channelId?: string;
  username?: string;
  userId?: string;
  categories?: string[];
  preview?: boolean;
  confirmation?: string;
}

interface TargetPlayer {
  channelId: string;
  username: string;
  userId: string;
  displayName: string;
  profileKey: string;
}

interface SharedMutation {
  kind:
    | "profile-index"
    | "recent-pulls"
    | "mega-stats"
    | "mega-global-stats"
    | "replay"
    | "records"
    | "firsts"
    | "aok-channel"
    | "npc-claims"
    | "flex"
    | "roll-access";
  key: string;
  matches: number;
  description: string;
}

interface ResetPlan {
  target: TargetPlayer;
  categories: ResetCategory[];
  deleteKeys: string[];
  mutations: SharedMutation[];
  notes: string[];
}

function firstHeader(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function queryValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function isAuthorized(req: NextApiRequest, body: ResetRequestBody): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const authorization = firstHeader(req.headers.authorization);
  if (authorization === `Bearer ${secret}`) return true;

  const queryToken = queryValue(req.query.token);
  if (queryToken === secret) return true;

  const bodyToken =
    body && typeof (body as ResetRequestBody & { token?: unknown }).token === "string"
      ? String((body as ResetRequestBody & { token?: string }).token)
      : "";

  return bodyToken === secret;
}

function cleanId(value: unknown, fallback = ""): string {
  return String(value ?? fallback)
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "");
}

function normalizeUsername(value: unknown): string {
  return String(value ?? "")
    .trim()
    .replace(/^@+/, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "");
}

function cleanDisplayName(value: unknown): string {
  return String(value ?? "")
    .trim()
    .replace(/^@+/, "")
    .replace(/[^a-zA-Z0-9_ -]/g, "")
    .slice(0, 50);
}

function selectedCategories(raw: unknown): ResetCategory[] {
  const requested = Array.isArray(raw)
    ? raw.map((value) => String(value).toLowerCase())
    : [];

  const selected = RESET_CATEGORIES.filter((category) =>
    requested.includes(category)
  );

  return selected.length > 0 ? selected : [...RESET_CATEGORIES];
}

async function keysByPattern(r: Redis, pattern: string): Promise<string[]> {
  try {
    return await r.keys(pattern);
  } catch {
    return [];
  }
}

async function resolveTarget(
  r: Redis,
  channelId: string,
  rawUserId: string,
  rawUsername: string
): Promise<TargetPlayer | null> {
  const requestedId = cleanId(rawUserId);
  const username = normalizeUsername(rawUsername);
  const indexKey = `profiles:${channelId}:keys`;
  const indexedKeys = (await r.get<string[]>(indexKey)) ?? [];

  if (requestedId) {
    const profileKey = `profile:${channelId}:${requestedId}`;
    const profile = await r.get<Record<string, unknown>>(profileKey);

    return {
      channelId,
      userId: requestedId,
      username:
        username ||
        normalizeUsername(profile?.displayName) ||
        requestedId,
      displayName:
        cleanDisplayName(profile?.displayName) ||
        cleanDisplayName(rawUsername) ||
        requestedId,
      profileKey,
    };
  }

  if (!username) return null;

  const profiles = await Promise.all(
    indexedKeys.slice(0, 1000).map(async (key) => ({
      key,
      profile: await r.get<Record<string, unknown>>(key),
    }))
  );

  const match = profiles.find(({ key, profile }) => {
    const keyUserId = key.split(":").pop() ?? "";
    const displayName = normalizeUsername(profile?.displayName);
    return displayName === username || keyUserId === username;
  });

  if (!match) return null;

  const userId =
    cleanId(match.profile?.userId) ||
    cleanId(match.key.split(":").pop());

  if (!userId) return null;

  return {
    channelId,
    userId,
    username,
    displayName:
      cleanDisplayName(match.profile?.displayName) ||
      cleanDisplayName(rawUsername) ||
      username,
    profileKey: `profile:${channelId}:${userId}`,
  };
}

function categorySelected(
  categories: ResetCategory[],
  category: ResetCategory
): boolean {
  return categories.includes(category);
}

function addDeleteKey(keys: Set<string>, key: string): void {
  if (key.trim()) keys.add(key);
}

function isSharedKey(key: string, channelId: string): boolean {
  return (
    key === `profiles:${channelId}:keys` ||
    key === `social:recent:${channelId}` ||
    key === `social:npc:${channelId}` ||
    key === `social:flex:${channelId}` ||
    key === `mega:replay:${channelId}` ||
    key === `mega:records:${channelId}` ||
    key === `mega:firsts:${channelId}` ||
    key === `aok:channel:${channelId}` ||
    key === `roll-access:${channelId}` ||
    key.startsWith(`mega:stats:${channelId}:`) ||
    key.startsWith("mega:gstats:")
  );
}

async function addOtherPlayerKeys(
  r: Redis,
  keys: Set<string>,
  target: TargetPlayer
): Promise<void> {
  const patterns = [
    `*:${target.channelId}:${target.userId}`,
    `*:${target.channelId}:${target.userId}:*`,
    `*:${target.channelId}:*:${target.userId}`,
    `*:${target.channelId}:*:${target.userId}:*`,
  ];

  const found = new Set<string>();

  for (const pattern of patterns) {
    for (const key of await keysByPattern(r, pattern)) {
      found.add(key);
    }
  }

  for (const key of found) {
    if (!isSharedKey(key, target.channelId)) addDeleteKey(keys, key);
  }
}

async function countArrayUserMatches(
  r: Redis,
  key: string,
  target: TargetPlayer
): Promise<number> {
  const list = (await r.get<Array<Record<string, unknown>>>(key)) ?? [];

  return list.filter((entry) => {
    const entryId = cleanId(entry?.userId);
    const entryName = normalizeUsername(
      entry?.userName ?? entry?.displayName ?? entry?.name
    );

    return (
      entryId === target.userId ||
      (target.username && entryName === target.username)
    );
  }).length;
}

async function buildPlan(
  r: Redis,
  body: ResetRequestBody
): Promise<ResetPlan> {
  const channelId = cleanId(body.channelId, "904797805");
  if (!channelId) throw new Error("Enter a valid Twitch channel ID.");

  const categories = selectedCategories(body.categories);
  const target = await resolveTarget(
    r,
    channelId,
    cleanId(body.userId),
    normalizeUsername(body.username)
  );

  if (!target) {
    throw new Error(
      "Player not found. Enter their numeric Twitch user ID, or a username that already has a saved profile."
    );
  }

  const deleteKeys = new Set<string>();
  const mutations: SharedMutation[] = [];
  const notes: string[] = [];

  if (categorySelected(categories, "profile")) {
    addDeleteKey(deleteKeys, target.profileKey);

    const index = (await r.get<string[]>(`profiles:${channelId}:keys`)) ?? [];
    const matches = index.filter((key) => key === target.profileKey).length;

    if (matches > 0) {
      mutations.push({
        kind: "profile-index",
        key: `profiles:${channelId}:keys`,
        matches,
        description: "Remove the player from the saved-profile/leaderboard index.",
      });
    }
  }

  if (categorySelected(categories, "inventory")) {
    addDeleteKey(deleteKeys, `inventory:${channelId}:${target.userId}`);

    if (target.username) {
      addDeleteKey(
        deleteKeys,
        `inventory-grants:${channelId}:${target.username}`
      );
    }
  }

  if (categorySelected(categories, "core")) {
    addDeleteKey(deleteKeys, `core-system:${channelId}:${target.userId}`);
  }

  if (categorySelected(categories, "knowledge")) {
    addDeleteKey(deleteKeys, `aok:player:${channelId}:${target.userId}`);

    const aokChannelKey = `aok:channel:${channelId}`;
    const state = await r.get<Record<string, any>>(aokChannelKey);
    const participant = state?.boss?.participants?.[target.userId];

    if (participant) {
      mutations.push({
        kind: "aok-channel",
        key: aokChannelKey,
        matches: 1,
        description:
          "Remove the player from the active Activity-of-Knowledge boss participant list.",
      });
    }
  }

  if (categorySelected(categories, "social")) {
    addDeleteKey(deleteKeys, `social:titles:${channelId}:${target.userId}`);

    const recentKey = `social:recent:${channelId}`;
    const recentMatches = await countArrayUserMatches(r, recentKey, target);

    if (recentMatches > 0) {
      mutations.push({
        kind: "recent-pulls",
        key: recentKey,
        matches: recentMatches,
        description: "Remove the player's entries from recent rare pulls.",
      });
    }

    const flexKey = `social:flex:${channelId}`;
    const flex = await r.get<Record<string, unknown>>(flexKey);
    const flexMatches =
      flex &&
      (cleanId(flex.challengerId) === target.userId ||
        normalizeUsername(flex.challengerName) === target.username ||
        normalizeUsername(flex.targetName) === target.username)
        ? 1
        : 0;

    if (flexMatches > 0) {
      mutations.push({
        kind: "flex",
        key: flexKey,
        matches: flexMatches,
        description:
          "Cancel the active flex challenge if this player is involved.",
      });
    }
  }

  if (categorySelected(categories, "quests")) {
    addDeleteKey(deleteKeys, `mega:luck:${channelId}:${target.userId}`);

    for (const key of await keysByPattern(
      r,
      `mega:qclaim:${channelId}:${target.userId}:*`
    )) {
      addDeleteKey(deleteKeys, key);
    }

    const npcKey = `social:npc:${channelId}`;
    const npc = await r.get<Record<string, any>>(npcKey);
    const npcMatches = Array.isArray(npc?.quests)
      ? npc.quests.filter(
          (quest: Record<string, any>) =>
            quest?.claimedBy?.[target.userId] === true
        ).length
      : 0;

    if (npcMatches > 0) {
      mutations.push({
        kind: "npc-claims",
        key: npcKey,
        matches: npcMatches,
        description:
          "Remove the player's NPC quest claim markers so their quest history is reset.",
      });
    }
  }

  if (categorySelected(categories, "leaderboards")) {
    for (const key of await keysByPattern(
      r,
      `mega:stats:${channelId}:*`
    )) {
      const stats = await r.get<Record<string, any>>(key);
      if (stats?.users?.[target.userId]) {
        mutations.push({
          kind: "mega-stats",
          key,
          matches: 1,
          description:
            "Remove the player from a channel daily/weekly/monthly/yearly leaderboard.",
        });
      }
    }

    const globalUserKey = `${channelId}:${target.userId}`;

    for (const key of await keysByPattern(r, "mega:gstats:*")) {
      const stats = await r.get<Record<string, any>>(key);
      if (stats?.users?.[globalUserKey]) {
        mutations.push({
          kind: "mega-global-stats",
          key,
          matches: 1,
          description:
            "Remove the player from a cross-channel period leaderboard.",
        });
      }
    }
  }

  if (categorySelected(categories, "records")) {
    const replayKey = `mega:replay:${channelId}`;
    const replayMatches = await countArrayUserMatches(r, replayKey, target);

    if (replayMatches > 0) {
      mutations.push({
        kind: "replay",
        key: replayKey,
        matches: replayMatches,
        description: "Remove the player's rare-pull replay history.",
      });
    }

    const recordsKey = `mega:records:${channelId}`;
    const records = await r.get<Record<string, any>>(recordsKey);
    const recordMatches = [
      records?.bestAura,
      records?.biggestToday,
      records?.mostRollsUser,
    ].filter(
      (entry) =>
        cleanId(entry?.userId) === target.userId ||
        normalizeUsername(entry?.userName) === target.username
    ).length;

    if (recordMatches > 0) {
      mutations.push({
        kind: "records",
        key: recordsKey,
        matches: recordMatches,
        description:
          "Clear channel record slots currently owned by this player.",
      });
    }

    const firstsKey = `mega:firsts:${channelId}`;
    const firsts = await r.get<Record<string, any>>(firstsKey);
    const firstMatches = Object.values(firsts?.auras ?? {}).filter(
      (entry: any) =>
        cleanId(entry?.userId) === target.userId ||
        normalizeUsername(entry?.userName) === target.username
    ).length;

    if (firstMatches > 0) {
      mutations.push({
        kind: "firsts",
        key: firstsKey,
        matches: firstMatches,
        description:
          "Remove aura first-discovery entries belonging to this player.",
      });
    }
  }

  if (categorySelected(categories, "cooldowns")) {
    for (const key of await keysByPattern(
      r,
      `cd:*:${channelId}:${target.userId}`
    )) {
      addDeleteKey(deleteKeys, key);
    }

    for (const key of await keysByPattern(
      r,
      `cd:*:${channelId}:${target.userId}:*`
    )) {
      addDeleteKey(deleteKeys, key);
    }
  }

  if (categorySelected(categories, "access")) {
    const accessKey = `roll-access:${channelId}`;
    const entries =
      (await r.get<Array<Record<string, unknown>>>(accessKey)) ?? [];

    const matches = entries.filter(
      (entry) =>
        normalizeUsername(entry?.username) === target.username
    ).length;

    if (matches > 0) {
      mutations.push({
        kind: "roll-access",
        key: accessKey,
        matches,
        description:
          "Remove the player from the dynamic 10,000-roll allowlist.",
      });
    }
  }

  if (categorySelected(categories, "other")) {
    await addOtherPlayerKeys(r, deleteKeys, target);
    notes.push(
      "Other-player-key cleanup only deletes keys containing both the selected channel ID and exact numeric user ID. Shared server keys are excluded."
    );
  }

  notes.push(
    "Full Player Reset does not delete global roll totals, channel biome/event state, Discord settings, server boosts, or other players' profiles."
  );

  return {
    target,
    categories,
    deleteKeys: [...deleteKeys].sort(),
    mutations,
    notes,
  };
}

function removeTargetFromArray(
  list: Array<Record<string, any>>,
  target: TargetPlayer
): Array<Record<string, any>> {
  return list.filter((entry) => {
    const entryId = cleanId(entry?.userId);
    const entryName = normalizeUsername(
      entry?.userName ?? entry?.displayName ?? entry?.name
    );

    return !(
      entryId === target.userId ||
      (target.username && entryName === target.username)
    );
  });
}

async function applyMutation(
  r: Redis,
  mutation: SharedMutation,
  target: TargetPlayer
): Promise<void> {
  if (mutation.kind === "profile-index") {
    const index = (await r.get<string[]>(mutation.key)) ?? [];
    await r.set(
      mutation.key,
      index.filter((key) => key !== target.profileKey)
    );
    return;
  }

  if (
    mutation.kind === "recent-pulls" ||
    mutation.kind === "replay"
  ) {
    const list =
      (await r.get<Array<Record<string, any>>>(mutation.key)) ?? [];
    await r.set(mutation.key, removeTargetFromArray(list, target));
    return;
  }

  if (
    mutation.kind === "mega-stats" ||
    mutation.kind === "mega-global-stats"
  ) {
    const stats = await r.get<Record<string, any>>(mutation.key);
    if (!stats?.users) return;

    const userKey =
      mutation.kind === "mega-global-stats"
        ? `${target.channelId}:${target.userId}`
        : target.userId;

    delete stats.users[userKey];
    stats.updatedAt = Date.now();
    await r.set(mutation.key, stats);
    return;
  }

  if (mutation.kind === "records") {
    const records = await r.get<Record<string, any>>(mutation.key);
    if (!records) return;

    for (const field of [
      "bestAura",
      "biggestToday",
      "mostRollsUser",
    ]) {
      const entry = records[field];

      if (
        cleanId(entry?.userId) === target.userId ||
        normalizeUsername(entry?.userName) === target.username
      ) {
        delete records[field];
      }
    }

    records.updatedAt = Date.now();
    await r.set(mutation.key, records);
    return;
  }

  if (mutation.kind === "firsts") {
    const firsts = await r.get<Record<string, any>>(mutation.key);
    if (!firsts?.auras) return;

    for (const [auraId, entry] of Object.entries(firsts.auras)) {
      const value = entry as Record<string, unknown>;

      if (
        cleanId(value?.userId) === target.userId ||
        normalizeUsername(value?.userName) === target.username
      ) {
        delete firsts.auras[auraId];
      }
    }

    await r.set(mutation.key, firsts);
    return;
  }

  if (mutation.kind === "aok-channel") {
    const state = await r.get<Record<string, any>>(mutation.key);
    if (!state?.boss?.participants) return;

    delete state.boss.participants[target.userId];
    state.updatedAt = Date.now();
    await r.set(mutation.key, state);
    return;
  }

  if (mutation.kind === "npc-claims") {
    const state = await r.get<Record<string, any>>(mutation.key);
    if (!Array.isArray(state?.quests)) return;

    for (const quest of state.quests) {
      if (quest?.claimedBy) delete quest.claimedBy[target.userId];
    }

    await r.set(mutation.key, state);
    return;
  }

  if (mutation.kind === "flex") {
    await r.del(mutation.key);
    return;
  }

  if (mutation.kind === "roll-access") {
    const entries =
      (await r.get<Array<Record<string, unknown>>>(mutation.key)) ?? [];

    await r.set(
      mutation.key,
      entries.filter(
        (entry) =>
          normalizeUsername(entry?.username) !== target.username
      )
    );
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "Use POST from the player-reset dashboard.",
    });
  }

  const body = (req.body ?? {}) as ResetRequestBody;

  if (!isAuthorized(req, body)) {
    return res.status(401).json({
      ok: false,
      error: "Player reset locked. Enter the correct CRON_SECRET.",
    });
  }

  const r = getRedis();

  if (!r) {
    return res.status(503).json({
      ok: false,
      error: "Redis is not connected.",
    });
  }

  try {
    const plan = await buildPlan(r, body);
    const preview = body.preview !== false;

    if (preview) {
      return res.status(200).json({
        ok: true,
        preview: true,
        plan,
        totals: {
          directKeys: plan.deleteKeys.length,
          sharedMutations: plan.mutations.length,
          sharedEntries: plan.mutations.reduce(
            (sum, item) => sum + item.matches,
            0
          ),
        },
      });
    }

    const expectedConfirmation = `RESET ${plan.target.username}`;
    const alternativeConfirmation = `RESET ${plan.target.userId}`;
    const confirmation = String(body.confirmation ?? "").trim();

    if (
      confirmation !== expectedConfirmation &&
      confirmation !== alternativeConfirmation
    ) {
      return res.status(400).json({
        ok: false,
        error: `Confirmation must exactly match "${expectedConfirmation}" or "${alternativeConfirmation}".`,
      });
    }

    for (const mutation of plan.mutations) {
      await applyMutation(r, mutation, plan.target);
    }

    if (plan.deleteKeys.length > 0) {
      await Promise.all(plan.deleteKeys.map((key) => r.del(key)));
    }

    return res.status(200).json({
      ok: true,
      preview: false,
      message: `✅ Reset completed for ${plan.target.displayName} (${plan.target.userId}).`,
      deletedKeys: plan.deleteKeys.length,
      sharedMutations: plan.mutations.length,
      sharedEntriesRemoved: plan.mutations.reduce(
        (sum, item) => sum + item.matches,
        0
      ),
      categories: plan.categories,
      notes: plan.notes,
    });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

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

const BACKUP_PREFIX = "admin-reset-backup:";
const DEFAULT_CHANNEL_ID = "904797805";

const OPTION_IDS = [
  "recent_pulls",
  "first_auras",
  "first_biomes",
  "replay_history",
  "channel_records",
  "channel_period_stats",
  "global_period_stats",
  "global_rolls",
  "global_achievements",
  "global_quest_completions",

  "profiles",
  "profile_indexes",
  "inventories",
  "pending_inventory_grants",
  "core_players",
  "knowledge_players",
  "titles",
  "period_quest_claims",
  "luck_histories",
  "cooldowns",

  "channel_state",
  "activity_channel",
  "active_events",
  "black_market",
  "server_boosts",
  "npc_state",
  "flex_challenge",
  "discord_settings",
  "roll_access",
  "fun_fact_rotation",
  "rare_biome_dedupe",

  "remaining_channel_keys",
  "saved_reset_backups",
  "entire_database",
] as const;

type OptionId = (typeof OPTION_IDS)[number];
type Scope = "channel" | "all";

interface RequestBody {
  action?: "preview" | "execute" | "list_backups" | "restore";
  channelId?: string;
  scope?: Scope;
  options?: string[];
  createBackup?: boolean;
  confirmation?: string;
  backupKey?: string;
  token?: string;
}

interface MutationPlan {
  kind: "clear_first_auras" | "clear_first_biomes";
  key: string;
  description: string;
  currentEntries: number;
}

interface ResetPlan {
  scope: Scope;
  channelId: string;
  options: OptionId[];
  deleteKeys: string[];
  mutations: MutationPlan[];
  matchedKeyCount: number;
  estimatedStoredValues: number;
  nuclear: boolean;
  confirmation: string;
  notes: string[];
}

interface BackupSnapshot {
  version: 1;
  createdAt: number;
  scope: Scope;
  channelId: string;
  options: OptionId[];
  sourceKeyCount: number;
  values: Record<string, unknown>;
}

function firstHeader(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function queryValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function authorized(req: NextApiRequest, body: RequestBody): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const authorization = firstHeader(req.headers.authorization);
  if (authorization === `Bearer ${secret}`) return true;

  if (queryValue(req.query.token) === secret) return true;
  return body.token === secret;
}

function cleanChannelId(value: unknown): string {
  return String(value ?? DEFAULT_CHANNEL_ID)
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "") || DEFAULT_CHANNEL_ID;
}

function selectedOptions(raw: unknown): OptionId[] {
  const selected = new Set(
    Array.isArray(raw)
      ? raw.map((value) => String(value).toLowerCase())
      : []
  );

  return OPTION_IDS.filter((id) => selected.has(id));
}

function isBackupKey(key: string): boolean {
  return key.startsWith(BACKUP_PREFIX);
}

function keyHasChannel(key: string, channelId: string): boolean {
  return (
    key === channelId ||
    key.includes(`:${channelId}:`) ||
    key.endsWith(`:${channelId}`) ||
    key.startsWith(`channel:${channelId}:`)
  );
}

function optionMatchesKey(
  option: OptionId,
  key: string,
  scope: Scope,
  channelId: string
): boolean {
  const channel = (prefix: string) =>
    scope === "all"
      ? key.startsWith(prefix)
      : key.startsWith(`${prefix}${channelId}:`);

  const exactChannel = (prefix: string) =>
    scope === "all"
      ? key.startsWith(prefix)
      : key === `${prefix}${channelId}`;

  switch (option) {
    case "recent_pulls":
      return exactChannel("social:recent:");
    case "replay_history":
      return exactChannel("mega:replay:");
    case "channel_records":
      return exactChannel("mega:records:");
    case "channel_period_stats":
      return channel("mega:stats:");
    case "global_period_stats":
      return key.startsWith("mega:gstats:");
    case "global_rolls":
      return key === "global:rolls";
    case "global_achievements":
      return key === "global:achievement-state";
    case "global_quest_completions":
      return key === "mega:gquest-completions";

    case "profiles":
      return channel("profile:");
    case "profile_indexes":
      return exactChannel("profiles:") && key.endsWith(":keys");
    case "inventories":
      return channel("inventory:");
    case "pending_inventory_grants":
      return channel("inventory-grants:");
    case "core_players":
      return channel("core-system:");
    case "knowledge_players":
      return channel("aok:player:");
    case "titles":
      return channel("social:titles:");
    case "period_quest_claims":
      return channel("mega:qclaim:");
    case "luck_histories":
      return channel("mega:luck:");

    case "cooldowns":
      return scope === "all"
        ? key.startsWith("cd:")
        : key.startsWith("cd:") && keyHasChannel(key, channelId);

    case "channel_state":
      return scope === "all"
        ? key.startsWith("channel:") && key.endsWith(":state")
        : key === `channel:${channelId}:state`;
    case "activity_channel":
      return exactChannel("aok:channel:");
    case "active_events":
      return exactChannel("mega:event:");
    case "black_market":
      return exactChannel("mega:blackmarket:");
    case "server_boosts":
      return exactChannel("social:boosts:");
    case "npc_state":
      return exactChannel("social:npc:");
    case "flex_challenge":
      return exactChannel("social:flex:");
    case "discord_settings":
      return exactChannel("mega:discord:");
    case "roll_access":
      return exactChannel("roll-access:");
    case "fun_fact_rotation":
      return exactChannel("fun-fact:index:");
    case "rare_biome_dedupe":
      return exactChannel("mega:lastbiome:");

    case "remaining_channel_keys":
      return scope === "all" ? !isBackupKey(key) : keyHasChannel(key, channelId);
    case "saved_reset_backups":
      return isBackupKey(key);
    case "entire_database":
      return true;

    case "first_auras":
    case "first_biomes":
      return false;
  }
}

async function getAllKeys(r: Redis): Promise<string[]> {
  try {
    return (await r.keys("*")).sort();
  } catch {
    return [];
  }
}

async function mgetChunked(
  r: Redis,
  keys: string[],
  chunkSize = 200
): Promise<Array<unknown | null>> {
  const values: Array<unknown | null> = [];

  for (let index = 0; index < keys.length; index += chunkSize) {
    const chunk = keys.slice(index, index + chunkSize);
    if (chunk.length === 0) continue;
    const result = (await r.mget(...chunk)) as Array<unknown | null>;
    values.push(...result);
  }

  return values;
}

async function deleteChunked(
  r: Redis,
  keys: string[],
  chunkSize = 200
): Promise<void> {
  for (let index = 0; index < keys.length; index += chunkSize) {
    const chunk = keys.slice(index, index + chunkSize);
    if (chunk.length > 0) await r.del(...chunk);
  }
}

async function msetChunked(
  r: Redis,
  values: Record<string, unknown>,
  chunkSize = 100
): Promise<void> {
  const entries = Object.entries(values);

  for (let index = 0; index < entries.length; index += chunkSize) {
    const chunk = entries.slice(index, index + chunkSize);
    if (chunk.length === 0) continue;
    await r.mset(Object.fromEntries(chunk));
  }
}

async function firstKeys(
  allKeys: string[],
  scope: Scope,
  channelId: string
): Promise<string[]> {
  return allKeys.filter((key) => {
    if (!key.startsWith("mega:firsts:")) return false;
    return scope === "all" || key === `mega:firsts:${channelId}`;
  });
}

async function buildPlan(
  r: Redis,
  body: RequestBody
): Promise<ResetPlan> {
  const scope: Scope = body.scope === "all" ? "all" : "channel";
  const channelId = cleanChannelId(body.channelId);
  const options = selectedOptions(body.options);

  if (options.length === 0) {
    throw new Error("Select at least one global reset item.");
  }

  const nuclear = options.includes("entire_database");
  const allKeys = await getAllKeys(r);
  const deleteKeys = new Set<string>();
  const mutations: MutationPlan[] = [];

  for (const option of options) {
    if (option === "first_auras" || option === "first_biomes") continue;

    for (const key of allKeys) {
      if (optionMatchesKey(option, key, scope, channelId)) {
        deleteKeys.add(key);
      }
    }
  }

  const selectedFirstKeys = await firstKeys(allKeys, scope, channelId);
  const selectedFirstValues = await mgetChunked(r, selectedFirstKeys);

  for (let index = 0; index < selectedFirstKeys.length; index++) {
    const key = selectedFirstKeys[index];
    const value = selectedFirstValues[index] as
      | { auras?: Record<string, unknown>; biomes?: Record<string, unknown> }
      | null;

    if (options.includes("first_auras")) {
      mutations.push({
        kind: "clear_first_auras",
        key,
        description: "Clear all aura entries shown by !first / !firsts.",
        currentEntries: Object.keys(value?.auras ?? {}).length,
      });
    }

    if (options.includes("first_biomes")) {
      mutations.push({
        kind: "clear_first_biomes",
        key,
        description: "Clear all channel-owned biome first discoveries.",
        currentEntries: Object.keys(value?.biomes ?? {}).length,
      });
    }
  }

  // Firsts fields are edited instead of deleting the entire key unless another
  // selected option already catches the key.
  for (const mutation of mutations) {
    if (deleteKeys.has(mutation.key)) {
      mutation.description += " The whole firsts key is already selected for deletion.";
    }
  }

  const confirmation = nuclear
    ? "WIPE REDIS DATABASE"
    : scope === "all"
    ? "RESET ALL CHANNELS"
    : `RESET CHANNEL ${channelId}`;

  const notes = [
    "Preview is mandatory before execution.",
    "A recovery snapshot is created by default and stored inside Redis.",
    "First auras and first biomes are separate switches.",
    "The nuclear option matches every key. When backup is enabled, the newly created recovery snapshot is preserved.",
    "Vercel environment variables and GitHub files are never changed by this dashboard.",
  ];

  return {
    scope,
    channelId,
    options,
    deleteKeys: [...deleteKeys].sort(),
    mutations,
    matchedKeyCount: deleteKeys.size,
    estimatedStoredValues: deleteKeys.size + mutations.length,
    nuclear,
    confirmation,
    notes,
  };
}

async function createBackup(
  r: Redis,
  plan: ResetPlan
): Promise<string> {
  const backupSourceKeys = new Set(plan.deleteKeys);

  for (const mutation of plan.mutations) {
    backupSourceKeys.add(mutation.key);
  }

  const keys = [...backupSourceKeys].filter((key) => !isBackupKey(key));
  const values = await mgetChunked(r, keys);
  const stored: Record<string, unknown> = {};

  for (let index = 0; index < keys.length; index++) {
    if (values[index] !== null && values[index] !== undefined) {
      stored[keys[index]] = values[index];
    }
  }

  const createdAt = Date.now();
  const backupKey = `${BACKUP_PREFIX}${createdAt}`;
  const snapshot: BackupSnapshot = {
    version: 1,
    createdAt,
    scope: plan.scope,
    channelId: plan.channelId,
    options: plan.options,
    sourceKeyCount: Object.keys(stored).length,
    values: stored,
  };

  await r.set(backupKey, snapshot);
  return backupKey;
}

async function applyMutations(
  r: Redis,
  plan: ResetPlan
): Promise<number> {
  const active = plan.mutations.filter(
    (mutation) => !plan.deleteKeys.includes(mutation.key)
  );

  if (active.length === 0) return 0;

  const keys = [...new Set(active.map((mutation) => mutation.key))];
  const values = await mgetChunked(r, keys);
  const writes: Record<string, unknown> = {};
  let changed = 0;

  for (let index = 0; index < keys.length; index++) {
    const key = keys[index];
    const state = (values[index] ?? {
      auras: {},
      biomes: {},
    }) as {
      auras?: Record<string, unknown>;
      biomes?: Record<string, unknown>;
    };

    for (const mutation of active.filter((item) => item.key === key)) {
      if (mutation.kind === "clear_first_auras") {
        state.auras = {};
        changed += mutation.currentEntries;
      }

      if (mutation.kind === "clear_first_biomes") {
        state.biomes = {};
        changed += mutation.currentEntries;
      }
    }

    writes[key] = state;
  }

  await msetChunked(r, writes);
  return changed;
}

async function listBackups(r: Redis) {
  const keys = (await r.keys(`${BACKUP_PREFIX}*`)).sort().reverse();
  const values = await mgetChunked(r, keys);

  return keys.map((key, index) => {
    const backup = values[index] as BackupSnapshot | null;

    return {
      key,
      createdAt:
        backup?.createdAt ??
        Number(key.slice(BACKUP_PREFIX.length)) ??
        0,
      scope: backup?.scope ?? "unknown",
      channelId: backup?.channelId ?? "unknown",
      sourceKeyCount: backup?.sourceKeyCount ?? 0,
      options: backup?.options ?? [],
    };
  });
}

async function restoreBackup(
  r: Redis,
  backupKey: string,
  confirmation: string
) {
  if (!backupKey.startsWith(BACKUP_PREFIX)) {
    throw new Error("Invalid backup key.");
  }

  if (confirmation !== `RESTORE ${backupKey}`) {
    throw new Error(`Confirmation must exactly match "RESTORE ${backupKey}".`);
  }

  const snapshot = await r.get<BackupSnapshot>(backupKey);

  if (!snapshot?.values) {
    throw new Error("Backup not found or invalid.");
  }

  await msetChunked(r, snapshot.values);

  return {
    backupKey,
    restoredKeys: Object.keys(snapshot.values).length,
    createdAt: snapshot.createdAt,
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "Use POST from the global reset dashboard.",
    });
  }

  const body = (req.body ?? {}) as RequestBody;

  if (!authorized(req, body)) {
    return res.status(401).json({
      ok: false,
      error: "Global reset locked. Enter the correct CRON_SECRET.",
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
    const action = body.action ?? "preview";

    if (action === "list_backups") {
      return res.status(200).json({
        ok: true,
        backups: await listBackups(r),
      });
    }

    if (action === "restore") {
      const restored = await restoreBackup(
        r,
        String(body.backupKey ?? ""),
        String(body.confirmation ?? "")
      );

      return res.status(200).json({
        ok: true,
        message: `✅ Restored ${restored.restoredKeys} Redis keys from ${restored.backupKey}.`,
        restored,
        note:
          "Restore overwrites keys saved in the snapshot. It does not delete unrelated keys created afterward.",
      });
    }

    const plan = await buildPlan(r, body);

    if (action === "preview") {
      return res.status(200).json({
        ok: true,
        preview: true,
        plan,
      });
    }

    if (String(body.confirmation ?? "") !== plan.confirmation) {
      return res.status(400).json({
        ok: false,
        error: `Confirmation must exactly match "${plan.confirmation}".`,
      });
    }

    const createRecoveryBackup = body.createBackup !== false;
    const backupKey = createRecoveryBackup
      ? await createBackup(r, plan)
      : null;

    const mutationEntriesCleared = await applyMutations(r, plan);

    let keysToDelete = [...plan.deleteKeys];

    if (backupKey) {
      keysToDelete = keysToDelete.filter((key) => key !== backupKey);
    }

    await deleteChunked(r, keysToDelete);

    return res.status(200).json({
      ok: true,
      preview: false,
      message: "✅ Global reset completed.",
      scope: plan.scope,
      channelId: plan.channelId,
      selectedOptions: plan.options.length,
      deletedKeys: keysToDelete.length,
      firstEntriesCleared: mutationEntriesCleared,
      backupKey,
      backupCreated: Boolean(backupKey),
      notes: plan.notes,
    });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

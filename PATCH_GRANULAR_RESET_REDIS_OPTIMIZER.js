#!/usr/bin/env node
// Windows/CRLF-safe resume build v2.
const fs = require("fs");
const path = require("path");

const replacementFiles = {"src/pages/api/player-reset.ts": "import { Redis } from \"@upstash/redis\";\nimport type { NextApiRequest, NextApiResponse } from \"next\";\n\nlet redis: Redis | null = null;\n\nfunction getRedis(): Redis | null {\n  if (redis) return redis;\n\n  const url = process.env.UPSTASH_REDIS_REST_URL;\n  const token = process.env.UPSTASH_REDIS_REST_TOKEN;\n\n  if (!url || !token) return null;\n\n  redis = new Redis({ url, token });\n  return redis;\n}\n\nconst PROFILE_OPTIONS = [\n  \"profile_rolls\",\n  \"profile_token_rolls\",\n  \"profile_rarity_total\",\n  \"profile_xp\",\n  \"profile_level\",\n  \"profile_weekly_xp\",\n  \"profile_level_rewards\",\n  \"profile_dev_xp_auras\",\n  \"profile_owned_tiers\",\n  \"profile_highest_tier\",\n  \"profile_best_aura\",\n  \"profile_best_token\",\n  \"profile_index\",\n] as const;\n\nconst INVENTORY_OPTIONS = [\n  \"inventory_tokens\",\n  \"inventory_active_buffs\",\n  \"inventory_pending_grants\",\n] as const;\n\nconst CORE_OPTIONS = [\n  \"core_tier\",\n  \"core_path_focus\",\n  \"core_shd_level\",\n  \"core_stardust\",\n  \"core_wall_seed\",\n  \"core_materials\",\n  \"core_components\",\n  \"core_frames\",\n  \"core_subcores\",\n  \"core_reactor\",\n  \"core_tokens\",\n  \"core_lootboxes\",\n  \"core_quest_progress\",\n  \"core_quest_claims\",\n  \"core_achievements\",\n  \"core_unlocks\",\n  \"core_stats\",\n  \"core_jobs\",\n] as const;\n\nconst KNOWLEDGE_OPTIONS = [\n  \"knowledge_currency\",\n  \"knowledge_merchant_marks\",\n  \"knowledge_relic_shards\",\n  \"knowledge_blueprint_fragments\",\n  \"knowledge_scanner\",\n  \"knowledge_research\",\n  \"knowledge_blueprints\",\n  \"knowledge_relics\",\n  \"knowledge_stats\",\n  \"knowledge_boss_participation\",\n] as const;\n\nconst SHARED_OPTIONS = [\n  \"social_titles\",\n  \"social_recent_pulls\",\n  \"social_flex\",\n  \"quest_period_claims\",\n  \"quest_npc_claims\",\n  \"mega_luck_history\",\n  \"leaderboard_channel_periods\",\n  \"leaderboard_global_periods\",\n  \"records_replay\",\n  \"records_slots\",\n  \"records_first_aura_discoveries\",\n  \"player_cooldowns\",\n  \"roll_access\",\n  \"other_exact_player_keys\",\n] as const;\n\nconst ALL_OPTIONS = [\n  ...PROFILE_OPTIONS,\n  ...INVENTORY_OPTIONS,\n  ...CORE_OPTIONS,\n  ...KNOWLEDGE_OPTIONS,\n  ...SHARED_OPTIONS,\n] as const;\n\ntype ResetOption = (typeof ALL_OPTIONS)[number];\n\ninterface ResetRequestBody {\n  channelId?: string;\n  username?: string;\n  userId?: string;\n  options?: string[];\n  preview?: boolean;\n  confirmation?: string;\n  token?: string;\n}\n\ninterface TargetPlayer {\n  channelId: string;\n  username: string;\n  userId: string;\n  displayName: string;\n  profileKey: string;\n}\n\ninterface ResetPlanItem {\n  option: ResetOption;\n  kind: \"field\" | \"key\" | \"shared\";\n  key: string;\n  matches: number;\n  description: string;\n}\n\ninterface ResetPlan {\n  target: TargetPlayer;\n  options: ResetOption[];\n  fullPlayerReset: boolean;\n  items: ResetPlanItem[];\n  notes: string[];\n}\n\nfunction firstHeader(value: string | string[] | undefined): string {\n  return Array.isArray(value) ? value[0] ?? \"\" : value ?? \"\";\n}\n\nfunction queryValue(value: string | string[] | undefined): string {\n  return Array.isArray(value) ? value[0] ?? \"\" : value ?? \"\";\n}\n\nfunction isAuthorized(req: NextApiRequest, body: ResetRequestBody): boolean {\n  const secret = process.env.CRON_SECRET;\n  if (!secret) return false;\n\n  const authorization = firstHeader(req.headers.authorization);\n  if (authorization === `Bearer ${secret}`) return true;\n\n  const queryToken = queryValue(req.query.token);\n  if (queryToken === secret) return true;\n\n  return body.token === secret;\n}\n\nfunction cleanId(value: unknown, fallback = \"\"): string {\n  return String(value ?? fallback)\n    .trim()\n    .replace(/[^a-zA-Z0-9_-]/g, \"\");\n}\n\nfunction normalizeUsername(value: unknown): string {\n  return String(value ?? \"\")\n    .trim()\n    .replace(/^@+/, \"\")\n    .toLowerCase()\n    .replace(/[^a-z0-9_]/g, \"\");\n}\n\nfunction cleanDisplayName(value: unknown): string {\n  return String(value ?? \"\")\n    .trim()\n    .replace(/^@+/, \"\")\n    .replace(/[^a-zA-Z0-9_ -]/g, \"\")\n    .slice(0, 50);\n}\n\nfunction selectedOptions(raw: unknown): ResetOption[] {\n  const requested = new Set(\n    Array.isArray(raw)\n      ? raw.map((value) => String(value).toLowerCase())\n      : []\n  );\n\n  return ALL_OPTIONS.filter((option) => requested.has(option));\n}\n\nfunction hasAll(\n  selected: Set<ResetOption>,\n  options: readonly ResetOption[]\n): boolean {\n  return options.every((option) => selected.has(option));\n}\n\nasync function keysByPattern(r: Redis, pattern: string): Promise<string[]> {\n  try {\n    return await r.keys(pattern);\n  } catch {\n    return [];\n  }\n}\n\nasync function mgetValues(\n  r: Redis,\n  keys: string[]\n): Promise<Array<any | null>> {\n  if (keys.length === 0) return [];\n  return (await r.mget(...keys)) as Array<any | null>;\n}\n\nasync function resolveTarget(\n  r: Redis,\n  channelId: string,\n  rawUserId: string,\n  rawUsername: string\n): Promise<TargetPlayer | null> {\n  const requestedId = cleanId(rawUserId);\n  const username = normalizeUsername(rawUsername);\n\n  if (requestedId) {\n    const profileKey = `profile:${channelId}:${requestedId}`;\n    const profile = await r.get<Record<string, unknown>>(profileKey);\n\n    return {\n      channelId,\n      userId: requestedId,\n      username:\n        username ||\n        normalizeUsername(profile?.displayName) ||\n        requestedId,\n      displayName:\n        cleanDisplayName(profile?.displayName) ||\n        cleanDisplayName(rawUsername) ||\n        requestedId,\n      profileKey,\n    };\n  }\n\n  if (!username) return null;\n\n  const indexKey = `profiles:${channelId}:keys`;\n  const indexedKeys = (await r.get<string[]>(indexKey)) ?? [];\n  const values = await mgetValues(r, indexedKeys.slice(0, 5000));\n\n  for (let index = 0; index < values.length; index++) {\n    const profile = values[index] as Record<string, unknown> | null;\n    const key = indexedKeys[index] ?? \"\";\n    const keyUserId = cleanId(key.split(\":\").pop());\n    const displayName = normalizeUsername(profile?.displayName);\n\n    if (displayName !== username && keyUserId !== username) continue;\n\n    const userId = cleanId(profile?.userId) || keyUserId;\n    if (!userId) continue;\n\n    return {\n      channelId,\n      userId,\n      username,\n      displayName:\n        cleanDisplayName(profile?.displayName) ||\n        cleanDisplayName(rawUsername) ||\n        username,\n      profileKey: `profile:${channelId}:${userId}`,\n    };\n  }\n\n  return null;\n}\n\nfunction targetMatches(\n  value: Record<string, any> | null | undefined,\n  target: TargetPlayer\n): boolean {\n  if (!value) return false;\n\n  const userId = cleanId(value.userId);\n  const username = normalizeUsername(\n    value.userName ??\n      value.username ??\n      value.displayName ??\n      value.name\n  );\n\n  return (\n    userId === target.userId ||\n    (Boolean(target.username) && username === target.username)\n  );\n}\n\nfunction arrayMatchCount(\n  list: Array<Record<string, any>> | null | undefined,\n  target: TargetPlayer\n): number {\n  return (list ?? []).filter((entry) => targetMatches(entry, target)).length;\n}\n\nfunction removeTargetFromArray(\n  list: Array<Record<string, any>>,\n  target: TargetPlayer\n): Array<Record<string, any>> {\n  return list.filter((entry) => !targetMatches(entry, target));\n}\n\nfunction resetProfileFields(\n  profile: Record<string, any>,\n  selected: Set<ResetOption>\n): void {\n  if (selected.has(\"profile_rolls\")) profile.rolls = 0;\n\n  if (selected.has(\"profile_token_rolls\")) {\n    profile.tokenRolls = 0;\n    profile.potionRolls = 0;\n  }\n\n  if (selected.has(\"profile_rarity_total\")) profile.rarityTotal = 0;\n  if (selected.has(\"profile_xp\")) profile.xp = 0;\n  if (selected.has(\"profile_level\")) profile.level = 1;\n\n  if (selected.has(\"profile_weekly_xp\")) {\n    profile.weeklyXp = { weekId: \"\", tierCounts: {} };\n  }\n\n  if (selected.has(\"profile_level_rewards\")) {\n    profile.claimedLevelRewards = {};\n  }\n\n  if (selected.has(\"profile_dev_xp_auras\")) {\n    profile.devExclusiveXpAuras = [];\n  }\n\n  if (selected.has(\"profile_owned_tiers\")) profile.ownedTiers = {};\n\n  if (selected.has(\"profile_highest_tier\")) {\n    profile.highestTierId = null;\n    profile.highestTierRank = 0;\n  }\n\n  if (selected.has(\"profile_best_aura\")) profile.bestAura = null;\n\n  if (selected.has(\"profile_best_token\")) {\n    profile.bestTokenAura = null;\n    profile.bestPotionAura = null;\n  }\n\n  profile.updatedAt = Date.now();\n}\n\nfunction resetInventoryFields(\n  inventory: Record<string, any>,\n  selected: Set<ResetOption>\n): void {\n  if (selected.has(\"inventory_tokens\")) inventory.tokens = {};\n  if (selected.has(\"inventory_active_buffs\")) inventory.activeBuffs = [];\n  inventory.updatedAt = Date.now();\n}\n\nfunction resetCoreFields(\n  core: Record<string, any>,\n  selected: Set<ResetOption>,\n  target: TargetPlayer\n): void {\n  if (selected.has(\"core_tier\")) core.coreTier = 0;\n\n  if (selected.has(\"core_path_focus\")) {\n    core.corePath = \"universal\";\n    core.coreFocus = \"main\";\n  }\n\n  if (selected.has(\"core_shd_level\")) core.shdLevel = -1;\n  if (selected.has(\"core_stardust\")) core.stardust = 0;\n\n  if (selected.has(\"core_wall_seed\")) {\n    core.wallSeed = `${target.channelId}:${target.userId}:${Date.now()}:${Math.random()}`;\n  }\n\n  if (selected.has(\"core_materials\")) core.materials = {};\n  if (selected.has(\"core_components\")) core.components = {};\n  if (selected.has(\"core_frames\")) core.frames = {};\n\n  if (selected.has(\"core_subcores\")) {\n    core.subCores = {};\n    core.activeSubCoreId = null;\n  }\n\n  if (selected.has(\"core_reactor\")) {\n    core.reactor = { level: 0, activeDeposit: null };\n  }\n\n  if (selected.has(\"core_tokens\")) core.tokens = {};\n  if (selected.has(\"core_lootboxes\")) core.lootboxes = {};\n  if (selected.has(\"core_quest_progress\")) core.questProgress = {};\n  if (selected.has(\"core_quest_claims\")) core.questClaimed = {};\n  if (selected.has(\"core_achievements\")) core.achievementsClaimed = {};\n  if (selected.has(\"core_unlocks\")) core.unlocks = {};\n\n  if (selected.has(\"core_stats\")) {\n    core.stats = {\n      totalRollsTracked: 0,\n      totalCrafts: 0,\n      totalComponentsCrafted: 0,\n      coresCrafted: 0,\n      shdCrafted: 0,\n      reactorClaims: 0,\n      questsCompleted: 0,\n      boxesOpened: 0,\n      pathSwitches: 0,\n      highestRarity: 0,\n      rareRolls100k: 0,\n      rareRolls1m: 0,\n      rareRolls10m: 0,\n      materialsCollected: 0,\n      stardustCollected: 0,\n    };\n  }\n\n  if (selected.has(\"core_jobs\")) core.activeJobs = {};\n\n  core.updatedAt = Date.now();\n  core.lastActiveAt = Date.now();\n}\n\nfunction resetKnowledgeFields(\n  player: Record<string, any>,\n  selected: Set<ResetOption>\n): void {\n  if (selected.has(\"knowledge_currency\")) player.knowledge = 0;\n  if (selected.has(\"knowledge_merchant_marks\")) player.merchantMarks = 0;\n  if (selected.has(\"knowledge_relic_shards\")) player.relicShards = 0;\n  if (selected.has(\"knowledge_blueprint_fragments\")) {\n    player.blueprintFragments = 0;\n  }\n\n  if (selected.has(\"knowledge_scanner\")) player.scannerLevel = 0;\n  if (selected.has(\"knowledge_research\")) player.unlockedResearch = {};\n  if (selected.has(\"knowledge_blueprints\")) player.blueprints = {};\n  if (selected.has(\"knowledge_relics\")) player.relics = [];\n\n  if (selected.has(\"knowledge_stats\")) {\n    player.stats = {\n      bossDamage: 0,\n      bossKills: 0,\n      knowledgeEarned: 0,\n      worldEventsSeen: 0,\n      relicRerolls: 0,\n    };\n  }\n\n  player.updatedAt = Date.now();\n}\n\nfunction optionDescription(option: ResetOption): string {\n  const descriptions: Record<ResetOption, string> = {\n    profile_rolls: \"Reset normal !roll count.\",\n    profile_token_rolls: \"Reset token/potion roll count.\",\n    profile_rarity_total: \"Reset accumulated rarity value.\",\n    profile_xp: \"Reset XP to 0.\",\n    profile_level: \"Reset displayed level to 1.\",\n    profile_weekly_xp: \"Reset weekly tier-XP counters.\",\n    profile_level_rewards: \"Forget claimed level rewards.\",\n    profile_dev_xp_auras: \"Reset DEV-exclusive XP aura tracking.\",\n    profile_owned_tiers: \"Reset owned tier counters.\",\n    profile_highest_tier: \"Reset highest tier/rank.\",\n    profile_best_aura: \"Reset best normal aura.\",\n    profile_best_token: \"Reset best token/potion aura.\",\n    profile_index: \"Remove player from profile lookup/standard leaderboard index.\",\n    inventory_tokens: \"Delete stored roll/potion tokens.\",\n    inventory_active_buffs: \"Delete active and queued token effects.\",\n    inventory_pending_grants: \"Delete username-based pending token grants.\",\n    core_tier: \"Reset Core tier.\",\n    core_path_focus: \"Reset Core path and main/sub focus.\",\n    core_shd_level: \"Reset SHD level.\",\n    core_stardust: \"Reset stored Stardust.\",\n    core_wall_seed: \"Regenerate the Core wall seed.\",\n    core_materials: \"Delete Core-system materials.\",\n    core_components: \"Delete crafted components.\",\n    core_frames: \"Delete frames/chassis storage.\",\n    core_subcores: \"Delete Sub-Cores and active Sub-Core.\",\n    core_reactor: \"Reset Stardust Reactor and active deposit.\",\n    core_tokens: \"Delete Core-system crafting tokens.\",\n    core_lootboxes: \"Delete unopened boxes.\",\n    core_quest_progress: \"Reset Core quest progress.\",\n    core_quest_claims: \"Reset Core quest claim history.\",\n    core_achievements: \"Reset Core achievement claim history.\",\n    core_unlocks: \"Reset Core feature unlock flags.\",\n    core_stats: \"Reset Core/crafting/box/reactor statistics.\",\n    core_jobs: \"Delete active crafting/Core jobs.\",\n    knowledge_currency: \"Reset Knowledge.\",\n    knowledge_merchant_marks: \"Reset Merchant Marks.\",\n    knowledge_relic_shards: \"Reset Relic Shards.\",\n    knowledge_blueprint_fragments: \"Reset Blueprint Fragments.\",\n    knowledge_scanner: \"Reset Scanner level.\",\n    knowledge_research: \"Reset unlocked research.\",\n    knowledge_blueprints: \"Reset owned blueprints.\",\n    knowledge_relics: \"Delete owned/equipped relics.\",\n    knowledge_stats: \"Reset boss/Knowledge/relic statistics.\",\n    knowledge_boss_participation: \"Remove player from the active boss participant list.\",\n    social_titles: \"Delete owned and equipped titles.\",\n    social_recent_pulls: \"Remove player from !recent pull history.\",\n    social_flex: \"Cancel the active flex challenge if player is involved.\",\n    quest_period_claims: \"Delete personal/global period quest claim keys.\",\n    quest_npc_claims: \"Remove NPC quest claimed-by markers.\",\n    mega_luck_history: \"Delete stored best-luck history.\",\n    leaderboard_channel_periods: \"Remove player rows from channel period leaderboards.\",\n    leaderboard_global_periods: \"Remove player rows from cross-channel period leaderboards.\",\n    records_replay: \"Remove player from rare-pull replay history.\",\n    records_slots: \"Clear channel record slots owned by player.\",\n    records_first_aura_discoveries: \"Remove player-owned aura discoveries shown by !first/!firsts.\",\n    player_cooldowns: \"Delete player-specific command cooldowns.\",\n    roll_access: \"Remove player from dynamic 10k-roll access.\",\n    other_exact_player_keys: \"Delete additional exact keys containing channel ID and numeric user ID.\",\n  };\n\n  return descriptions[option];\n}\n\nasync function buildPlan(\n  r: Redis,\n  body: ResetRequestBody\n): Promise<ResetPlan> {\n  const channelId = cleanId(body.channelId, \"904797805\");\n  if (!channelId) throw new Error(\"Enter a valid Twitch channel ID.\");\n\n  const options = selectedOptions(body.options);\n  if (options.length === 0) {\n    throw new Error(\"Select at least one reset item.\");\n  }\n\n  const target = await resolveTarget(\n    r,\n    channelId,\n    cleanId(body.userId),\n    normalizeUsername(body.username)\n  );\n\n  if (!target) {\n    throw new Error(\n      \"Player not found. Use their numeric Twitch user ID for perfect accuracy.\"\n    );\n  }\n\n  const selected = new Set(options);\n  const fullPlayerReset = ALL_OPTIONS.every((option) =>\n    selected.has(option)\n  );\n\n  const keys = {\n    profile: target.profileKey,\n    inventory: `inventory:${channelId}:${target.userId}`,\n    core: `core-system:${channelId}:${target.userId}`,\n    knowledge: `aok:player:${channelId}:${target.userId}`,\n    titles: `social:titles:${channelId}:${target.userId}`,\n    recent: `social:recent:${channelId}`,\n    flex: `social:flex:${channelId}`,\n    npc: `social:npc:${channelId}`,\n    replay: `mega:replay:${channelId}`,\n    records: `mega:records:${channelId}`,\n    firsts: `mega:firsts:${channelId}`,\n    aokChannel: `aok:channel:${channelId}`,\n    access: `roll-access:${channelId}`,\n    profileIndex: `profiles:${channelId}:keys`,\n    luck: `mega:luck:${channelId}:${target.userId}`,\n  };\n\n  const sharedKeys = [\n    keys.profile,\n    keys.inventory,\n    keys.core,\n    keys.knowledge,\n    keys.titles,\n    keys.recent,\n    keys.flex,\n    keys.npc,\n    keys.replay,\n    keys.records,\n    keys.firsts,\n    keys.aokChannel,\n    keys.access,\n    keys.profileIndex,\n    keys.luck,\n  ];\n\n  const values = await mgetValues(r, sharedKeys);\n  const valueByKey = new Map<string, any>(\n    sharedKeys.map((key, index) => [key, values[index]])\n  );\n\n  const items: ResetPlanItem[] = options.map((option) => {\n    let key = \"player object\";\n    let kind: ResetPlanItem[\"kind\"] = \"field\";\n    let matches = 1;\n\n    if (option.startsWith(\"inventory_\")) key = keys.inventory;\n    else if (option.startsWith(\"core_\")) key = keys.core;\n    else if (option.startsWith(\"knowledge_\")) key = keys.knowledge;\n    else if (option.startsWith(\"profile_\")) key = keys.profile;\n\n    if (option === \"profile_index\") {\n      key = keys.profileIndex;\n      kind = \"shared\";\n      matches = ((valueByKey.get(key) as string[] | null) ?? []).filter(\n        (entry) => entry === target.profileKey\n      ).length;\n    }\n\n    if (option === \"inventory_pending_grants\") {\n      key = `inventory-grants:${channelId}:${target.username}`;\n      kind = \"key\";\n    }\n\n    if (option === \"social_titles\") {\n      key = keys.titles;\n      kind = \"key\";\n    }\n\n    if (option === \"social_recent_pulls\") {\n      key = keys.recent;\n      kind = \"shared\";\n      matches = arrayMatchCount(valueByKey.get(key), target);\n    }\n\n    if (option === \"social_flex\") {\n      key = keys.flex;\n      kind = \"shared\";\n      matches = targetMatches(valueByKey.get(key), target) ? 1 : 0;\n\n      const flex = valueByKey.get(key);\n      if (\n        flex &&\n        (normalizeUsername(flex.challengerName) === target.username ||\n          normalizeUsername(flex.targetName) === target.username ||\n          cleanId(flex.challengerId) === target.userId)\n      ) {\n        matches = 1;\n      }\n    }\n\n    if (option === \"quest_period_claims\") {\n      key = `mega:qclaim:${channelId}:${target.userId}:*`;\n      kind = \"key\";\n      matches = 0;\n    }\n\n    if (option === \"quest_npc_claims\") {\n      key = keys.npc;\n      kind = \"shared\";\n      const npc = valueByKey.get(key);\n      matches = Array.isArray(npc?.quests)\n        ? npc.quests.filter(\n            (quest: any) => quest?.claimedBy?.[target.userId] === true\n          ).length\n        : 0;\n    }\n\n    if (option === \"mega_luck_history\") {\n      key = keys.luck;\n      kind = \"key\";\n    }\n\n    if (option === \"leaderboard_channel_periods\") {\n      key = `mega:stats:${channelId}:*`;\n      kind = \"shared\";\n      matches = 0;\n    }\n\n    if (option === \"leaderboard_global_periods\") {\n      key = \"mega:gstats:*\";\n      kind = \"shared\";\n      matches = 0;\n    }\n\n    if (option === \"records_replay\") {\n      key = keys.replay;\n      kind = \"shared\";\n      matches = arrayMatchCount(valueByKey.get(key), target);\n    }\n\n    if (option === \"records_slots\") {\n      key = keys.records;\n      kind = \"shared\";\n      const records = valueByKey.get(key);\n      matches = [\n        records?.bestAura,\n        records?.biggestToday,\n        records?.mostRollsUser,\n      ].filter((entry) => targetMatches(entry, target)).length;\n    }\n\n    if (option === \"records_first_aura_discoveries\") {\n      key = keys.firsts;\n      kind = \"shared\";\n      const firsts = valueByKey.get(key);\n      matches = Object.values(firsts?.auras ?? {}).filter((entry) =>\n        targetMatches(entry as Record<string, any>, target)\n      ).length;\n    }\n\n    if (option === \"knowledge_boss_participation\") {\n      key = keys.aokChannel;\n      kind = \"shared\";\n      matches = valueByKey.get(key)?.boss?.participants?.[target.userId]\n        ? 1\n        : 0;\n    }\n\n    if (option === \"player_cooldowns\") {\n      key = `cd:*:${channelId}:${target.userId}*`;\n      kind = \"key\";\n      matches = 0;\n    }\n\n    if (option === \"roll_access\") {\n      key = keys.access;\n      kind = \"shared\";\n      matches = (\n        (valueByKey.get(key) as Array<Record<string, any>> | null) ?? []\n      ).filter(\n        (entry) =>\n          normalizeUsername(entry.username) === target.username\n      ).length;\n    }\n\n    if (option === \"other_exact_player_keys\") {\n      key = `*:${channelId}:*${target.userId}*`;\n      kind = \"key\";\n      matches = 0;\n    }\n\n    return {\n      option,\n      kind,\n      key,\n      matches,\n      description: optionDescription(option),\n    };\n  });\n\n  const notes = [\n    \"Aura discoveries from !first/!firsts are player-owned and can be removed independently.\",\n    \"Biome firsts are channel-owned in the current schema and do not store a player ID, so they are intentionally preserved.\",\n    \"Period leaderboard cleanup removes only the player's row. Channel/global aggregate quest totals are preserved so other viewers are not punished.\",\n    \"Full Player Reset does not delete global rolls, biome/event state, Discord settings, server boosts, Black Market state, or other viewers.\",\n  ];\n\n  return {\n    target,\n    options,\n    fullPlayerReset,\n    items,\n    notes,\n  };\n}\n\nasync function removeProfileIndex(\n  r: Redis,\n  target: TargetPlayer\n): Promise<void> {\n  const key = `profiles:${target.channelId}:keys`;\n  const list = (await r.get<string[]>(key)) ?? [];\n  const next = list.filter((entry) => entry !== target.profileKey);\n  if (next.length !== list.length) await r.set(key, next);\n}\n\nasync function resetPeriodLeaderboards(\n  r: Redis,\n  target: TargetPlayer,\n  global: boolean\n): Promise<number> {\n  const pattern = global\n    ? \"mega:gstats:*\"\n    : `mega:stats:${target.channelId}:*`;\n\n  const keys = await keysByPattern(r, pattern);\n  const values = await mgetValues(r, keys);\n  const writes: Record<string, any> = {};\n  let changed = 0;\n\n  const userKey = global\n    ? `${target.channelId}:${target.userId}`\n    : target.userId;\n\n  for (let index = 0; index < keys.length; index++) {\n    const stats = values[index];\n    if (!stats?.users?.[userKey]) continue;\n\n    delete stats.users[userKey];\n\n    if (stats.bestAura?.user) {\n      const remainingBestUser = Object.values(stats.users)\n        .filter((entry: any) => entry?.bestAura)\n        .sort(\n          (a: any, b: any) =>\n            b.bestAura.rarity - a.bestAura.rarity\n        )[0] as any;\n\n      stats.bestAura = remainingBestUser\n        ? {\n            name: remainingBestUser.bestAura.name,\n            rarity: remainingBestUser.bestAura.rarity,\n            user: remainingBestUser.name,\n          }\n        : undefined;\n    }\n\n    stats.updatedAt = Date.now();\n    writes[keys[index]] = stats;\n    changed++;\n  }\n\n  if (Object.keys(writes).length > 0) await r.mset(writes);\n  return changed;\n}\n\nasync function removeOtherExactKeys(\n  r: Redis,\n  target: TargetPlayer,\n  protectedKeys: Set<string>\n): Promise<string[]> {\n  const patterns = [\n    `*:${target.channelId}:${target.userId}`,\n    `*:${target.channelId}:${target.userId}:*`,\n    `*:${target.channelId}:*:${target.userId}`,\n    `*:${target.channelId}:*:${target.userId}:*`,\n  ];\n\n  const questClaimPrefix =\n    `mega:qclaim:${target.channelId}:${target.userId}:`;\n\n  const cooldownNeedle =\n    `:${target.channelId}:${target.userId}`;\n\n  const found = new Set<string>();\n\n  for (const pattern of patterns) {\n    for (const key of await keysByPattern(r, pattern)) {\n      const isKnownQuestClaim = key.startsWith(questClaimPrefix);\n      const isKnownCooldown =\n        key.startsWith(\"cd:\") && key.includes(cooldownNeedle);\n\n      if (\n        protectedKeys.has(key) ||\n        isKnownQuestClaim ||\n        isKnownCooldown\n      ) {\n        continue;\n      }\n\n      found.add(key);\n    }\n  }\n\n  const keys = [...found];\n  if (keys.length > 0) await r.del(...keys);\n  return keys;\n}\n\nasync function executePlan(\n  r: Redis,\n  plan: ResetPlan\n): Promise<{\n  writes: number;\n  deletedKeys: number;\n  sharedChanges: number;\n}> {\n  const selected = new Set(plan.options);\n  const target = plan.target;\n\n  const keys = {\n    profile: target.profileKey,\n    inventory: `inventory:${target.channelId}:${target.userId}`,\n    core: `core-system:${target.channelId}:${target.userId}`,\n    knowledge: `aok:player:${target.channelId}:${target.userId}`,\n    titles: `social:titles:${target.channelId}:${target.userId}`,\n    recent: `social:recent:${target.channelId}`,\n    flex: `social:flex:${target.channelId}`,\n    npc: `social:npc:${target.channelId}`,\n    replay: `mega:replay:${target.channelId}`,\n    records: `mega:records:${target.channelId}`,\n    firsts: `mega:firsts:${target.channelId}`,\n    aokChannel: `aok:channel:${target.channelId}`,\n    access: `roll-access:${target.channelId}`,\n    luck: `mega:luck:${target.channelId}:${target.userId}`,\n  };\n\n  const directKeys = [\n    keys.profile,\n    keys.inventory,\n    keys.core,\n    keys.knowledge,\n  ];\n\n  const directValues = await mgetValues(r, directKeys);\n  const profile = directValues[0] as Record<string, any> | null;\n  const inventory = directValues[1] as Record<string, any> | null;\n  const core = directValues[2] as Record<string, any> | null;\n  const knowledge = directValues[3] as Record<string, any> | null;\n\n  const writes: Record<string, any> = {};\n  const deletes = new Set<string>();\n  let sharedChanges = 0;\n\n  if (profile && PROFILE_OPTIONS.some((option) => selected.has(option))) {\n    if (hasAll(selected, PROFILE_OPTIONS)) {\n      deletes.add(keys.profile);\n    } else {\n      resetProfileFields(profile, selected);\n      writes[keys.profile] = profile;\n    }\n  }\n\n  if (\n    inventory &&\n    INVENTORY_OPTIONS.some((option) => selected.has(option))\n  ) {\n    if (hasAll(selected, INVENTORY_OPTIONS)) {\n      deletes.add(keys.inventory);\n    } else {\n      resetInventoryFields(inventory, selected);\n      writes[keys.inventory] = inventory;\n    }\n  }\n\n  if (core && CORE_OPTIONS.some((option) => selected.has(option))) {\n    if (hasAll(selected, CORE_OPTIONS)) {\n      deletes.add(keys.core);\n    } else {\n      resetCoreFields(core, selected, target);\n      writes[keys.core] = core;\n    }\n  }\n\n  if (\n    knowledge &&\n    KNOWLEDGE_OPTIONS.some((option) => selected.has(option))\n  ) {\n    if (hasAll(selected, KNOWLEDGE_OPTIONS)) {\n      deletes.add(keys.knowledge);\n    } else {\n      resetKnowledgeFields(knowledge, selected);\n      writes[keys.knowledge] = knowledge;\n    }\n  }\n\n  if (selected.has(\"profile_index\")) {\n    await removeProfileIndex(r, target);\n    sharedChanges++;\n  }\n\n  if (selected.has(\"inventory_pending_grants\") && target.username) {\n    deletes.add(\n      `inventory-grants:${target.channelId}:${target.username}`\n    );\n  }\n\n  if (selected.has(\"social_titles\")) deletes.add(keys.titles);\n  if (selected.has(\"mega_luck_history\")) deletes.add(keys.luck);\n\n  if (selected.has(\"quest_period_claims\")) {\n    for (const key of await keysByPattern(\n      r,\n      `mega:qclaim:${target.channelId}:${target.userId}:*`\n    )) {\n      deletes.add(key);\n    }\n  }\n\n  if (selected.has(\"player_cooldowns\")) {\n    const patterns = [\n      `cd:*:${target.channelId}:${target.userId}`,\n      `cd:*:${target.channelId}:${target.userId}:*`,\n    ];\n\n    for (const pattern of patterns) {\n      for (const key of await keysByPattern(r, pattern)) {\n        deletes.add(key);\n      }\n    }\n  }\n\n  const sharedKeys = [\n    keys.recent,\n    keys.flex,\n    keys.npc,\n    keys.replay,\n    keys.records,\n    keys.firsts,\n    keys.aokChannel,\n    keys.access,\n  ];\n\n  const sharedValues = await mgetValues(r, sharedKeys);\n  const shared = new Map<string, any>(\n    sharedKeys.map((key, index) => [key, sharedValues[index]])\n  );\n\n  if (selected.has(\"social_recent_pulls\")) {\n    const list = (shared.get(keys.recent) as Array<Record<string, any>>) ?? [];\n    const next = removeTargetFromArray(list, target);\n\n    if (next.length !== list.length) {\n      writes[keys.recent] = next;\n      sharedChanges += list.length - next.length;\n    }\n  }\n\n  if (selected.has(\"social_flex\")) {\n    const flex = shared.get(keys.flex);\n\n    if (\n      flex &&\n      (cleanId(flex.challengerId) === target.userId ||\n        normalizeUsername(flex.challengerName) === target.username ||\n        normalizeUsername(flex.targetName) === target.username)\n    ) {\n      deletes.add(keys.flex);\n      sharedChanges++;\n    }\n  }\n\n  if (selected.has(\"quest_npc_claims\")) {\n    const npc = shared.get(keys.npc);\n\n    if (Array.isArray(npc?.quests)) {\n      let changed = 0;\n\n      for (const quest of npc.quests) {\n        if (quest?.claimedBy?.[target.userId]) {\n          delete quest.claimedBy[target.userId];\n          changed++;\n        }\n      }\n\n      if (changed > 0) {\n        writes[keys.npc] = npc;\n        sharedChanges += changed;\n      }\n    }\n  }\n\n  if (selected.has(\"records_replay\")) {\n    const list = (shared.get(keys.replay) as Array<Record<string, any>>) ?? [];\n    const next = removeTargetFromArray(list, target);\n\n    if (next.length !== list.length) {\n      writes[keys.replay] = next;\n      sharedChanges += list.length - next.length;\n    }\n  }\n\n  if (selected.has(\"records_slots\")) {\n    const records = shared.get(keys.records);\n\n    if (records) {\n      let changed = 0;\n\n      for (const field of [\n        \"bestAura\",\n        \"biggestToday\",\n        \"mostRollsUser\",\n      ]) {\n        if (targetMatches(records[field], target)) {\n          delete records[field];\n          changed++;\n        }\n      }\n\n      if (changed > 0) {\n        records.updatedAt = Date.now();\n        writes[keys.records] = records;\n        sharedChanges += changed;\n      }\n    }\n  }\n\n  if (selected.has(\"records_first_aura_discoveries\")) {\n    const firsts = shared.get(keys.firsts);\n\n    if (firsts?.auras) {\n      let changed = 0;\n\n      for (const [auraId, entry] of Object.entries(firsts.auras)) {\n        if (targetMatches(entry as Record<string, any>, target)) {\n          delete firsts.auras[auraId];\n          changed++;\n        }\n      }\n\n      if (changed > 0) {\n        writes[keys.firsts] = firsts;\n        sharedChanges += changed;\n      }\n    }\n  }\n\n  if (selected.has(\"knowledge_boss_participation\")) {\n    const channel = shared.get(keys.aokChannel);\n\n    if (channel?.boss?.participants?.[target.userId]) {\n      delete channel.boss.participants[target.userId];\n      channel.updatedAt = Date.now();\n      writes[keys.aokChannel] = channel;\n      sharedChanges++;\n    }\n  }\n\n  if (selected.has(\"roll_access\")) {\n    const list = (shared.get(keys.access) as Array<Record<string, any>>) ?? [];\n    const next = list.filter(\n      (entry) =>\n        normalizeUsername(entry.username) !== target.username\n    );\n\n    if (next.length !== list.length) {\n      writes[keys.access] = next;\n      sharedChanges += list.length - next.length;\n    }\n  }\n\n  if (selected.has(\"leaderboard_channel_periods\")) {\n    sharedChanges += await resetPeriodLeaderboards(r, target, false);\n  }\n\n  if (selected.has(\"leaderboard_global_periods\")) {\n    sharedChanges += await resetPeriodLeaderboards(r, target, true);\n  }\n\n  if (Object.keys(writes).length > 0) await r.mset(writes);\n  if (deletes.size > 0) await r.del(...deletes);\n\n  if (selected.has(\"other_exact_player_keys\")) {\n    const protectedKeys = new Set([\n      keys.profile,\n      keys.inventory,\n      keys.core,\n      keys.knowledge,\n      keys.titles,\n      keys.luck,\n      `channel:${target.channelId}:state`,\n      `mega:discord:${target.channelId}`,\n      `mega:event:${target.channelId}`,\n      `mega:blackmarket:${target.channelId}`,\n      `social:boosts:${target.channelId}`,\n      `profiles:${target.channelId}:keys`,\n      `aok:channel:${target.channelId}`,\n    ]);\n\n    const extra = await removeOtherExactKeys(r, target, protectedKeys);\n    for (const key of extra) deletes.add(key);\n  }\n\n  return {\n    writes: Object.keys(writes).length,\n    deletedKeys: deletes.size,\n    sharedChanges,\n  };\n}\n\nexport default async function handler(\n  req: NextApiRequest,\n  res: NextApiResponse\n) {\n  if (req.method !== \"POST\") {\n    return res.status(405).json({\n      ok: false,\n      error: \"Use POST from the player-reset dashboard.\",\n    });\n  }\n\n  const body = (req.body ?? {}) as ResetRequestBody;\n\n  if (!isAuthorized(req, body)) {\n    return res.status(401).json({\n      ok: false,\n      error: \"Reset locked. Enter the correct CRON_SECRET.\",\n    });\n  }\n\n  const r = getRedis();\n\n  if (!r) {\n    return res.status(503).json({\n      ok: false,\n      error: \"Redis is not connected.\",\n    });\n  }\n\n  try {\n    const plan = await buildPlan(r, body);\n    const preview = body.preview !== false;\n\n    if (preview) {\n      return res.status(200).json({\n        ok: true,\n        preview: true,\n        plan,\n        totals: {\n          selectedItems: plan.options.length,\n          currentlyMatchedEntries: plan.items.reduce(\n            (sum, item) => sum + item.matches,\n            0\n          ),\n        },\n      });\n    }\n\n    const expectedByName = `RESET ${plan.target.username}`;\n    const expectedById = `RESET ${plan.target.userId}`;\n    const confirmation = String(body.confirmation ?? \"\").trim();\n\n    if (\n      confirmation !== expectedByName &&\n      confirmation !== expectedById\n    ) {\n      return res.status(400).json({\n        ok: false,\n        error: `Confirmation must exactly match \"${expectedByName}\" or \"${expectedById}\".`,\n      });\n    }\n\n    const result = await executePlan(r, plan);\n\n    return res.status(200).json({\n      ok: true,\n      preview: false,\n      message: `✅ Reset completed for ${plan.target.displayName} (${plan.target.userId}).`,\n      selectedItems: plan.options.length,\n      fullPlayerReset: plan.fullPlayerReset,\n      ...result,\n      notes: plan.notes,\n    });\n  } catch (error) {\n    return res.status(400).json({\n      ok: false,\n      error: error instanceof Error ? error.message : String(error),\n    });\n  }\n}\n", "src/pages/player-reset.tsx": "import Head from \"next/head\";\nimport { useMemo, useState } from \"react\";\nimport type { CSSProperties } from \"react\";\n\nconst GROUPS = [\n  {\n    title: \"Profile\",\n    description: \"Each stored profile field can be reset independently.\",\n    items: [\n      [\"profile_rolls\", \"Normal rolls\", \"Only the standard !roll counter.\"],\n      [\"profile_token_rolls\", \"Token/potion rolls\", \"Token and legacy potion-roll counters.\"],\n      [\"profile_rarity_total\", \"Total rarity value\", \"Accumulated rarity value used by value leaderboards.\"],\n      [\"profile_xp\", \"XP\", \"Set XP to 0 without touching other fields.\"],\n      [\"profile_level\", \"Level\", \"Set displayed level to 1.\"],\n      [\"profile_weekly_xp\", \"Weekly XP counters\", \"Reset weekly tier caps/counts.\"],\n      [\"profile_level_rewards\", \"Claimed level rewards\", \"Allow level rewards to be claimed again.\"],\n      [\"profile_dev_xp_auras\", \"DEV XP aura tracking\", \"Forget DEV-exclusive XP aura history.\"],\n      [\"profile_owned_tiers\", \"Owned tier counts\", \"Reset tier ownership counters.\"],\n      [\"profile_highest_tier\", \"Highest tier\", \"Reset highest tier and rank.\"],\n      [\"profile_best_aura\", \"Best normal aura\", \"Clear the best standard roll.\"],\n      [\"profile_best_token\", \"Best token aura\", \"Clear best token/potion result.\"],\n      [\"profile_index\", \"Profile index entry\", \"Remove from username lookup and standard leaderboards.\"],\n    ],\n  },\n  {\n    title: \"Inventory\",\n    description: \"Token inventory and queued effects.\",\n    items: [\n      [\"inventory_tokens\", \"Stored tokens\", \"Delete owned roll and potion tokens.\"],\n      [\"inventory_active_buffs\", \"Active/queued token buffs\", \"Delete active timed and consume-on-roll effects.\"],\n      [\"inventory_pending_grants\", \"Pending grants\", \"Delete username-based admin/reward grants.\"],\n    ],\n  },\n  {\n    title: \"Core, SHD and crafting\",\n    description: \"Every Core-system section is separate.\",\n    items: [\n      [\"core_tier\", \"Core tier\", \"Reset to Core 0.\"],\n      [\"core_path_focus\", \"Core path and focus\", \"Reset to universal/main.\"],\n      [\"core_shd_level\", \"SHD level\", \"Reset SHD to uncrafted.\"],\n      [\"core_stardust\", \"Stardust\", \"Set stored Stardust to 0.\"],\n      [\"core_wall_seed\", \"Wall seed\", \"Generate a fresh wall seed.\"],\n      [\"core_materials\", \"Materials\", \"Delete all Core materials.\"],\n      [\"core_components\", \"Components\", \"Delete all crafted components.\"],\n      [\"core_frames\", \"Frames/chassis\", \"Delete frame storage.\"],\n      [\"core_subcores\", \"Sub-Cores\", \"Delete Sub-Cores and active selection.\"],\n      [\"core_reactor\", \"Stardust Reactor\", \"Reset level and deposit.\"],\n      [\"core_tokens\", \"Core crafting tokens\", \"Delete recipe/path/reactor/etc. tokens.\"],\n      [\"core_lootboxes\", \"Loot boxes\", \"Delete unopened boxes.\"],\n      [\"core_quest_progress\", \"Core quest progress\", \"Reset objective counters.\"],\n      [\"core_quest_claims\", \"Core quest claims\", \"Forget claimed Core quests.\"],\n      [\"core_achievements\", \"Achievement claims\", \"Forget claimed achievements.\"],\n      [\"core_unlocks\", \"Core unlock flags\", \"Reset feature unlocks.\"],\n      [\"core_stats\", \"Core statistics\", \"Reset crafting, rarity, box and reactor stats.\"],\n      [\"core_jobs\", \"Active jobs\", \"Delete active crafting/Core jobs.\"],\n    ],\n  },\n  {\n    title: \"Knowledge, research and relics\",\n    description: \"Activity of Knowledge player data.\",\n    items: [\n      [\"knowledge_currency\", \"Knowledge\", \"Set Knowledge to 0.\"],\n      [\"knowledge_merchant_marks\", \"Merchant Marks\", \"Set Marks to 0.\"],\n      [\"knowledge_relic_shards\", \"Relic Shards\", \"Set shards to 0.\"],\n      [\"knowledge_blueprint_fragments\", \"Blueprint Fragments\", \"Set fragments to 0.\"],\n      [\"knowledge_scanner\", \"Scanner level\", \"Reset Scanner to 0.\"],\n      [\"knowledge_research\", \"Research tree\", \"Lock all research again.\"],\n      [\"knowledge_blueprints\", \"Blueprint ownership\", \"Delete owned blueprints.\"],\n      [\"knowledge_relics\", \"Relics\", \"Delete owned/equipped relics.\"],\n      [\"knowledge_stats\", \"Knowledge statistics\", \"Reset boss, event and relic stats.\"],\n      [\"knowledge_boss_participation\", \"Active boss participation\", \"Remove damage entry from the current boss.\"],\n    ],\n  },\n  {\n    title: \"Social, quests and history\",\n    description: \"Shared objects are edited surgically; other viewers remain untouched.\",\n    items: [\n      [\"social_titles\", \"Titles\", \"Delete owned/equipped titles.\"],\n      [\"social_recent_pulls\", \"Recent pulls\", \"Remove entries from !recent.\"],\n      [\"social_flex\", \"Flex challenge\", \"Cancel the active challenge if involved.\"],\n      [\"quest_period_claims\", \"Period quest claims\", \"Delete personal/global daily-weekly-monthly-yearly claim keys.\"],\n      [\"quest_npc_claims\", \"NPC quest claims\", \"Remove this player's claimed-by markers.\"],\n      [\"mega_luck_history\", \"Best-luck history\", \"Delete stored best luck/aura history.\"],\n      [\"leaderboard_channel_periods\", \"Channel period leaderboards\", \"Remove user rows from daily/weekly/monthly/yearly tables.\"],\n      [\"leaderboard_global_periods\", \"Global period leaderboards\", \"Remove cross-channel user rows.\"],\n      [\"records_replay\", \"Rare replay history\", \"Remove entries shown by !replay.\"],\n      [\"records_slots\", \"Channel record slots\", \"Clear record slots currently owned by the player.\"],\n      [\"records_first_aura_discoveries\", \"!first / !firsts aura discoveries\", \"Remove player-owned aura first discoveries. Biome firsts are channel-owned and preserved.\"],\n      [\"player_cooldowns\", \"Cooldowns\", \"Delete player-specific command cooldowns.\"],\n      [\"roll_access\", \"10k roll access\", \"Remove from the dynamic allowlist.\"],\n      [\"other_exact_player_keys\", \"Other exact player keys\", \"Catch additional keys containing the channel ID and exact numeric user ID.\"],\n    ],\n  },\n] as const;\n\ntype ResetOption = (typeof GROUPS)[number][\"items\"][number][0];\n\ninterface ApiResult {\n  ok?: boolean;\n  preview?: boolean;\n  error?: string;\n  message?: string;\n  plan?: {\n    target?: {\n      channelId: string;\n      username: string;\n      userId: string;\n      displayName: string;\n    };\n    options?: string[];\n    fullPlayerReset?: boolean;\n    items?: Array<{\n      option: string;\n      kind: string;\n      key: string;\n      matches: number;\n      description: string;\n    }>;\n    notes?: string[];\n  };\n  totals?: {\n    selectedItems: number;\n    currentlyMatchedEntries: number;\n  };\n  selectedItems?: number;\n  fullPlayerReset?: boolean;\n  writes?: number;\n  deletedKeys?: number;\n  sharedChanges?: number;\n  notes?: string[];\n}\n\nexport default function PlayerResetPage() {\n  const allOptions = useMemo(\n    () =>\n      GROUPS.flatMap((group) =>\n        group.items.map((item) => item[0])\n      ) as ResetOption[],\n    []\n  );\n\n  const [secret, setSecret] = useState(\"\");\n  const [channelId, setChannelId] = useState(\"904797805\");\n  const [username, setUsername] = useState(\"\");\n  const [userId, setUserId] = useState(\"\");\n  const [selected, setSelected] = useState<ResetOption[]>([]);\n  const [confirmation, setConfirmation] = useState(\"\");\n  const [preview, setPreview] = useState<ApiResult | null>(null);\n  const [result, setResult] = useState<ApiResult | null>(null);\n  const [busy, setBusy] = useState(false);\n\n  const resolvedUsername =\n    preview?.plan?.target?.username ||\n    username.trim().toLowerCase().replace(/^@+/, \"\");\n\n  const expectedConfirmation = resolvedUsername\n    ? `RESET ${resolvedUsername}`\n    : \"RESET username\";\n\n  function clearPreview() {\n    setPreview(null);\n    setResult(null);\n    setConfirmation(\"\");\n  }\n\n  function toggle(option: ResetOption) {\n    setSelected((current) =>\n      current.includes(option)\n        ? current.filter((item) => item !== option)\n        : [...current, option]\n    );\n    clearPreview();\n  }\n\n  function selectGroup(options: readonly (readonly [ResetOption, string, string])[]) {\n    const ids = options.map((item) => item[0]);\n    setSelected((current) => [...new Set([...current, ...ids])]);\n    clearPreview();\n  }\n\n  function clearGroup(options: readonly (readonly [ResetOption, string, string])[]) {\n    const ids = new Set(options.map((item) => item[0]));\n    setSelected((current) => current.filter((item) => !ids.has(item)));\n    clearPreview();\n  }\n\n  async function callApi(execute: boolean) {\n    if (!secret.trim()) {\n      setResult({ ok: false, error: \"Enter CRON_SECRET first.\" });\n      return;\n    }\n\n    if (!username.trim() && !userId.trim()) {\n      setResult({\n        ok: false,\n        error: \"Enter a Twitch username or numeric user ID.\",\n      });\n      return;\n    }\n\n    if (selected.length === 0) {\n      setResult({\n        ok: false,\n        error: \"Select at least one reset item.\",\n      });\n      return;\n    }\n\n    setBusy(true);\n    setResult(null);\n\n    try {\n      const response = await fetch(\"/api/player-reset\", {\n        method: \"POST\",\n        headers: {\n          \"Content-Type\": \"application/json\",\n          Authorization: `Bearer ${secret.trim()}`,\n        },\n        body: JSON.stringify({\n          channelId,\n          username,\n          userId,\n          options: selected,\n          preview: !execute,\n          confirmation: execute ? confirmation : \"\",\n        }),\n      });\n\n      const data = (await response.json()) as ApiResult;\n\n      if (execute) {\n        setResult(data);\n\n        if (data.ok) {\n          setPreview(null);\n          setConfirmation(\"\");\n        }\n      } else {\n        setPreview(data.ok ? data : null);\n        setResult(data);\n        setConfirmation(\"\");\n      }\n    } catch (error) {\n      setResult({\n        ok: false,\n        error:\n          error instanceof Error ? error.message : String(error),\n      });\n    } finally {\n      setBusy(false);\n    }\n  }\n\n  return (\n    <>\n      <Head>\n        <title>Sol&apos;s RNG Granular Player Reset</title>\n      </Head>\n\n      <main style={pageStyle}>\n        <section style={panelStyle}>\n          <div style={eyebrowStyle}>SOL&apos;S RNG ADMIN</div>\n          <h1 style={{ margin: \"8px 0\" }}>\n            Granular Single-Player Reset\n          </h1>\n\n          <p style={mutedStyle}>\n            Every player-owned field is selectable separately. A Full\n            Player Reset selects every switch and deletes complete\n            player objects where possible.\n          </p>\n\n          <div style={warningStyle}>\n            Protected by CRON_SECRET. Preview is required, followed by\n            an exact confirmation phrase.\n          </div>\n\n          <div style={gridStyle}>\n            <Field\n              label=\"CRON_SECRET\"\n              value={secret}\n              setValue={setSecret}\n              type=\"password\"\n              placeholder=\"Sent as a Bearer header\"\n            />\n            <Field\n              label=\"Channel ID\"\n              value={channelId}\n              setValue={(value) =>\n                setChannelId(value.replace(/\\D/g, \"\"))\n              }\n              placeholder=\"904797805\"\n            />\n            <Field\n              label=\"Twitch username\"\n              value={username}\n              setValue={(value) => {\n                setUsername(value);\n                clearPreview();\n              }}\n              placeholder=\"viewer_name\"\n            />\n            <Field\n              label=\"Twitch numeric user ID\"\n              value={userId}\n              setValue={(value) => {\n                setUserId(value.replace(/\\D/g, \"\"));\n                clearPreview();\n              }}\n              placeholder=\"Strongly recommended\"\n            />\n          </div>\n\n          <div style={toolbarStyle}>\n            <button\n              style={dangerSelectStyle}\n              onClick={() => {\n                setSelected(allOptions);\n                clearPreview();\n              }}\n            >\n              Select Full Player Reset ({allOptions.length})\n            </button>\n\n            <button\n              style={secondaryButtonStyle}\n              onClick={() => {\n                setSelected([]);\n                clearPreview();\n              }}\n            >\n              Clear Everything\n            </button>\n\n            <span style={selectionStyle}>\n              {selected.length}/{allOptions.length} selected\n            </span>\n          </div>\n\n          {GROUPS.map((group) => (\n            <section key={group.title} style={groupStyle}>\n              <div style={groupHeaderStyle}>\n                <div>\n                  <h2 style={{ margin: 0 }}>{group.title}</h2>\n                  <p style={{ ...mutedStyle, margin: \"5px 0 0\" }}>\n                    {group.description}\n                  </p>\n                </div>\n\n                <div style={miniToolbarStyle}>\n                  <button\n                    style={miniButtonStyle}\n                    onClick={() => selectGroup(group.items)}\n                  >\n                    Select group\n                  </button>\n                  <button\n                    style={miniButtonStyle}\n                    onClick={() => clearGroup(group.items)}\n                  >\n                    Clear group\n                  </button>\n                </div>\n              </div>\n\n              <div style={optionGridStyle}>\n                {group.items.map(([id, title, description]) => {\n                  const checked = selected.includes(id);\n\n                  return (\n                    <label\n                      key={id}\n                      style={{\n                        ...optionStyle,\n                        borderColor: checked\n                          ? \"#7f91ff\"\n                          : \"#30395f\",\n                        background: checked\n                          ? \"rgba(69,86,181,.23)\"\n                          : \"rgba(12,16,34,.72)\",\n                      }}\n                    >\n                      <input\n                        type=\"checkbox\"\n                        checked={checked}\n                        onChange={() => toggle(id)}\n                        style={{ width: 18, height: 18 }}\n                      />\n                      <span>\n                        <strong>{title}</strong>\n                        <span style={descriptionStyle}>\n                          {description}\n                        </span>\n                        <code style={codeStyle}>{id}</code>\n                      </span>\n                    </label>\n                  );\n                })}\n              </div>\n            </section>\n          ))}\n\n          <button\n            style={previewButtonStyle}\n            disabled={busy}\n            onClick={() => callApi(false)}\n          >\n            {busy ? \"Working...\" : \"Preview Selected Reset\"}\n          </button>\n\n          {preview?.ok && (\n            <section style={previewStyle}>\n              <h2 style={{ marginTop: 0 }}>Preview</h2>\n\n              <p>\n                Target:{\" \"}\n                <strong>\n                  {preview.plan?.target?.displayName} (\n                  {preview.plan?.target?.userId})\n                </strong>\n              </p>\n\n              <p>\n                Selected:{\" \"}\n                <strong>\n                  {preview.totals?.selectedItems ?? 0}\n                </strong>{\" \"}\n                | Existing shared matches:{\" \"}\n                <strong>\n                  {preview.totals?.currentlyMatchedEntries ?? 0}\n                </strong>{\" \"}\n                | Full reset:{\" \"}\n                <strong>\n                  {preview.plan?.fullPlayerReset ? \"YES\" : \"No\"}\n                </strong>\n              </p>\n\n              <details open>\n                <summary style={summaryStyle}>\n                  Selected operations\n                </summary>\n                <pre style={preStyle}>\n                  {(preview.plan?.items ?? [])\n                    .map(\n                      (item) =>\n                        `${item.option}\\n  ${item.description}\\n  ${item.key}${item.matches ? ` | matches ${item.matches}` : \"\"}`\n                    )\n                    .join(\"\\n\\n\")}\n                </pre>\n              </details>\n\n              <details>\n                <summary style={summaryStyle}>Safety notes</summary>\n                <pre style={preStyle}>\n                  {(preview.plan?.notes ?? []).join(\"\\n\")}\n                </pre>\n              </details>\n\n              <label style={labelStyle}>\n                Type exactly:{\" \"}\n                <code>{expectedConfirmation}</code>\n              </label>\n\n              <input\n                value={confirmation}\n                onChange={(event) =>\n                  setConfirmation(event.target.value)\n                }\n                style={inputStyle}\n                placeholder={expectedConfirmation}\n                autoComplete=\"off\"\n              />\n\n              <button\n                style={{\n                  ...executeButtonStyle,\n                  opacity:\n                    confirmation === expectedConfirmation && !busy\n                      ? 1\n                      : 0.52,\n                }}\n                disabled={\n                  confirmation !== expectedConfirmation || busy\n                }\n                onClick={() => callApi(true)}\n              >\n                Permanently Execute Selected Reset\n              </button>\n            </section>\n          )}\n\n          {result && (\n            <pre\n              style={{\n                ...resultStyle,\n                color: result.ok ? \"#baffcf\" : \"#ffb7c2\",\n              }}\n            >\n              {JSON.stringify(result, null, 2)}\n            </pre>\n          )}\n        </section>\n      </main>\n    </>\n  );\n}\n\nfunction Field(props: {\n  label: string;\n  value: string;\n  setValue: (value: string) => void;\n  placeholder?: string;\n  type?: string;\n}) {\n  return (\n    <div>\n      <label style={labelStyle}>{props.label}</label>\n      <input\n        type={props.type ?? \"text\"}\n        value={props.value}\n        onChange={(event) => props.setValue(event.target.value)}\n        placeholder={props.placeholder}\n        style={inputStyle}\n        autoComplete=\"off\"\n      />\n    </div>\n  );\n}\n\nconst pageStyle: CSSProperties = {\n  minHeight: \"100vh\",\n  padding: 24,\n  color: \"#f5f7ff\",\n  background:\n    \"radial-gradient(circle at top, rgba(72,81,180,.34), transparent 34%), #070914\",\n  fontFamily:\n    \"Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif\",\n};\n\nconst panelStyle: CSSProperties = {\n  maxWidth: 1180,\n  margin: \"0 auto\",\n  padding: 24,\n  border: \"1px solid #35406f\",\n  borderRadius: 22,\n  background: \"rgba(11,15,31,.95)\",\n  boxShadow: \"0 24px 90px rgba(0,0,0,.42)\",\n};\n\nconst eyebrowStyle: CSSProperties = {\n  color: \"#aeb9ff\",\n  fontWeight: 900,\n  letterSpacing: 1.2,\n};\n\nconst mutedStyle: CSSProperties = {\n  color: \"#c7cde2\",\n  lineHeight: 1.55,\n};\n\nconst warningStyle: CSSProperties = {\n  margin: \"18px 0\",\n  padding: 14,\n  border: \"1px solid #8b5560\",\n  borderRadius: 13,\n  color: \"#ffd5db\",\n  background: \"rgba(117,44,58,.2)\",\n};\n\nconst gridStyle: CSSProperties = {\n  display: \"grid\",\n  gridTemplateColumns: \"repeat(auto-fit, minmax(230px, 1fr))\",\n  gap: 14,\n};\n\nconst labelStyle: CSSProperties = {\n  display: \"block\",\n  margin: \"13px 0 6px\",\n  fontWeight: 800,\n  color: \"#dce1f5\",\n};\n\nconst inputStyle: CSSProperties = {\n  boxSizing: \"border-box\",\n  width: \"100%\",\n  padding: 12,\n  border: \"1px solid #4c588d\",\n  borderRadius: 11,\n  color: \"#fff\",\n  background: \"#060812\",\n  fontSize: 15,\n};\n\nconst toolbarStyle: CSSProperties = {\n  display: \"flex\",\n  flexWrap: \"wrap\",\n  alignItems: \"center\",\n  gap: 10,\n  margin: \"21px 0\",\n};\n\nconst dangerSelectStyle: CSSProperties = {\n  padding: \"11px 15px\",\n  border: \"1px solid #cc6072\",\n  borderRadius: 11,\n  color: \"#fff\",\n  background: \"#7b2839\",\n  cursor: \"pointer\",\n  fontWeight: 900,\n};\n\nconst secondaryButtonStyle: CSSProperties = {\n  padding: \"11px 15px\",\n  border: \"1px solid #4c5c9e\",\n  borderRadius: 11,\n  color: \"#fff\",\n  background: \"#202b61\",\n  cursor: \"pointer\",\n  fontWeight: 800,\n};\n\nconst selectionStyle: CSSProperties = {\n  marginLeft: \"auto\",\n  color: \"#cbd3ff\",\n  fontWeight: 900,\n};\n\nconst groupStyle: CSSProperties = {\n  marginTop: 18,\n  padding: 16,\n  border: \"1px solid #2f385f\",\n  borderRadius: 16,\n  background: \"rgba(8,11,24,.64)\",\n};\n\nconst groupHeaderStyle: CSSProperties = {\n  display: \"flex\",\n  flexWrap: \"wrap\",\n  justifyContent: \"space-between\",\n  gap: 12,\n  marginBottom: 13,\n};\n\nconst miniToolbarStyle: CSSProperties = {\n  display: \"flex\",\n  gap: 8,\n  alignItems: \"center\",\n};\n\nconst miniButtonStyle: CSSProperties = {\n  padding: \"8px 10px\",\n  border: \"1px solid #48578f\",\n  borderRadius: 9,\n  color: \"#fff\",\n  background: \"#1b2554\",\n  cursor: \"pointer\",\n  fontWeight: 800,\n};\n\nconst optionGridStyle: CSSProperties = {\n  display: \"grid\",\n  gridTemplateColumns: \"repeat(auto-fit, minmax(285px, 1fr))\",\n  gap: 10,\n};\n\nconst optionStyle: CSSProperties = {\n  display: \"flex\",\n  alignItems: \"flex-start\",\n  gap: 10,\n  padding: 13,\n  border: \"1px solid\",\n  borderRadius: 13,\n  cursor: \"pointer\",\n};\n\nconst descriptionStyle: CSSProperties = {\n  display: \"block\",\n  marginTop: 5,\n  color: \"#bdc5dc\",\n  fontSize: 13,\n  lineHeight: 1.4,\n};\n\nconst codeStyle: CSSProperties = {\n  display: \"inline-block\",\n  marginTop: 7,\n  color: \"#9eabef\",\n  fontSize: 11,\n};\n\nconst previewButtonStyle: CSSProperties = {\n  width: \"100%\",\n  marginTop: 20,\n  padding: 14,\n  border: \"1px solid #6375ca\",\n  borderRadius: 13,\n  color: \"#fff\",\n  background: \"linear-gradient(180deg, #34479e, #253273)\",\n  cursor: \"pointer\",\n  fontWeight: 900,\n};\n\nconst executeButtonStyle: CSSProperties = {\n  width: \"100%\",\n  marginTop: 14,\n  padding: 14,\n  border: \"1px solid #d45c6f\",\n  borderRadius: 13,\n  color: \"#fff\",\n  background: \"linear-gradient(180deg, #a13247, #711f31)\",\n  cursor: \"pointer\",\n  fontWeight: 900,\n};\n\nconst previewStyle: CSSProperties = {\n  marginTop: 20,\n  padding: 18,\n  border: \"1px solid #596ab1\",\n  borderRadius: 15,\n  background: \"rgba(23,30,65,.72)\",\n};\n\nconst summaryStyle: CSSProperties = {\n  marginTop: 10,\n  cursor: \"pointer\",\n  fontWeight: 800,\n};\n\nconst preStyle: CSSProperties = {\n  maxHeight: 330,\n  overflow: \"auto\",\n  padding: 12,\n  borderRadius: 10,\n  color: \"#c9ffd8\",\n  background: \"#050710\",\n  whiteSpace: \"pre-wrap\",\n  wordBreak: \"break-word\",\n};\n\nconst resultStyle: CSSProperties = {\n  marginTop: 18,\n  maxHeight: 440,\n  overflow: \"auto\",\n  padding: 14,\n  border: \"1px solid #343f70\",\n  borderRadius: 12,\n  background: \"#050710\",\n  whiteSpace: \"pre-wrap\",\n  wordBreak: \"break-word\",\n};\n"};

function fail(message) {
  console.error(`❌ ${message}`);
  process.exit(1);
}

function backup(file) {
  const target = `${file}.bak.${Date.now()}`;
  fs.copyFileSync(file, target);
  console.log(`🧯 Backup: ${target}`);
}

function replaceRegex(source, pattern, replacement, label) {
  if (!pattern.test(source)) fail(`Could not patch ${label}.`);
  return source.replace(pattern, replacement);
}

for (const [filePath, content] of Object.entries(replacementFiles)) {
  const full = path.join(process.cwd(), filePath);
  fs.mkdirSync(path.dirname(full), { recursive: true });

  if (fs.existsSync(full)) {
    const current = fs.readFileSync(full, "utf8");
    if (current !== content) backup(full);
  }

  fs.writeFileSync(full, content);
  console.log(`✅ Wrote ${filePath}`);
}

function patchProfile() {
  const file = "src/lib/profile.ts";
  if (!fs.existsSync(file)) fail(`Missing ${file}`);

  let source = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  const original = source;

  if (
    source.includes("const PROFILE_REGISTRATION_CACHE") &&
    source.includes("const raw = (await r.mget(...keys))")
  ) {
    console.log("✅ Profile optimizer already installed.");
    return;
  }

  if (!source.includes("const PROFILE_REGISTRATION_CACHE")) {
    source = source.replace(
      "async function registerProfileKey(",
      `const PROFILE_REGISTRATION_CACHE = new Set<string>();

async function registerProfileKey(`
    );
  }

  source = replaceRegex(
    source,
    /async function registerProfileKey\(\s*channelId:\s*string,\s*key:\s*string\s*\):\s*Promise<void>\s*\{[\s\S]*?\n\}(?=\n\nexport async function getViewerProfile)/,
    `async function registerProfileKey(
  channelId: string,
  key: string
): Promise<void> {
  const cacheKey = \`\${channelId}:\${key}\`;

  if (PROFILE_REGISTRATION_CACHE.has(cacheKey)) return;

  const r = getRedis();
  if (!r) return;

  const indexKey = profileIndexKey(channelId);
  const keys = (await r.get<string[]>(indexKey)) ?? [];

  if (!keys.includes(key)) {
    keys.push(key);
    await r.set(indexKey, keys);
  }

  PROFILE_REGISTRATION_CACHE.add(cacheKey);

  if (PROFILE_REGISTRATION_CACHE.size > 5000) {
    PROFILE_REGISTRATION_CACHE.clear();
    PROFILE_REGISTRATION_CACHE.add(cacheKey);
  }
}`,
    "profile registration cache"
  );

  source = source.replace(
    `export async function setViewerProfile(
  profile: ViewerProfile
): Promise<void> {`,
    `export async function setViewerProfile(
  profile: ViewerProfile,
  options?: { register?: boolean }
): Promise<void> {`
  );

  source = source.replace(
    `  await r.set(key, profile);
  await registerProfileKey(profile.channelId, key);`,
    `  await r.set(key, profile);

  if (options?.register !== false) {
    await registerProfileKey(profile.channelId, key);
  }`
  );

  source = source.replace(
    "  await setViewerProfile(profile);\n\n  return profile;",
    "  await setViewerProfile(profile, { register: false });\n\n  return profile;"
  );

  source = replaceRegex(
    source,
    /export async function listViewerProfiles\(\s*channelId:\s*string\s*\):\s*Promise<ViewerProfile\[\]>\s*\{[\s\S]*?return profiles;\s*\n\}/,
    `export async function listViewerProfiles(
  channelId: string
): Promise<ViewerProfile[]> {
  const r = getRedis();
  if (!r) return [];

  const indexKey = profileIndexKey(channelId);
  const keys = (await r.get<string[]>(indexKey)) ?? [];

  if (keys.length === 0) return [];

  const raw = (await r.mget(...keys)) as Array<ViewerProfile | null>;
  const profiles: ViewerProfile[] = [];

  for (let index = 0; index < raw.length; index++) {
    const data = raw[index];
    if (!data) continue;

    profiles.push(
      normalizeViewerProfile(
        data,
        data.channelId ?? channelId,
        data.userId ?? keys[index]?.split(":").pop() ?? "anon",
        data.displayName ?? "Player"
      )
    );
  }

  return profiles;
}`,
    "batched profile leaderboard loading"
  );

  if (source !== original) {
    backup(file);
    fs.writeFileSync(file, source);
    console.log("✅ Optimized profile registration and leaderboard reads.");
  }
}

function patchInventory() {
  const file = "src/lib/inventory.ts";
  if (!fs.existsSync(file)) fail(`Missing ${file}`);

  let source = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  const original = source;

  if (
    source.includes("const grantsList = (await r.mget(...keys))") &&
    source.includes("const originalBuffs = JSON.stringify")
  ) {
    console.log("✅ Inventory optimizer already installed.");
    return;
  }

  source = replaceRegex(
    source,
    /async function claimPendingGrants\(\s*inventory:\s*ViewerInventory,\s*user:\s*NightbotUser\s*\|\s*null\s*\):\s*Promise<boolean>\s*\{[\s\S]*?return changed;\s*\n\}/,
    `async function claimPendingGrants(
  inventory: ViewerInventory,
  user: NightbotUser | null
): Promise<boolean> {
  const r = getRedis();
  if (!r) return false;

  const usernames = getPossibleUsernames(user);
  if (usernames.length === 0) return false;

  const keys = usernames.map((username) =>
    pendingGrantKey(inventory.channelId, username)
  );

  const grantsList = (await r.mget(...keys)) as Array<
    Record<string, number> | null
  >;

  const claimedKeys: string[] = [];
  let changed = false;

  for (let index = 0; index < grantsList.length; index++) {
    const grants = grantsList[index] ?? {};

    for (const [tokenId, amount] of Object.entries(grants)) {
      addToken(inventory, tokenId, amount);
      changed = true;
    }

    if (Object.keys(grants).length > 0) {
      claimedKeys.push(keys[index]);
    }
  }

  if (claimedKeys.length > 0) {
    await r.del(...claimedKeys);
  }

  return changed;
}`,
    "batched pending grants"
  );

  source = source.replace(
    `  removeExpiredBuffs(inventory);

  const effects: RollTokenEffect[] = [];
  let activeBuffs = inventory.activeBuffs;`,
    `  removeExpiredBuffs(inventory);

  const originalBuffs = JSON.stringify(inventory.activeBuffs);
  const effects: RollTokenEffect[] = [];
  let activeBuffs = inventory.activeBuffs;`
  );

  source = source.replace(
    `  inventory.activeBuffs = activeBuffs;

  await setViewerInventory(inventory);

  return {`,
    `  inventory.activeBuffs = activeBuffs;

  if (JSON.stringify(activeBuffs) !== originalBuffs) {
    await setViewerInventory(inventory);
  }

  return {`
  );

  if (source !== original) {
    backup(file);
    fs.writeFileSync(file, source);
    console.log("✅ Batched token grants and skipped unchanged inventory writes.");
  }
}

function patchSocial() {
  const file = "src/lib/social-system.ts";
  if (!fs.existsSync(file)) fail(`Missing ${file}`);

  let source = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  const original = source;

  if (
    source.includes("existingProfile?: ViewerProfile") &&
    source.includes("const added = rareRolls.slice(0, 3).map")
  ) {
    console.log("✅ Social optimizer already installed.");
    return;
  }

  source = source.replace(
    `export async function recordSocialRolls(channelId: string, user: NightbotUser | null, rolls: Array<{ aura: { id: string; name: string }; effectiveRarity: number }>, source: RollSource): Promise<string[]> {`,
    `export async function recordSocialRolls(channelId: string, user: NightbotUser | null, rolls: Array<{ aura: { id: string; name: string }; effectiveRarity: number }>, source: RollSource, existingProfile?: ViewerProfile): Promise<string[]> {`
  );

  source = source.replace(
    `  const rareRolls = rolls.filter((roll) => roll.effectiveRarity >= RECENT_MIN_RARITY).sort((a, b) => b.effectiveRarity - a.effectiveRarity);
  for (const roll of rareRolls.slice(0, 3)) await addRecentPull(channelId, { userId, displayName, auraId: roll.aura.id, auraName: roll.aura.name, rarity: roll.effectiveRarity, source, createdAt: Date.now() });`,
    `  const rareRolls = rolls
    .filter((roll) => roll.effectiveRarity >= RECENT_MIN_RARITY)
    .sort((a, b) => b.effectiveRarity - a.effectiveRarity);

  if (rareRolls.length > 0) {
    const existing = await getRecent(channelId);
    const now = Date.now();
    const added = rareRolls.slice(0, 3).map((roll, index) => ({
      userId,
      displayName,
      auraId: roll.aura.id,
      auraName: roll.aura.name,
      rarity: roll.effectiveRarity,
      source,
      createdAt: now + index,
    }));

    await setRecent(channelId, [...added, ...existing]);
  }`
  );

  source = source.replace(
    "  const profile = await getViewerProfile(channelId, user);",
    "  const profile = existingProfile ?? await getViewerProfile(channelId, user);"
  );

  if (source !== original) {
    backup(file);
    fs.writeFileSync(file, source);
    console.log("✅ Batched recent pulls and reused the updated profile.");
  }
}

function patchMega() {
  const file = "src/lib/mega-feature-system.ts";
  if (!fs.existsSync(file)) fail(`Missing ${file}`);

  let source = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  const original = source;

  if (
    source.includes("const statEntries = PERIODS.flatMap") &&
    source.includes("profileRolls?: number")
  ) {
    console.log("✅ Mega-feature optimizer already installed.");
    return;
  }

  source = source.replace(
    `async function postDiscord(channelId: string, payload: Record<string, unknown>): Promise<void> {
  const settings = await getMegaDiscordSettings(channelId);`,
    `async function postDiscord(
  channelId: string,
  payload: Record<string, unknown>,
  settingsOverride?: DiscordSettings
): Promise<void> {
  const settings =
    settingsOverride ?? (await getMegaDiscordSettings(channelId));`
  );

  source = replaceRegex(
    source,
    /async function updateRecords\(channelId:\s*string,\s*userId:\s*string,\s*userName:\s*string,\s*channelName:\s*string,\s*results:\s*Array<\{ aura:\s*AuraDef;\s*effectiveRarity:\s*number \}>,\s*source:\s*"roll"\s*\|\s*"potion"\s*\|\s*"token"\):\s*Promise<void>\s*\{[\s\S]*?\n\}(?=\n\nexport async function recordMegaRolls)/,
    `async function updateRecords(
  channelId: string,
  userId: string,
  userName: string,
  channelName: string,
  results: Array<{ aura: AuraDef; effectiveRarity: number }>,
  source: "roll" | "potion" | "token",
  profileRolls: number
): Promise<void> {
  const r = getRedis();
  if (!r) return;

  const recordKey = kRecords(channelId);
  const firstKey = kFirsts(channelId);
  const replayKey = kReplay(channelId);

  const [recordRaw, firstRaw, replayRaw] = (await r.mget(
    recordKey,
    firstKey,
    replayKey
  )) as [RecordsState | null, FirstState | null, ReplayPull[] | null];

  const records =
    recordRaw ?? {
      totalRarePulls: 0,
      rareBiomes: {},
      updatedAt: Date.now(),
    };

  const firsts = firstRaw ?? { auras: {}, biomes: {} };
  const replay = replayRaw ?? [];
  const today = todayKey();

  for (const result of results) {
    if (!firsts.auras[result.aura.id]) {
      firsts.auras[result.aura.id] = {
        id: \`\${Date.now()}:\${result.aura.id}:first\`,
        userId,
        userName,
        auraId: result.aura.id,
        auraName: result.aura.name,
        rarity: result.effectiveRarity,
        channelName,
        source,
        createdAt: Date.now(),
      };
    }

    if (result.effectiveRarity >= 100000) {
      records.totalRarePulls++;
    }

    if (result.effectiveRarity >= 100000000) {
      const pull: ReplayPull = {
        id: \`\${Date.now()}:\${result.aura.id}:\${Math.random()
          .toString(36)
          .slice(2, 8)}\`,
        userId,
        userName,
        auraId: result.aura.id,
        auraName: result.aura.name,
        rarity: result.effectiveRarity,
        channelName,
        source,
        createdAt: Date.now(),
      };

      replay.unshift(pull);

      if (!records.bestAura || pull.rarity > records.bestAura.rarity) {
        records.bestAura = pull;
      }

      if (
        !records.biggestToday ||
        todayKey(records.biggestToday.createdAt) !== today ||
        pull.rarity > records.biggestToday.rarity
      ) {
        records.biggestToday = pull;
      }
    }
  }

  if (
    !records.mostRollsUser ||
    profileRolls > records.mostRollsUser.rolls
  ) {
    records.mostRollsUser = {
      userId,
      userName,
      rolls: profileRolls,
    };
  }

  records.updatedAt = Date.now();

  await r.mset({
    [replayKey]: replay.slice(0, 100),
    [recordKey]: records,
    [firstKey]: firsts,
  });
}`,
    "batched records"
  );

  source = source.replace(
    `export async function recordMegaRolls(options: { channelId: string; channelName?: string | null; user: NightbotUser | null; results: Array<{ aura: AuraDef; effectiveRarity: number }>; source?: "roll" | "potion" | "token"; estimatedLuck?: number; }): Promise<void> {`,
    `export async function recordMegaRolls(options: { channelId: string; channelName?: string | null; user: NightbotUser | null; results: Array<{ aura: AuraDef; effectiveRarity: number }>; source?: "roll" | "potion" | "token"; estimatedLuck?: number; profileRolls?: number; }): Promise<void> {`
  );

  source = replaceRegex(
    source,
    /  for \(const period of PERIODS\) \{[\s\S]*?  \}\n\n  await updateRecords\(options\.channelId, userId, userName, channelName, options\.results, source\);/,
    `  const statEntries = PERIODS.flatMap((period) => {
    const pkey = periodKey(period);

    return [
      {
        key: kStats(options.channelId, period, pkey),
        period,
        pkey,
        userId,
        userName,
      },
      {
        key: kGlobalStats(period, pkey),
        period,
        pkey,
        userId: \`\${options.channelId}:\${userId}\`,
        userName: \`\${channelName}/\${userName}\`,
      },
    ];
  });

  const statValues = (await r.mget(
    ...statEntries.map((entry) => entry.key)
  )) as Array<PeriodStats | null>;

  const statWrites: Record<string, PeriodStats> = {};

  for (let index = 0; index < statEntries.length; index++) {
    const entry = statEntries[index];
    const stats =
      statValues[index] ?? createStats(entry.period, entry.pkey);

    updateStats(
      stats,
      entry.userId,
      entry.userName,
      options.results
    );

    stats.updatedAt = Date.now();
    statWrites[entry.key] = stats;
  }

  await r.mset(statWrites);

  await updateRecords(
    options.channelId,
    userId,
    userName,
    channelName,
    options.results,
    source,
    options.profileRolls ?? 0
  );`,
    "batched period stats"
  );

  source = source.replace(
    `export async function sendMegaDiscordAuraAlert(options: { channelId: string; channelName?: string | null; displayName: string; aura: AuraDef; effectiveRarity: number; source: "roll" | "potion" | "token"; tierId?: string; }): Promise<void> {
  const settings = await getMegaDiscordSettings(options.channelId);`,
    `export async function sendMegaDiscordAuraAlert(options: { channelId: string; channelName?: string | null; displayName: string; aura: AuraDef; effectiveRarity: number; source: "roll" | "potion" | "token"; tierId?: string; settings?: DiscordSettings; }): Promise<void> {
  const settings =
    options.settings ?? (await getMegaDiscordSettings(options.channelId));`
  );

  source = source.replace(
    `    await sendMegaDiscordAuraAlert({
      channelId: options.channelId,
      channelName,
      displayName: userName,
      aura: hit.aura,
      effectiveRarity: hit.effectiveRarity,
      source,
    });`,
    `    await sendMegaDiscordAuraAlert({
      channelId: options.channelId,
      channelName,
      displayName: userName,
      aura: hit.aura,
      effectiveRarity: hit.effectiveRarity,
      source,
      settings: discordSettings,
    });`
  );

  source = source.replace(
    `  await postDiscord(options.channelId, { embeds: [{ title: options.tierId === "dev-exclusive" ? "📌 DEV-EXCLUSIVE Aura Pulled!" : "🌌 Rare Aura Pulled!", description: \`**\${options.displayName}** \${options.source === "potion" ? "popped and got" : "rolled"} **\${options.aura.name}**\`, color: options.tierId === "dev-exclusive" ? 0xffd700 : 0x9b59b6, fields: [ { name: "Aura", value: options.aura.name, inline: true }, { name: "Rarity", value: formatRarity(options.effectiveRarity), inline: true }, { name: "Player", value: options.displayName, inline: true }, { name: "Twitch Channel", value: \`\${channel}\\n\${channelUrl(channel)}\`, inline: false } ], timestamp: new Date().toISOString() }] });`,
    `  await postDiscord(
    options.channelId,
    {
      embeds: [
        {
          title:
            options.tierId === "dev-exclusive"
              ? "📌 DEV-EXCLUSIVE Aura Pulled!"
              : "🌌 Rare Aura Pulled!",
          description: \`**\${options.displayName}** \${
            options.source === "potion" ? "popped and got" : "rolled"
          } **\${options.aura.name}**\`,
          color:
            options.tierId === "dev-exclusive"
              ? 0xffd700
              : 0x9b59b6,
          fields: [
            {
              name: "Aura",
              value: options.aura.name,
              inline: true,
            },
            {
              name: "Rarity",
              value: formatRarity(options.effectiveRarity),
              inline: true,
            },
            {
              name: "Player",
              value: options.displayName,
              inline: true,
            },
            {
              name: "Twitch Channel",
              value: \`\${channel}\\n\${channelUrl(channel)}\`,
              inline: false,
            },
          ],
          timestamp: new Date().toISOString(),
        },
      ],
    },
    settings
  );`
  );

  if (source !== original) {
    backup(file);
    fs.writeFileSync(file, source);
    console.log("✅ Batched period stats, records, firsts, replay, and Discord settings.");
  }
}

function patchRoll() {
  const file = "src/pages/api/roll.ts";
  if (!fs.existsSync(file)) fail(`Missing ${file}`);

  let source = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  const original = source;

  if (source.includes("const updatedProfile = await recordViewerRolls")) {
    console.log("✅ Roll profile-reuse optimizer already installed.");
    return;
  }

  source = source.replace(
    `      await recordViewerRolls(
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

      await recordMegaRolls({`,
    `      const updatedProfile = await recordViewerRolls(
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
        oneTimeTokenAssisted ? "token" : "roll",
        updatedProfile
      );

      await recordMegaRolls({`
  );

  source = source.replace(
    `        source: oneTimeTokenAssisted ? "token" : "roll",
      });`,
    `        source: oneTimeTokenAssisted ? "token" : "roll",
        profileRolls:
          updatedProfile.rolls + updatedProfile.tokenRolls,
      });`
  );

  if (source !== original) {
    backup(file);
    fs.writeFileSync(file, source);
    console.log("✅ Reused the updated profile across roll subsystems.");
  }
}

patchProfile();
patchInventory();
patchSocial();
patchMega();
patchRoll();

for (const middlewarePath of ["src/middleware.ts", "middleware.ts"]) {
  if (!fs.existsSync(middlewarePath)) continue;

  let middleware = fs.readFileSync(middlewarePath, "utf8").replace(/\r\n/g, "\n");
  const original = middleware;

  if (
    middleware.includes("const ADMIN_COMMANDS = new Set([") &&
    !middleware.includes('"player-reset"')
  ) {
    middleware = middleware.replace(
      "const ADMIN_COMMANDS = new Set([",
      'const ADMIN_COMMANDS = new Set([\n  "player-reset",'
    );
  }

  if (middleware !== original) {
    backup(middlewarePath);
    fs.writeFileSync(middlewarePath, middleware);
  }
}

console.log("");
console.log("✅ Granular reset v2 + Redis optimizer installed (Windows-safe v2).");
console.log("Website after deploy: /player-reset");

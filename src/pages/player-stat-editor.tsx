import { useEffect, useMemo, useState } from "react";

type Scope = "profile" | "core" | "activity" | "inventory";
type Operation = "add" | "deduct" | "set";
type ValueKind = "number" | "string" | "boolean" | "enum" | "json";
type ApiResult = Record<string, any>;

interface StatDefinition {
  scope: Scope;
  path: string;
  label: string;
  group: string;
  kind: ValueKind;
  description: string;
  options?: Array<{ value: string; label: string }>;
  locked?: boolean;
  source?: "known" | "saved";
}

const DEFAULT_CHANNEL_ID = "904797805";

const MATERIALS = [
  ["scrap", "Scrap"], ["metal_bits", "Metal Bits"], ["mechanical_scrap", "Mechanical Scrap"],
  ["circuit_scrap", "Circuit Scrap"], ["signal_fragment", "Signal Fragment"], ["refined_alloy", "Refined Alloy"],
  ["stabilized_flux", "Stabilized Flux"], ["chrono_dust", "Chrono Dust"], ["quantum_residue", "Quantum Residue"],
  ["void_glass", "Void Glass"], ["stellar_ink", "Stellar Ink"], ["reality_thread", "Reality Thread"],
  ["dimensional_seal", "Dimensional Seal"], ["anomaly_matter", "Anomaly Matter"], ["singularity_shard", "Singularity Shard"],
  ["glitched_alloy", "Glitched Alloy"], ["forbidden_circuit", "Forbidden Circuit"], ["thermal_paste", "Thermal Paste"],
  ["conductive_gel", "Conductive Gel"], ["energy_cell", "Energy Cell"], ["debug_fragment", "Debug Fragment"],
] as const;

const COMPONENT_FAMILIES = [
  "wire", "cable", "plate", "rod", "screw", "bolt", "coil", "resistor", "smd_resistor",
  "transistor", "smd_transistor", "capacitor", "smd_capacitor", "diode", "smd_diode",
  "fuse", "relay", "sensor", "emitter", "lens", "heat_sink", "battery_cell", "power_cell",
  "circuit_board", "processor", "logic_chip", "regulator", "stabilizer", "conduit", "matrix",
] as const;

const TIER_NAMES = ["Basic", "Copper", "Refined", "Stabilized", "Quantum", "Reality", "Singularity", "Dimensional", "Anomaly", "Forbidden"] as const;

const PATH_COMPONENTS = [
  "stability_buffer", "stability_lock", "quantum_anchor", "reality_bastion", "singularity_seal", "absolute_lock",
  "volatile_capacitor", "risk_compressor", "chaos_engine", "rupture_core", "singularity_overdrive", "cataclysm_drive",
  "support_relay", "support_regulator", "logistics_matrix", "restoration_hub", "quantum_coordinator", "celestial_network",
  "biome_sensor", "biome_lens", "climate_resonator", "dimensional_ecoscope", "worldseed_prism", "omnibiome_array",
  "targeting_filter", "precision_filter", "probability_calibrator", "reality_sieve", "singularity_scope", "absolute_predictor",
  "token_socket", "token_amplifier", "voucher_encoder", "token_reactor", "infinite_ledger", "sovereign_mint",
  "instability_buffer", "anomaly_compressor", "rift_decoder", "null_processor", "paradox_engine", "forbidden_singularity",
  "divergence_matrix", "realignment_matrix", "stellar_regulator",
] as const;

const CORE_TOKENS = [
  ["recipe_token", "Recipe Token"], ["path_token", "Path Token"], ["reactor_token", "Reactor Token"],
  ["crafting_token", "Crafting Token"], ["quest_token", "Quest Token"], ["wall_token", "Wall Token"],
  ["anomaly_token", "Anomaly Token"],
] as const;

const LOOTBOXES = [
  ["starter_box", "Starter Box"], ["core_box", "Core Box"], ["quest_box", "Quest Box"],
  ["reactor_box", "Reactor Box"], ["anomaly_box", "Anomaly Box"], ["dev_box", "Dev Box"],
] as const;

const PROFILE_TIERS = [
  "basic", "epic", "unique", "legendary", "mythic", "exalted", "glorious", "transcendent",
  "challenged", "dimensional", "challenged+", "dev-exclusive",
] as const;

const RESEARCH_IDS = [
  "archive_memory_1", "archive_memory_2", "craft_efficiency_1", "craft_efficiency_2", "core_mapping_1", "core_mapping_2",
  "boss_damage_1", "boss_damage_2", "boss_damage_3", "boss_damage_4", "boss_damage_5", "boss_damage_6",
  "relic_slot_2", "relic_slot_3", "relic_attune_1", "relic_attune_2", "relic_reforger",
  "scanner_1", "scanner_2", "scanner_3", "scanner_4", "scanner_5", "scanner_6", "scanner_7", "scanner_8", "scanner_9", "scanner_10",
  "market_contacts_1", "market_contacts_2", "market_haggle_1", "blueprint_reading", "blueprint_assembly", "wall_breaker_1",
  "forecast_1", "forecast_2", "forecast_3",
] as const;

const BLUEPRINT_IDS = ["biome_lens", "relic_forge", "quantum_press", "boss_beacon", "archive_terminal", "forbidden_frame"] as const;

const INVENTORY_TOKEN_IDS = [
  "clover", "lunar", "fortune", "eclipse", "starlight", "nebula", "spark", "drizzle", "ember", "frost", "bloom", "storm",
  "prism", "comet", "galaxy", "nova", "astral", "supernova", "focus", "catalyst", "horizon", "distortion", "resonance",
  "pulse", "stability", "eclipse_core", "popping", "bound", "heavenly", "dune", "void_heart", "red_fragment_ii",
  "pump_kings_blood", "axis_potion", "xyz_potion", "word_potion", "chaos_potion", "godlike", "oblivion", "overpowered_potion",
] as const;

function titleCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[._\-\s:]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function known(
  scope: Scope,
  path: string,
  label: string,
  group: string,
  kind: ValueKind,
  description: string,
  options?: Array<{ value: string; label: string }>,
  locked = false
): StatDefinition {
  return { scope, path, label, group, kind, description, options, locked, source: "known" };
}

const NUMBER_DESCRIPTION = "A numeric value. Add/deduct changes the current number; set replaces it.";

function buildKnownStats(): StatDefinition[] {
  const definitions: StatDefinition[] = [
    known("profile", "rolls", "Normal rolls", "Rolls & XP", "number", NUMBER_DESCRIPTION),
    known("profile", "tokenRolls", "Token rolls", "Rolls & XP", "number", NUMBER_DESCRIPTION),
    known("profile", "potionRolls", "Potion rolls (legacy mirror)", "Rolls & XP", "number", "Legacy mirror of token rolls. Usually edit Token rolls instead."),
    known("profile", "rarityTotal", "Total rolled rarity", "Rolls & XP", "number", NUMBER_DESCRIPTION),
    known("profile", "xp", "XP", "Rolls & XP", "number", NUMBER_DESCRIPTION),
    known("profile", "level", "Level", "Rolls & XP", "number", "Displayed player level. Setting XP does not automatically recalculate this admin value."),
    known("profile", "highestTierRank", "Highest tier rank", "Aura Progress", "number", NUMBER_DESCRIPTION),
    known("profile", "highestTierId", "Highest tier", "Aura Progress", "enum", "The highest aura tier recorded for the player.", [
      { value: "__null__", label: "None / null" },
      ...PROFILE_TIERS.map((tier) => ({ value: tier, label: titleCase(tier) })),
    ]),
    known("profile", "devExclusiveXpAuras", "DEV-exclusive XP aura list", "Aura Progress", "json", "Advanced list. Enter a JSON array such as [\"justice\"]."),

    known("core", "coreTier", "Core tier", "Core Progress", "number", NUMBER_DESCRIPTION),
    known("core", "corePath", "Core path", "Core Progress", "enum", "Current Core path.", [
      "universal", "safe", "risk", "support", "biome", "precision", "token", "anomaly",
    ].map((value) => ({ value, label: titleCase(value) }))),
    known("core", "coreFocus", "Core focus", "Core Progress", "enum", "Whether progression targets the Main Core or Sub-Core.", [
      { value: "main", label: "Main Core" }, { value: "sub", label: "Sub-Core" },
    ]),
    known("core", "shdLevel", "SHD level", "Core Progress", "number", "-1 means uncrafted; 0 and above are crafted SHD levels."),
    known("core", "stardust", "Stardust", "Core Progress", "number", NUMBER_DESCRIPTION),
    known("core", "reactor.level", "Stardust Reactor level", "Reactor", "number", NUMBER_DESCRIPTION),

    known("activity", "knowledge", "Knowledge", "Activity Currencies", "number", NUMBER_DESCRIPTION),
    known("activity", "merchantMarks", "Merchant Marks", "Activity Currencies", "number", NUMBER_DESCRIPTION),
    known("activity", "relicShards", "Relic Shards", "Activity Currencies", "number", NUMBER_DESCRIPTION),
    known("activity", "blueprintFragments", "Blueprint Fragments", "Activity Currencies", "number", NUMBER_DESCRIPTION),
    known("activity", "scannerLevel", "Scanner level", "Activity Progress", "number", "Scanner level from 0 to 10."),

    known("inventory", "activeBuffs", "All active token buffs", "Active Buffs", "json", "Advanced list. Set using valid JSON; use [] to clear all active buffs."),
  ];

  for (const tier of PROFILE_TIERS) {
    definitions.push(known("profile", `ownedTiers.${tier}`, `${titleCase(tier)} auras owned`, "Aura Progress", "number", NUMBER_DESCRIPTION));
  }

  for (const [id, label] of MATERIALS) {
    definitions.push(known("core", `materials.${id}`, label, "Materials", "number", NUMBER_DESCRIPTION));
  }

  for (const family of COMPONENT_FAMILIES) {
    for (let tier = 1; tier <= 10; tier++) {
      const id = `${family}_${tier}`;
      definitions.push(known("core", `components.${id}`, `${TIER_NAMES[tier - 1]} ${titleCase(family)}`, `Components — ${titleCase(family)}`, "number", NUMBER_DESCRIPTION));
    }
  }

  for (const id of PATH_COMPONENTS) {
    definitions.push(known("core", `components.${id}`, titleCase(id), "Path & Special Components", "number", NUMBER_DESCRIPTION));
  }

  for (const [id, label] of CORE_TOKENS) {
    definitions.push(known("core", `tokens.${id}`, label, "Core Tokens", "number", NUMBER_DESCRIPTION));
  }

  for (const [id, label] of LOOTBOXES) {
    definitions.push(known("core", `lootboxes.${id}`, label, "Core Lootboxes", "number", NUMBER_DESCRIPTION));
  }

  const coreStats = [
    "totalRollsTracked", "totalCrafts", "totalComponentsCrafted", "coresCrafted", "shdCrafted", "reactorClaims",
    "questsCompleted", "boxesOpened", "pathSwitches", "highestRarity", "rareRolls100k", "rareRolls1m", "rareRolls10m",
    "materialsCollected", "stardustCollected",
  ];
  for (const id of coreStats) {
    definitions.push(known("core", `stats.${id}`, titleCase(id), "Core Statistics", "number", NUMBER_DESCRIPTION));
  }

  for (const id of RESEARCH_IDS) {
    definitions.push(known("activity", `unlockedResearch.${id}`, titleCase(id), "Research Unlocks", "boolean", "Whether this research node is unlocked."));
  }

  for (const id of BLUEPRINT_IDS) {
    definitions.push(known("activity", `blueprints.${id}`, `${titleCase(id)} Blueprint`, "Blueprint Ownership", "boolean", "Whether this permanent blueprint is owned."));
  }

  const activityStats = ["bossDamage", "bossKills", "knowledgeEarned", "worldEventsSeen", "relicRerolls"];
  for (const id of activityStats) {
    definitions.push(known("activity", `stats.${id}`, titleCase(id), "Activity Statistics", "number", NUMBER_DESCRIPTION));
  }

  for (const id of INVENTORY_TOKEN_IDS) {
    definitions.push(known("inventory", `tokens.${id}`, titleCase(id), "Roll Tokens & Potions", "number", NUMBER_DESCRIPTION));
  }

  return definitions;
}

const KNOWN_STATS = buildKnownStats();
const LOCKED_ROOTS = new Set(["channelId", "userId", "displayName", "createdAt", "updatedAt", "lastActiveAt"]);

function getAt(root: unknown, path: string): unknown {
  let current = root as any;
  for (const segment of path.split(".")) {
    if (current === null || typeof current !== "object") return undefined;
    current = current[segment];
  }
  return current;
}

function inferKind(value: unknown): ValueKind {
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "string") return "string";
  return "json";
}

function dynamicGroup(path: string): string {
  const root = path.split(".")[0];
  const names: Record<string, string> = {
    materials: "Materials", components: "Saved Components", frames: "Saved Frames", tokens: "Saved Tokens",
    lootboxes: "Saved Lootboxes", questProgress: "Quest Progress", questClaimed: "Quest Claims",
    achievementsClaimed: "Achievement Claims", unlocks: "Unlock Flags", activeJobs: "Active Jobs",
    subCores: "Sub-Cores", reactor: "Reactor", stats: "Statistics", ownedTiers: "Aura Progress",
    weeklyXp: "Weekly XP", claimedLevelRewards: "Level Reward Claims", bestAura: "Best Aura Record",
    bestTokenAura: "Best Token Record", bestPotionAura: "Best Potion Record", unlockedResearch: "Research Unlocks",
    blueprints: "Blueprint Ownership", relics: "Relics", activeBuffs: "Active Buffs",
  };
  return names[root] ?? "Other Saved Fields";
}

function mergeDefinitions(scope: Scope, lookup: ApiResult | null): StatDefinition[] {
  const knownStats = KNOWN_STATS.filter((entry) => entry.scope === scope);
  const map = new Map(knownStats.map((entry) => [entry.path, entry]));
  const paths = (lookup?.paths?.[scope] ?? []) as string[];
  const record = lookup?.scopes?.[scope];

  for (const path of paths) {
    if (map.has(path)) continue;
    const value = getAt(record, path);
    const root = path.split(".")[0];
    map.set(path, {
      scope,
      path,
      label: titleCase(path),
      group: dynamicGroup(path),
      kind: inferKind(value),
      description: "This field already exists in the player's saved record.",
      locked: LOCKED_ROOTS.has(root),
      source: "saved",
    });
  }

  return [...map.values()].sort((a, b) =>
    a.group.localeCompare(b.group) || a.label.localeCompare(b.label)
  );
}

function parseValue(raw: string, definition: StatDefinition): unknown {
  if (definition.kind === "number") {
    const value = Number(raw.replace(/,/g, ""));
    if (!Number.isFinite(value)) throw new Error("Enter a valid number.");
    return value;
  }
  if (definition.kind === "boolean") return raw === "true";
  if (definition.kind === "enum") return raw === "__null__" ? null : raw;
  if (definition.kind === "json") {
    try {
      return JSON.parse(raw);
    } catch {
      throw new Error("Enter valid JSON for this advanced field.");
    }
  }
  return raw;
}

function defaultInput(definition: StatDefinition): string {
  if (definition.kind === "number") return "1000";
  if (definition.kind === "boolean") return "true";
  if (definition.kind === "enum") return definition.options?.[0]?.value ?? "";
  if (definition.kind === "json") return "{}";
  return "";
}

function formatCurrent(value: unknown): string {
  if (value === undefined) return "Not saved yet (treated as 0 for numeric add/deduct)";
  if (typeof value === "string") return value || "Empty string";
  const rendered = JSON.stringify(value);
  if (rendered.length > 100) return `${rendered.slice(0, 97)}...`;
  return rendered;
}

export default function PlayerStatEditor() {
  const [cronSecret, setCronSecret] = useState("");
  const [userStatCode, setUserStatCode] = useState("");
  const [channelId, setChannelId] = useState(DEFAULT_CHANNEL_ID);
  const [username, setUsername] = useState("");
  const [userId, setUserId] = useState("");
  const [scope, setScope] = useState<Scope>("core");
  const [selectedPath, setSelectedPath] = useState("stardust");
  const [group, setGroup] = useState("Core Progress");
  const [search, setSearch] = useState("");
  const [operation, setOperation] = useState<Operation>("add");
  const [value, setValue] = useState("1000");
  const [confirmation, setConfirmation] = useState("");
  const [lookup, setLookup] = useState<ApiResult | null>(null);
  const [preview, setPreview] = useState<ApiResult | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [status, setStatus] = useState("Step 1: enter both secret codes, then load a player.");
  const [busy, setBusy] = useState(false);
  const [showJson, setShowJson] = useState(false);

  const definitions = useMemo(() => mergeDefinitions(scope, lookup), [scope, lookup]);
  const groups = useMemo(() => [...new Set(definitions.map((entry) => entry.group))], [definitions]);
  const selectedDefinition = useMemo(
    () => definitions.find((entry) => entry.path === selectedPath) ?? definitions[0],
    [definitions, selectedPath]
  );

  const filteredDefinitions = useMemo(() => {
    const query = search.trim().toLowerCase();
    return definitions.filter((entry) => {
      const inGroup = group === "All stats" || entry.group === group;
      if (!inGroup) return false;
      if (!query) return true;
      return `${entry.label} ${entry.path} ${entry.description}`.toLowerCase().includes(query);
    });
  }, [definitions, group, search]);

  const currentValue = selectedDefinition
    ? getAt(lookup?.scopes?.[scope], selectedDefinition.path)
    : undefined;

  useEffect(() => {
    if (definitions.length === 0) return;
    const existing = definitions.find((entry) => entry.path === selectedPath);
    const next = existing ?? definitions.find((entry) => !entry.locked) ?? definitions[0];
    if (next.path !== selectedPath) setSelectedPath(next.path);
    if (!groups.includes(group)) setGroup(next.group);
  }, [definitions, groups, group, selectedPath]);

  useEffect(() => {
    if (!selectedDefinition) return;
    if (selectedDefinition.kind !== "number") setOperation("set");
    setValue(defaultInput(selectedDefinition));
    setPreview(null);
    setConfirmation("");
  }, [selectedDefinition?.path, selectedDefinition?.kind]);

  async function call(body: Record<string, unknown>): Promise<ApiResult> {
    setBusy(true);
    try {
      const response = await fetch("/api/player-stat-editor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cronSecret, userStatCode, ...body }),
      });
      const result = (await response.json()) as ApiResult;
      if (!response.ok || !result.ok) throw new Error(result.error ?? `Request failed (${response.status})`);
      return result;
    } finally {
      setBusy(false);
    }
  }

  async function loadPlayer() {
    try {
      setStatus("Loading every saved player scope...");
      const result = await call({ action: "lookup", channelId, username, userId });
      setLookup(result);
      setPreview(null);
      setConfirmation("");
      setStatus(`Loaded ${result.target.displayName} (${result.target.userId}). Step 2: click a stat below.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Lookup failed.");
    }
  }

  function selectStat(definition: StatDefinition) {
    setSelectedPath(definition.path);
    setGroup(definition.group);
    setStatus(definition.locked ? "This identity/system field is displayed for reference and cannot be edited here." : `Selected ${definition.label}. Choose an operation and value, then preview.`);
  }

  async function createPreview() {
    if (!selectedDefinition) return;
    try {
      const parsed = parseValue(value, selectedDefinition);
      setStatus("Creating a non-destructive before/after preview...");
      const result = await call({
        action: "preview",
        channelId,
        username,
        userId,
        scope,
        path: selectedDefinition.path,
        operation,
        value: parsed,
      });
      setPreview(result.preview);
      setConfirmation("");
      setStatus("Preview created. Nothing changed yet. Copy the exact confirmation phrase to apply it.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Preview failed.");
    }
  }

  async function applyPreview() {
    if (!preview?.id) return;
    try {
      setStatus("Applying the confirmed edit...");
      const result = await call({ action: "apply", previewId: preview.id, confirmation });
      setPreview(null);
      setConfirmation("");
      setStatus(`Applied safely. Audit ID: ${result.audit.id}`);
      await loadPlayer();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Apply failed.");
    }
  }

  async function loadHistory() {
    try {
      const result = await call({ action: "history" });
      setHistory(result.history ?? []);
      setStatus(`Loaded ${result.history?.length ?? 0} audit entries.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "History failed.");
    }
  }

  async function undo(auditId: string) {
    try {
      const result = await call({ action: "undo", auditId });
      setStatus(result.message);
      await Promise.all([loadHistory(), loadPlayer()]);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Undo failed.");
    }
  }

  return (
    <main className="page">
      <section className="hero">
        <div>
          <p className="eyebrow">SOL'S RNG TWITCH ADMIN</p>
          <h1>Guided Player Stat Editor</h1>
          <p>No stat names need to be typed. Load a player, click the exact stat, preview the result, then confirm it.</p>
        </div>
        <div className="status">{busy ? "Working..." : status}</div>
      </section>

      <section className="steps">
        <div><b>1</b><span>Enter secrets and player</span></div>
        <div><b>2</b><span>Click an exact stat</span></div>
        <div><b>3</b><span>Preview before/after</span></div>
        <div><b>4</b><span>Type confirmation and apply</span></div>
      </section>

      <section className="panel grid two">
        <label>CRON_SECRET<input type="password" value={cronSecret} onChange={(event: { target: { value: string } }) => setCronSecret(event.target.value)} /></label>
        <label>USER_STAT_CODE (case-sensitive)<input type="password" value={userStatCode} onChange={(event: { target: { value: string } }) => setUserStatCode(event.target.value)} /></label>
        <label>Channel Twitch ID <span className="hint">Zipittt is prefilled</span><input value={channelId} onChange={(event: { target: { value: string } }) => setChannelId(event.target.value)} /></label>
        <label>Player username<input value={username} onChange={(event: { target: { value: string } }) => setUsername(event.target.value)} placeholder="isherthegamer" /></label>
        <label>Player Twitch ID <span className="hint">optional, strongest match</span><input value={userId} onChange={(event: { target: { value: string } }) => setUserId(event.target.value)} placeholder="Numeric player ID" /></label>
        <button onClick={loadPlayer} disabled={busy || !cronSecret || !userStatCode || (!username && !userId)}>Load player and every stat</button>
      </section>

      {lookup && (
        <>
          <section className="panel">
            <div className="sectionTitle">
              <div><p className="eyebrow">STEP 2</p><h2>Choose the exact stat</h2><p>{definitions.length} known or currently saved fields are available in this scope.</p></div>
              <button className="secondary" onClick={() => setShowJson((value) => !value)}>{showJson ? "Hide raw record" : "Show raw record"}</button>
            </div>

            <div className="grid three controls">
              <label>System / Scope<select value={scope} onChange={(event: { target: { value: string } }) => { const next = event.target.value as Scope; setScope(next); setSearch(""); setGroup("All stats"); }}><option value="profile">Profile, rolls and XP</option><option value="core">Core, materials and crafting</option><option value="activity">Knowledge, research and relics</option><option value="inventory">Roll tokens and active buffs</option></select></label>
              <label>Category<select value={group} onChange={(event: { target: { value: string } }) => setGroup(event.target.value)}><option value="All stats">All stats</option>{groups.map((entry) => <option value={entry} key={entry}>{entry}</option>)}</select></label>
              <label>Search stats<input value={search} onChange={(event: { target: { value: string } }) => setSearch(event.target.value)} placeholder="scrap, core tier, scanner..." /></label>
            </div>

            <div className="resultCount">Showing {filteredDefinitions.length} stat{filteredDefinitions.length === 1 ? "" : "s"}</div>
            <div className="statGrid">
              {filteredDefinitions.map((definition) => {
                const savedValue = getAt(lookup.scopes?.[scope], definition.path);
                const selected = definition.path === selectedDefinition?.path;
                return (
                  <button type="button" className={`statCard ${selected ? "selected" : ""} ${definition.locked ? "locked" : ""}`} key={definition.path} onClick={() => selectStat(definition)}>
                    <span className="statTop"><strong>{definition.label}</strong>{definition.locked && <em>View only</em>}</span>
                    <code>{definition.path}</code>
                    <small>Current: {formatCurrent(savedValue)}</small>
                  </button>
                );
              })}
            </div>
          </section>

          {showJson && <section className="panel"><h2>Complete current {scope} record</h2><pre className="json">{JSON.stringify(lookup.scopes?.[scope], null, 2)}</pre></section>}

          {selectedDefinition && (
            <section className="panel editorPanel">
              <p className="eyebrow">STEP 3</p>
              <h2>Edit: {selectedDefinition.label}</h2>
              <p>{selectedDefinition.description}</p>
              <div className="selectedPath"><span>Exact saved path</span><code>{scope}.{selectedDefinition.path}</code></div>
              <div className="currentBox"><span>Current value</span><strong>{formatCurrent(currentValue)}</strong></div>

              <div className="grid two">
                <label>Operation<select value={operation} onChange={(event: { target: { value: string } }) => setOperation(event.target.value as Operation)} disabled={selectedDefinition.kind !== "number" || selectedDefinition.locked}>{selectedDefinition.kind === "number" && <><option value="add">Add to current value</option><option value="deduct">Deduct from current value</option></>}<option value="set">Set / replace value</option></select></label>

                {selectedDefinition.kind === "boolean" ? (
                  <label>New value<select value={value} onChange={(event: { target: { value: string } }) => setValue(event.target.value)} disabled={selectedDefinition.locked}><option value="true">True / unlocked / owned</option><option value="false">False / locked / not owned</option></select></label>
                ) : selectedDefinition.kind === "enum" ? (
                  <label>New value<select value={value} onChange={(event: { target: { value: string } }) => setValue(event.target.value)} disabled={selectedDefinition.locked}>{selectedDefinition.options?.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>
                ) : selectedDefinition.kind === "json" ? (
                  <label>New JSON value<textarea value={value} onChange={(event: { target: { value: string } }) => setValue(event.target.value)} rows={4} disabled={selectedDefinition.locked} /></label>
                ) : (
                  <label>{operation === "set" ? "New value" : "Amount"}<input type={selectedDefinition.kind === "number" ? "number" : "text"} value={value} onChange={(event: { target: { value: string } }) => setValue(event.target.value)} disabled={selectedDefinition.locked} /></label>
                )}
              </div>

              {selectedDefinition.locked ? <div className="notice">Identity and timestamp fields appear so every saved field is visible, but they are locked to prevent breaking player data.</div> : <button onClick={createPreview} disabled={busy}>Preview this edit — nothing changes yet</button>}
              <button className="secondary historyButton" onClick={loadHistory} disabled={busy}>Load audit history</button>
            </section>
          )}
        </>
      )}

      {preview && (
        <section className="panel danger">
          <p className="eyebrow">STEP 4</p>
          <h2>Preview — nothing has changed yet</h2>
          <div className="diff"><div><strong>Before</strong><pre>{JSON.stringify(preview.beforeValue, null, 2)}</pre></div><div><strong>After</strong><pre>{JSON.stringify(preview.afterValue, null, 2)}</pre></div></div>
          <p>Check the before and after values. Then type this phrase exactly:</p>
          <code className="confirmationCode">{preview.confirmation}</code>
          <input value={confirmation} onChange={(event: { target: { value: string } }) => setConfirmation(event.target.value)} placeholder="Exact confirmation phrase" />
          <button className="dangerButton" onClick={applyPreview} disabled={busy || confirmation !== preview.confirmation}>Apply confirmed edit</button>
        </section>
      )}

      {history.length > 0 && (
        <section className="panel">
          <h2>Audit history</h2>
          <p>Undo restores the complete affected scope to its state before that edit.</p>
          <div className="history">{history.map((entry) => <article key={entry.id}><div><strong>{entry.target?.displayName}</strong> — {entry.scope}.{entry.path}</div><small>{entry.operation} {JSON.stringify(entry.inputValue)} · {new Date(entry.appliedAt).toLocaleString()}</small><button onClick={() => undo(entry.id)} disabled={busy || Boolean(entry.undoneAt) || Boolean(entry.undoOf)}>{entry.undoneAt ? "Undone" : entry.undoOf ? "Undo record" : "Undo whole scope"}</button></article>)}</div>
        </section>
      )}

      <style jsx>{`
        :global(body){margin:0;background:#090b12;color:#f5f7ff;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.page{max-width:1180px;margin:0 auto;padding:36px 20px 80px}.hero{display:flex;justify-content:space-between;gap:24px;align-items:flex-end;margin-bottom:20px}.eyebrow{font-size:12px;letter-spacing:.18em;color:#9ea8ff;font-weight:800;margin:0 0 5px}.hero h1{font-size:42px;margin:4px 0 8px}.hero p,.sectionTitle p,.editorPanel>p,.panel>p{color:#b9c0d4}.status{background:#151928;border:1px solid #2a3047;padding:12px 16px;border-radius:12px;max-width:420px}.steps{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.steps div{display:flex;align-items:center;gap:9px;background:#101421;border:1px solid #242a3e;padding:11px;border-radius:12px;color:#c8cee0;font-size:13px}.steps b{display:grid;place-items:center;width:25px;height:25px;border-radius:50%;background:#6978ff;color:#fff}.panel{background:#111522;border:1px solid #252b40;border-radius:18px;padding:20px;margin-top:18px;box-shadow:0 18px 50px rgba(0,0,0,.22)}.grid{display:grid;gap:16px}.two{grid-template-columns:repeat(2,minmax(0,1fr))}.three{grid-template-columns:repeat(3,minmax(0,1fr))}.sectionTitle{display:flex;justify-content:space-between;gap:20px;align-items:flex-start}.sectionTitle h2,.editorPanel h2{margin:2px 0 4px}.hint{font-weight:500;color:#8993ad;margin-left:5px}label{display:grid;gap:7px;font-size:13px;font-weight:700;color:#ccd2e6}input,select,textarea{width:100%;box-sizing:border-box;background:#090c15;color:#fff;border:1px solid #343b55;border-radius:10px;padding:11px 12px;font:inherit}button{align-self:end;background:#6978ff;color:white;border:0;border-radius:10px;padding:12px 16px;font-weight:800;cursor:pointer}button:disabled{opacity:.45;cursor:not-allowed}.secondary{background:#252c43}.controls{margin-top:18px}.resultCount{color:#9ca5be;font-size:13px;margin:16px 0 8px}.statGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;max-height:620px;overflow:auto;padding-right:4px}.statCard{text-align:left;background:#0b0f1a;border:1px solid #262d43;padding:12px;display:grid;gap:7px;align-self:stretch}.statCard:hover{border-color:#6574e9}.statCard.selected{border-color:#8f9aff;background:#171d34;box-shadow:0 0 0 1px #8f9aff inset}.statCard.locked{opacity:.7}.statTop{display:flex;justify-content:space-between;gap:8px}.statTop em{font-size:10px;font-style:normal;color:#f3acb7}.statCard code,.selectedPath code{font-size:11px;color:#9da8ff;overflow-wrap:anywhere}.statCard small{color:#9ca5be;overflow-wrap:anywhere}.selectedPath,.currentBox{background:#090c15;border:1px solid #2b3249;border-radius:12px;padding:12px;margin:12px 0;display:grid;gap:5px}.selectedPath span,.currentBox span{font-size:11px;text-transform:uppercase;letter-spacing:.09em;color:#8f99b3}.currentBox strong{overflow-wrap:anywhere}.notice{background:#2a2025;border:1px solid #633641;color:#ffc5ce;padding:12px;border-radius:10px;margin-top:14px}.historyButton{margin-left:10px}.danger{border-color:#6f3942}.dangerButton{background:#d74c60;margin-top:14px}.diff{display:grid;grid-template-columns:1fr 1fr;gap:14px}.diff>div{background:#090c15;border-radius:12px;padding:12px}.diff pre{white-space:pre-wrap;overflow-wrap:anywhere}.confirmationCode{display:block;padding:12px;background:#090c15;border:1px dashed #e06b7c;border-radius:10px;margin:8px 0 12px;overflow-wrap:anywhere}.json{max-height:560px;overflow:auto;background:#080a11;border-radius:12px;padding:16px}.history{display:grid;gap:10px}.history article{display:grid;grid-template-columns:1fr auto;gap:5px 12px;background:#0b0e18;padding:12px;border-radius:12px}.history small{color:#9ca5be}.history button{grid-column:2;grid-row:1/3;padding:8px 12px}@media(max-width:900px){.statGrid{grid-template-columns:repeat(2,minmax(0,1fr))}.steps{grid-template-columns:repeat(2,1fr)}}@media(max-width:700px){.hero,.sectionTitle{display:block}.status{margin-top:14px}.two,.three,.diff,.statGrid{grid-template-columns:1fr}.historyButton{margin-left:0;margin-top:10px}.history article{grid-template-columns:1fr}.history button{grid-column:auto;grid-row:auto}}
      `}</style>
    </main>
  );
}

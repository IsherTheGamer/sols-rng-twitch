import { useEffect, useMemo, useState } from "react";

type QueryParam = "query" | "args";

type CommandDef = {
  id: string;
  title: string;
  endpoint: string;
  category: string;
  description: string;
  placeholder?: string;
  examples?: string[];
  needsUser?: boolean;
  changesData?: boolean;
  queryParam?: QueryParam;
};

type ResultMap = Record<string, string>;

const COMMANDS: CommandDef[] = [
  { id: "roll", title: "Roll", endpoint: "roll", category: "Main", description: "Roll auras. Uses cooldowns and changes player data.", placeholder: "1", examples: ["1", "3"], needsUser: true, changesData: true, queryParam: "args" },
  { id: "biome", title: "Biome", endpoint: "biome", category: "Main", description: "Current biome status.", examples: [""] },
  { id: "pop", title: "Pop", endpoint: "pop", category: "Main", description: "Potion pop/status command.", placeholder: "help", examples: ["", "help"], needsUser: true, changesData: true },
  { id: "popop", title: "PopOp", endpoint: "popop", category: "Main", description: "Extra potion/pop action endpoint.", placeholder: "help", examples: ["", "help"], needsUser: true, changesData: true },
  { id: "device", title: "Device", endpoint: "device", category: "Main", description: "Device biome/use status.", placeholder: "help", examples: ["", "help"], needsUser: true, changesData: true },
  { id: "dev", title: "Dev Biome", endpoint: "dev", category: "Main", description: "Dev biome command. Restricted actions stay restricted by the endpoint.", placeholder: "status", examples: ["", "status"] },

  { id: "update", title: "Update Notes", endpoint: "update", category: "Info", description: "Update note pages.", placeholder: "1", examples: ["", "2", "3"] },
  { id: "info", title: "Info", endpoint: "info", category: "Info", description: "Sols info encyclopedia.", placeholder: "sol commands", examples: ["sol commands", "sol mega", "sol aura archangel", "sol biomes", "sol token boosts"] },
  { id: "solinfo", title: "Sol Info", endpoint: "solinfo", category: "Info", description: "Alias of !info sol.", placeholder: "commands", examples: ["commands", "mega", "aura archangel", "biomes", "token potions"] },

  { id: "profile", title: "Profile", endpoint: "profile", category: "Profiles + Social", description: "View your profile or search a username.", placeholder: "username", examples: ["", "zipittt"], needsUser: true },
  { id: "recent", title: "Recent Rare Pulls", endpoint: "recent", category: "Profiles + Social", description: "Recent channel rare pulls.", placeholder: "2", examples: ["", "2", "zipittt"] },
  { id: "lb", title: "Leaderboard", endpoint: "lb", category: "Profiles + Social", description: "Reworked leaderboards.", placeholder: "weekly rolls", examples: ["", "best", "daily rolls", "weekly best", "monthly rare", "yearly value", "weekly rolls 2"] },
  { id: "weeklylb", title: "Weekly Leaderboard", endpoint: "weeklylb", category: "Profiles + Social", description: "Shortcut for weekly leaderboard.", placeholder: "best", examples: ["", "best", "rare", "value"] },
  { id: "titles", title: "Titles", endpoint: "titles", category: "Profiles + Social", description: "View/equip titles.", placeholder: "list", examples: ["", "locked", "equip void_touched"], needsUser: true, changesData: true },
  { id: "title", title: "Title", endpoint: "title", category: "Profiles + Social", description: "Title alias/quick command.", placeholder: "void_touched", examples: ["", "void_touched"], needsUser: true, changesData: true },
  { id: "boost", title: "Server Boosts", endpoint: "boost", category: "Profiles + Social", description: "Active server luck boosts.", examples: [""] },
  { id: "active", title: "Active Chat", endpoint: "active", category: "Profiles + Social", description: "Active chat boost status/progress.", examples: [""] },
  { id: "merchant", title: "Merchant", endpoint: "merchant", category: "Profiles + Social", description: "Merchant status/buy. Spawn is mod-only and blocked by safe viewer mode.", placeholder: "buy starter 1", examples: ["", "buy starter 1"], needsUser: true, changesData: true },
  { id: "npc", title: "NPC", endpoint: "npc", category: "Profiles + Social", description: "NPC quest status/claim.", placeholder: "claim", examples: ["", "claim"], needsUser: true, changesData: true },
  { id: "flex", title: "Flex", endpoint: "flex", category: "Profiles + Social", description: "Flex battle status/actions.", placeholder: "challenge username", examples: ["", "challenge zipittt", "accept"], needsUser: true, changesData: true },
  { id: "raid", title: "Raid", endpoint: "raid", category: "Profiles + Social", description: "Raid command. Restricted actions stay restricted by the endpoint.", placeholder: "10", examples: ["", "10"], needsUser: true, changesData: true },

  { id: "dcalerts", title: "Discord Alerts", endpoint: "dcalerts", category: "Mega Systems", description: "Discord alert settings/status. Test/settings are mod-only and blocked by safe viewer mode.", placeholder: "status", examples: ["", "aura 100m", "biome glitched on"] },
  { id: "replay", title: "Rare Replay", endpoint: "replay", category: "Mega Systems", description: "Major 100M+ pull replay.", placeholder: "2", examples: ["", "2", "zipittt"] },
  { id: "records", title: "Records", endpoint: "records", category: "Mega Systems", description: "Channel records.", examples: [""] },
  { id: "firsts", title: "First Discoveries", endpoint: "firsts", category: "Mega Systems", description: "First aura/biome discoveries.", placeholder: "biomes", examples: ["", "biomes"] },
  { id: "aotd", title: "Aura of the Day", endpoint: "aotd", category: "Mega Systems", description: "Daily aura spotlight.", examples: [""] },
  { id: "botd", title: "Biome of the Day", endpoint: "botd", category: "Mega Systems", description: "Daily biome spotlight.", examples: [""] },
  { id: "event", title: "Channel Event", endpoint: "event", category: "Mega Systems", description: "Event status. Start/stop are mod-only and blocked by safe viewer mode.", placeholder: "status", examples: ["", "start luckstorm 10"], needsUser: true, changesData: true },
  { id: "blackmarket", title: "Black Market", endpoint: "blackmarket", category: "Mega Systems", description: "Black Market status/buy. Spawn is mod-only.", placeholder: "buy void_box 1", examples: ["", "buy void_box 1"], needsUser: true, changesData: true },
  { id: "pquests", title: "Player Quests", endpoint: "pquests", category: "Mega Systems", description: "Player daily/weekly/monthly/yearly quests.", placeholder: "weekly", examples: ["", "daily", "weekly", "monthly", "yearly", "daily claim"], needsUser: true, changesData: true },
  { id: "gquests", title: "Global Quests", endpoint: "gquests", category: "Mega Systems", description: "Global daily/weekly/monthly/yearly quests.", placeholder: "weekly", examples: ["", "daily", "weekly", "monthly", "yearly", "daily claim"], needsUser: true, changesData: true },
  { id: "luckdetails", title: "Luck Details", endpoint: "luckdetails", category: "Mega Systems", description: "Full luck breakdown.", examples: [""], needsUser: true },
  { id: "luck", title: "Luck", endpoint: "luck", category: "Mega Systems", description: "Luck estimate/global luck command.", placeholder: "global", examples: ["", "global"], needsUser: true },

  { id: "core", title: "Core", endpoint: "core", category: "Core + Economy", description: "Core status/actions.", placeholder: "recipe", examples: ["", "recipe", "focus main", "focus sub"], needsUser: true, changesData: true },
  { id: "craft", title: "Craft", endpoint: "craft", category: "Core + Economy", description: "Craft recipes/components/core items.", placeholder: "recipe wire_1", examples: ["recipe wire_1", "wire_1 10", "frame", "chassis"], needsUser: true, changesData: true },
  { id: "components", title: "Components", endpoint: "components", category: "Core + Economy", description: "Component inventory pages.", placeholder: "2", examples: ["", "2"], needsUser: true },
  { id: "next", title: "Next", endpoint: "next", category: "Core + Economy", description: "Next recommended core/craft step.", examples: [""], needsUser: true },
  { id: "progress", title: "Progress", endpoint: "progress", category: "Core + Economy", description: "Core/crafting progress.", examples: [""], needsUser: true },
  { id: "shd", title: "SHD", endpoint: "shd", category: "Core + Economy", description: "Stardust Holder Device status/actions.", placeholder: "upgrade", examples: ["", "upgrade"], needsUser: true, changesData: true },
  { id: "stardust", title: "Stardust", endpoint: "stardust", category: "Core + Economy", description: "Stardust balance/status.", examples: [""], needsUser: true },
  { id: "subcore", title: "Subcore", endpoint: "subcore", category: "Core + Economy", description: "Sub-core status/actions.", placeholder: "craft", examples: ["", "craft"], needsUser: true, changesData: true },
  { id: "reactor", title: "Reactor", endpoint: "reactor", category: "Core + Economy", description: "Stardust reactor status/actions.", placeholder: "deposit 1000", examples: ["", "deposit 1000", "claim", "upgrade"], needsUser: true, changesData: true },
  { id: "quest", title: "Core Quests", endpoint: "quest", category: "Core + Economy", description: "Older core daily/weekly/story quests.", placeholder: "daily", examples: ["daily", "weekly", "story", "daily 2"], needsUser: true, changesData: true },
  { id: "daily", title: "Daily Core Quests", endpoint: "daily", category: "Core + Economy", description: "Daily quest shortcut.", placeholder: "2", examples: ["", "2"], needsUser: true, changesData: true },
  { id: "weekly", title: "Weekly Core Quests", endpoint: "weekly", category: "Core + Economy", description: "Weekly quest shortcut.", placeholder: "2", examples: ["", "2"], needsUser: true, changesData: true },
  { id: "achievements", title: "Achievements", endpoint: "achievements", category: "Core + Economy", description: "Achievement pages.", placeholder: "2", examples: ["", "2"], needsUser: true },
  { id: "tokens", title: "Tokens", endpoint: "tokens", category: "Core + Economy", description: "Token inventory pages.", placeholder: "2", examples: ["", "2"], needsUser: true },
  { id: "token", title: "Token", endpoint: "token", category: "Core + Economy", description: "Single token command/alias.", placeholder: "help", examples: ["", "help"], needsUser: true },
  { id: "box", title: "Boxes", endpoint: "box", category: "Core + Economy", description: "Lootbox status/open.", placeholder: "open starter 1", examples: ["", "2", "open starter 1", "open quest 1"], needsUser: true, changesData: true },
];

const EXCLUDED = [
  "/api/reset — deletes saved data",
  "/api/biome-tick — cron/state tick",
  "/api/discord-admin — stores webhook URL",
  "/api/discord-test — posts external test alert",
  "/api/summary — posts Discord summary",
  "/api/oauth and callback routes — auth/token routes if present",
];

const HOME_COMMANDS = [
  { id: "biome", query: "" },
  { id: "records", query: "" },
  { id: "recent", query: "" },
  { id: "replay", query: "" },
  { id: "lb", query: "weekly rolls" },
  { id: "aotd", query: "" },
  { id: "botd", query: "" },
  { id: "boost", query: "" },
  { id: "event", query: "" },
  { id: "blackmarket", query: "" },
  { id: "dcalerts", query: "" },
];

function cleanLogin(raw: string): string {
  return raw.trim().replace(/^@+/, "").toLowerCase().replace(/[^a-z0-9_]/g, "");
}

function kv(data: Record<string, string>): string {
  return Object.entries(data).map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join("&");
}

function getDefaultChannelName(): string {
  if (typeof window === "undefined") return "zipittt";
  return new URLSearchParams(window.location.search).get("channel") ?? localStorage.getItem("solDashChannelName") ?? "zipittt";
}

function getDefaultChannelId(): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("channelId") ?? localStorage.getItem("solDashChannelId") ?? "";
}

function getDefaultViewerName(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("solDashViewerName") ?? "";
}

function getDefaultViewerId(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("solDashViewerId") ?? "";
}

export default function Dashboard() {
  const [channelName, setChannelName] = useState("zipittt");
  const [channelId, setChannelId] = useState("");
  const [viewerName, setViewerName] = useState("");
  const [viewerId, setViewerId] = useState("");
  const [category, setCategory] = useState("Home");
  const [search, setSearch] = useState("");
  const [queries, setQueries] = useState<Record<string, string>>({});
  const [results, setResults] = useState<ResultMap>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [lastUrl, setLastUrl] = useState<Record<string, string>>({});

  useEffect(() => {
    setChannelName(getDefaultChannelName());
    setChannelId(getDefaultChannelId());
    setViewerName(getDefaultViewerName());
    setViewerId(getDefaultViewerId());
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("solDashChannelName", channelName);
    localStorage.setItem("solDashChannelId", channelId);
    localStorage.setItem("solDashViewerName", viewerName);
    localStorage.setItem("solDashViewerId", viewerId);
  }, [channelName, channelId, viewerName, viewerId]);

  const categories = useMemo(() => ["Home", ...Array.from(new Set(COMMANDS.map((cmd) => cmd.category)))], []);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return COMMANDS.filter((cmd) => {
      const categoryOk = category === "Home" || cmd.category === category;
      const searchOk = !q || `${cmd.title} ${cmd.endpoint} ${cmd.description}`.toLowerCase().includes(q);
      return categoryOk && searchOk;
    });
  }, [category, search]);

  function headersFor(command: CommandDef): HeadersInit {
    const channelLogin = cleanLogin(channelName) || "default";
    const channelProviderId = channelId.trim() || channelLogin;
    const headers: Record<string, string> = {
      "nightbot-channel": kv({ name: channelLogin, displayName: channelName.trim() || channelLogin, provider: "twitch", providerId: channelProviderId }),
    };
    const viewerLogin = cleanLogin(viewerName);
    const viewerProviderId = viewerId.trim() || viewerLogin;
    if (command.needsUser && viewerLogin) {
      headers["nightbot-user"] = kv({ name: viewerLogin, displayName: viewerName.trim() || viewerLogin, provider: "twitch", providerId: viewerProviderId, userLevel: "everyone" });
    }
    return headers;
  }

  function buildUrl(command: CommandDef, rawQuery: string): string {
    const url = new URL(`/api/${command.endpoint}`, window.location.origin);
    const channelLogin = cleanLogin(channelName) || "default";
    url.searchParams.set("channel", channelLogin);
    if (viewerName.trim()) url.searchParams.set("user", viewerName.trim());
    const value = rawQuery.trim();
    if (value) {
      url.searchParams.set(command.queryParam ?? "query", value);
      url.searchParams.set("query", value);
      if (command.queryParam === "args") url.searchParams.set("args", value);
    }
    return `${url.pathname}${url.search}`;
  }

  async function run(command: CommandDef, forcedQuery?: string) {
    const q = forcedQuery ?? queries[command.id] ?? "";
    const url = buildUrl(command, q);
    setLoading((prev) => ({ ...prev, [command.id]: true }));
    setLastUrl((prev) => ({ ...prev, [command.id]: url }));
    setResults((prev) => ({ ...prev, [command.id]: "Loading..." }));
    try {
      const response = await fetch(url, { headers: headersFor(command) });
      const body = await response.text();
      setResults((prev) => ({ ...prev, [command.id]: response.ok ? body : `HTTP ${response.status}: ${body}` }));
    } catch (err) {
      setResults((prev) => ({ ...prev, [command.id]: err instanceof Error ? err.message : "Unknown fetch error" }));
    } finally {
      setLoading((prev) => ({ ...prev, [command.id]: false }));
    }
  }

  async function refreshHome() {
    const toRun = HOME_COMMANDS.map((item) => COMMANDS.find((cmd) => cmd.id === item.id)).filter(Boolean) as CommandDef[];
    for (const cmd of toRun) {
      const q = HOME_COMMANDS.find((item) => item.id === cmd.id)?.query ?? "";
      await run(cmd, q);
    }
  }

  function setQuery(id: string, value: string) {
    setQueries((prev) => ({ ...prev, [id]: value }));
  }

  const homeResults = HOME_COMMANDS.map((item) => COMMANDS.find((cmd) => cmd.id === item.id)).filter(Boolean) as CommandDef[];

  return (
    <main style={styles.page}>
      <section style={styles.hero}>
        <div>
          <div style={styles.badge}>Sols RNG Twitch Bot</div>
          <h1 style={styles.h1}>Web Dashboard</h1>
          <p style={styles.muted}>A safe website layer for your existing API commands. Dangerous admin/cron endpoints are hidden.</p>
        </div>
        <button style={styles.primaryButton} onClick={refreshHome}>Refresh overview</button>
      </section>

      <section style={styles.panel}>
        <h2 style={styles.h2}>Channel + viewer</h2>
        <div style={styles.grid4}>
          <label style={styles.label}>Twitch channel login<input style={styles.input} value={channelName} onChange={(e) => setChannelName(e.target.value)} placeholder="zipittt" /></label>
          <label style={styles.label}>Channel ID<input style={styles.input} value={channelId} onChange={(e) => setChannelId(e.target.value)} placeholder="optional; real Twitch ID is best" /></label>
          <label style={styles.label}>Viewer name<input style={styles.input} value={viewerName} onChange={(e) => setViewerName(e.target.value)} placeholder="for player commands" /></label>
          <label style={styles.label}>Viewer ID<input style={styles.input} value={viewerId} onChange={(e) => setViewerId(e.target.value)} placeholder="optional; real Twitch ID is best" /></label>
        </div>
        <p style={styles.note}>For existing saved data, the <b>Channel ID</b> and <b>Viewer ID</b> should match the real Twitch/Nightbot provider IDs. If left blank, the dashboard uses login names as safe web-only fallback IDs.</p>
      </section>

      <section style={styles.panel}>
        <h2 style={styles.h2}>Overview</h2>
        <div style={styles.resultGrid}>
          {homeResults.map((cmd) => (
            <article key={cmd.id} style={styles.smallCard}>
              <div style={styles.cardTop}><strong>{cmd.title}</strong><button style={styles.tinyButton} onClick={() => run(cmd, HOME_COMMANDS.find((item) => item.id === cmd.id)?.query ?? "")}>Run</button></div>
              <pre style={styles.result}>{results[cmd.id] ?? "Not loaded yet."}</pre>
            </article>
          ))}
        </div>
      </section>

      <section style={styles.panel}>
        <div style={styles.toolbar}>
          <div style={styles.tabs}>{categories.map((cat) => <button key={cat} onClick={() => setCategory(cat)} style={cat === category ? styles.activeTab : styles.tab}>{cat}</button>)}</div>
          <input style={styles.search} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search commands..." />
        </div>

        {category === "Home" ? <p style={styles.muted}>Pick a category above to run every safe command from the website.</p> : (
          <div style={styles.commandGrid}>
            {filtered.map((cmd) => {
              const q = queries[cmd.id] ?? "";
              const disabled = cmd.needsUser && !viewerName.trim();
              return (
                <article key={cmd.id} style={styles.commandCard}>
                  <div style={styles.cardTop}>
                    <div><h3 style={styles.h3}>{cmd.title}</h3><code style={styles.endpoint}>/api/{cmd.endpoint}</code></div>
                    {cmd.changesData ? <span style={styles.warn}>changes data</span> : <span style={styles.safe}>read/status</span>}
                  </div>
                  <p style={styles.desc}>{cmd.description}</p>
                  {cmd.needsUser && !viewerName.trim() ? <p style={styles.warningText}>Enter a viewer name to use this command from the dashboard.</p> : null}
                  <input style={styles.input} value={q} onChange={(e) => setQuery(cmd.id, e.target.value)} placeholder={cmd.placeholder ?? "optional query"} />
                  {cmd.examples?.length ? <div style={styles.examples}>{cmd.examples.map((ex, idx) => <button key={`${cmd.id}-ex-${idx}`} style={styles.exampleButton} onClick={() => setQuery(cmd.id, ex)}>{ex || "blank"}</button>)}</div> : null}
                  <div style={styles.actions}>
                    <button style={disabled ? styles.disabledButton : styles.primaryButton} onClick={() => run(cmd)} disabled={disabled || loading[cmd.id]}>{loading[cmd.id] ? "Running..." : "Run command"}</button>
                    {lastUrl[cmd.id] ? <a style={styles.linkButton} href={lastUrl[cmd.id]} target="_blank" rel="noreferrer">Open URL</a> : null}
                  </div>
                  <pre style={styles.result}>{results[cmd.id] ?? "Result will show here."}</pre>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section style={styles.panel}>
        <h2 style={styles.h2}>Blocked from website</h2>
        <p style={styles.muted}>These are intentionally not in the dashboard because they are too powerful or should only be called by cron/admin links.</p>
        <ul style={styles.blockedList}>{EXCLUDED.map((item) => <li key={item}>{item}</li>)}</ul>
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "linear-gradient(180deg, #0d1020 0%, #14182d 45%, #0f1324 100%)", color: "#f6f7fb", fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif", padding: 24 },
  hero: { maxWidth: 1200, margin: "0 auto 18px", display: "flex", gap: 16, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" },
  badge: { display: "inline-block", padding: "6px 10px", borderRadius: 999, background: "rgba(124, 92, 255, 0.18)", border: "1px solid rgba(124, 92, 255, 0.45)", color: "#cfc7ff", fontSize: 13 },
  h1: { margin: "12px 0 4px", fontSize: 44, lineHeight: 1 },
  h2: { margin: "0 0 12px", fontSize: 22 },
  h3: { margin: 0, fontSize: 18 },
  muted: { color: "#aab0c7", margin: "4px 0" },
  panel: { maxWidth: 1200, margin: "0 auto 18px", background: "rgba(255, 255, 255, 0.06)", border: "1px solid rgba(255, 255, 255, 0.12)", borderRadius: 18, padding: 18, boxShadow: "0 18px 60px rgba(0,0,0,0.25)" },
  grid4: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12 },
  label: { display: "grid", gap: 6, color: "#d8dcf2", fontSize: 13 },
  input: { width: "100%", boxSizing: "border-box", background: "rgba(0,0,0,0.28)", color: "#fff", border: "1px solid rgba(255,255,255,0.16)", borderRadius: 10, padding: "11px 12px", outline: "none" },
  note: { color: "#c9cee5", background: "rgba(255,255,255,0.05)", borderRadius: 12, padding: 12, marginBottom: 0 },
  toolbar: { display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", marginBottom: 16 },
  tabs: { display: "flex", flexWrap: "wrap", gap: 8 },
  tab: { border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.06)", color: "#dce1fa", borderRadius: 999, padding: "9px 12px", cursor: "pointer" },
  activeTab: { border: "1px solid rgba(124, 92, 255, 0.7)", background: "rgba(124, 92, 255, 0.28)", color: "#fff", borderRadius: 999, padding: "9px 12px", cursor: "pointer" },
  search: { minWidth: 220, background: "rgba(0,0,0,0.28)", color: "#fff", border: "1px solid rgba(255,255,255,0.16)", borderRadius: 999, padding: "10px 14px", outline: "none" },
  resultGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 },
  commandGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(310px, 1fr))", gap: 14 },
  smallCard: { background: "rgba(0,0,0,0.22)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, padding: 12 },
  commandCard: { background: "rgba(0,0,0,0.24)", border: "1px solid rgba(255,255,255,0.11)", borderRadius: 16, padding: 14, display: "grid", gap: 10 },
  cardTop: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  endpoint: { color: "#aeb6ff", fontSize: 12 },
  desc: { color: "#c3c8dd", margin: 0, minHeight: 38 },
  warn: { fontSize: 12, color: "#ffd9a8", background: "rgba(255, 178, 81, 0.12)", border: "1px solid rgba(255, 178, 81, 0.3)", padding: "4px 8px", borderRadius: 999, whiteSpace: "nowrap" },
  safe: { fontSize: 12, color: "#b8ffd2", background: "rgba(69, 255, 147, 0.1)", border: "1px solid rgba(69, 255, 147, 0.25)", padding: "4px 8px", borderRadius: 999, whiteSpace: "nowrap" },
  warningText: { margin: 0, color: "#ffd3d3", fontSize: 13 },
  examples: { display: "flex", flexWrap: "wrap", gap: 7 },
  exampleButton: { border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.06)", color: "#dce1fa", borderRadius: 999, padding: "6px 9px", cursor: "pointer", fontSize: 12 },
  actions: { display: "flex", gap: 8, flexWrap: "wrap" },
  primaryButton: { border: 0, background: "linear-gradient(135deg, #7c5cff, #31d6ff)", color: "#fff", borderRadius: 12, padding: "10px 14px", cursor: "pointer", fontWeight: 700 },
  disabledButton: { border: 0, background: "rgba(255,255,255,0.14)", color: "#9aa1bb", borderRadius: 12, padding: "10px 14px", cursor: "not-allowed", fontWeight: 700 },
  tinyButton: { border: "1px solid rgba(255,255,255,0.16)", background: "rgba(255,255,255,0.08)", color: "#fff", borderRadius: 10, padding: "6px 9px", cursor: "pointer" },
  linkButton: { color: "#cfd8ff", textDecoration: "none", border: "1px solid rgba(255,255,255,0.16)", background: "rgba(255,255,255,0.06)", borderRadius: 12, padding: "10px 12px" },
  result: { margin: 0, minHeight: 54, whiteSpace: "pre-wrap", wordBreak: "break-word", background: "rgba(0,0,0,0.33)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: 12, color: "#eef2ff", fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", fontSize: 13 },
  blockedList: { color: "#d6daef", lineHeight: 1.8 },
};

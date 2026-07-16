import Head from "next/head";
import { useMemo, useState } from "react";
import type { CSSProperties } from "react";

const GROUPS = [
  {
    title: "History and discoveries",
    ids: [
      ["recent_pulls", "Recent pulls", "Clear all entries displayed by !recent."],
      ["first_auras", "Aura firsts", "Clear every aura discovery shown by !first / !firsts."],
      ["first_biomes", "Biome firsts", "Clear channel-owned biome first discoveries."],
      ["replay_history", "Replay history", "Clear rare pull replays."],
      ["channel_records", "Channel records", "Clear best-aura, daily and roll record slots."],
    ],
  },
  {
    title: "Statistics and global progression",
    ids: [
      ["channel_period_stats", "Channel period stats", "Daily, weekly, monthly and yearly channel leaderboards/quests."],
      ["global_period_stats", "Cross-channel period stats", "Daily, weekly, monthly and yearly global leaderboard objects."],
      ["global_rolls", "Global roll counter", "Reset global:rolls and therefore global milestone luck."],
      ["global_achievements", "Global achievements/counters", "Reset global achievement progress, aura counts and biome counts."],
      ["global_quest_completions", "Global quest completions", "Reset the global quest-completion counter."],
    ],
  },
  {
    title: "Every viewer",
    ids: [
      ["profiles", "All profiles", "Rolls, XP, levels, best auras and profile fields."],
      ["profile_indexes", "Profile indexes", "Username lookup and standard leaderboard indexes."],
      ["inventories", "All inventories", "Stored tokens and active effects."],
      ["pending_inventory_grants", "Pending grants", "Unclaimed username-based token grants."],
      ["core_players", "All Core data", "Core, SHD, Stardust, materials, crafting, boxes and achievements."],
      ["knowledge_players", "All Knowledge data", "Knowledge, research, relics, blueprints and player boss stats."],
      ["titles", "All titles", "Owned and equipped titles."],
      ["period_quest_claims", "Period quest claims", "All viewer daily/weekly/monthly/yearly claim markers."],
      ["luck_histories", "Luck histories", "Stored best luck and best aura history."],
      ["cooldowns", "All cooldowns", "Player command cooldown keys."],
    ],
  },
  {
    title: "Channel systems and configuration",
    ids: [
      ["channel_state", "Biome/time state", "Current biome, timer, day/night and channel state."],
      ["activity_channel", "Activity channel state", "Boss, world event, merchant and Activity channel data."],
      ["active_events", "Active Mega event", "Luckstorm, biome frenzy and other channel events."],
      ["black_market", "Black Market", "Current stock and expiry."],
      ["server_boosts", "Server boosts", "Active channel-wide luck boosts."],
      ["npc_state", "NPC state", "NPC spawn and quest state."],
      ["flex_challenge", "Flex challenge", "Active flex challenge."],
      ["discord_settings", "Discord alert config", "Saved webhook enable/threshold/biome settings. Environment variables remain."],
      ["roll_access", "10k allowlist", "Dynamic Twitch 10,000-roll access."],
      ["fun_fact_rotation", "Fun-fact rotation", "Current automatic tip index."],
      ["rare_biome_dedupe", "Rare-biome alert marker", "The duplicate-alert prevention marker."],
    ],
  },
  {
    title: "Catch-all and nuclear tools",
    ids: [
      ["remaining_channel_keys", "Remaining channel keys", "Delete unknown/additional keys associated with the selected channel, or all non-backup keys in All Channels scope."],
      ["saved_reset_backups", "Saved reset backups", "Delete recovery snapshots created by this dashboard."],
      ["entire_database", "NUCLEAR: entire Redis database", "Match every Redis key. With backup enabled, the new recovery snapshot is preserved."],
    ],
  },
] as const;

type OptionId = (typeof GROUPS)[number]["ids"][number][0];
type Scope = "channel" | "all";

interface ApiResult {
  ok?: boolean;
  error?: string;
  message?: string;
  preview?: boolean;
  plan?: {
    scope: Scope;
    channelId: string;
    options: string[];
    deleteKeys: string[];
    mutations: Array<{
      kind: string;
      key: string;
      description: string;
      currentEntries: number;
    }>;
    matchedKeyCount: number;
    estimatedStoredValues: number;
    nuclear: boolean;
    confirmation: string;
    notes: string[];
  };
  backups?: Array<{
    key: string;
    createdAt: number;
    scope: string;
    channelId: string;
    sourceKeyCount: number;
    options: string[];
  }>;
  backupKey?: string;
  deletedKeys?: number;
  firstEntriesCleared?: number;
}

export default function GlobalResetPage() {
  const allIds = useMemo(
    () =>
      GROUPS.flatMap((group) =>
        group.ids.map((entry) => entry[0])
      ) as OptionId[],
    []
  );

  const historyIds = useMemo(
    () =>
      GROUPS[0].ids.map((entry) => entry[0]) as OptionId[],
    []
  );

  const channelResetIds = useMemo(
    () =>
      allIds.filter(
        (id) =>
          ![
            "global_period_stats",
            "global_rolls",
            "global_achievements",
            "global_quest_completions",
            "saved_reset_backups",
            "entire_database",
          ].includes(id)
      ),
    [allIds]
  );

  const [secret, setSecret] = useState("");
  const [channelId, setChannelId] = useState("904797805");
  const [scope, setScope] = useState<Scope>("channel");
  const [selected, setSelected] = useState<OptionId[]>([
    "recent_pulls",
    "first_auras",
  ]);
  const [createBackup, setCreateBackup] = useState(true);
  const [confirmation, setConfirmation] = useState("");
  const [preview, setPreview] = useState<ApiResult | null>(null);
  const [result, setResult] = useState<ApiResult | null>(null);
  const [backups, setBackups] = useState<ApiResult["backups"]>([]);
  const [restoreKey, setRestoreKey] = useState("");
  const [restoreConfirmation, setRestoreConfirmation] = useState("");
  const [busy, setBusy] = useState(false);

  function clearPreview() {
    setPreview(null);
    setResult(null);
    setConfirmation("");
  }

  function setSelection(ids: OptionId[]) {
    setSelected([...new Set(ids)]);
    clearPreview();
  }

  function toggle(id: OptionId) {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
    clearPreview();
  }

  async function api(body: Record<string, unknown>): Promise<ApiResult> {
    const response = await fetch("/api/global-reset", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret.trim()}`,
      },
      body: JSON.stringify(body),
    });

    return (await response.json()) as ApiResult;
  }

  async function run(execute: boolean) {
    if (!secret.trim()) {
      setResult({ ok: false, error: "Enter CRON_SECRET first." });
      return;
    }

    if (selected.length === 0) {
      setResult({ ok: false, error: "Select at least one reset item." });
      return;
    }

    setBusy(true);
    setResult(null);

    try {
      const data = await api({
        action: execute ? "execute" : "preview",
        channelId,
        scope,
        options: selected,
        createBackup,
        confirmation: execute ? confirmation : "",
      });

      if (execute) {
        setResult(data);
        if (data.ok) {
          setPreview(null);
          setConfirmation("");
          await loadBackups();
        }
      } else {
        setPreview(data.ok ? data : null);
        setResult(data);
        setConfirmation("");
      }
    } catch (error) {
      setResult({
        ok: false,
        error:
          error instanceof Error ? error.message : String(error),
      });
    } finally {
      setBusy(false);
    }
  }

  async function loadBackups() {
    if (!secret.trim()) {
      setResult({ ok: false, error: "Enter CRON_SECRET first." });
      return;
    }

    try {
      const data = await api({ action: "list_backups" });
      setBackups(data.backups ?? []);
      if (!data.ok) setResult(data);
    } catch (error) {
      setResult({
        ok: false,
        error:
          error instanceof Error ? error.message : String(error),
      });
    }
  }

  async function restore() {
    if (!restoreKey) {
      setResult({ ok: false, error: "Choose a backup first." });
      return;
    }

    setBusy(true);

    try {
      const data = await api({
        action: "restore",
        backupKey: restoreKey,
        confirmation: restoreConfirmation,
      });

      setResult(data);

      if (data.ok) {
        setRestoreConfirmation("");
      }
    } catch (error) {
      setResult({
        ok: false,
        error:
          error instanceof Error ? error.message : String(error),
      });
    } finally {
      setBusy(false);
    }
  }

  const requiredConfirmation =
    preview?.plan?.confirmation ?? "Preview first";

  return (
    <>
      <Head>
        <title>Sol&apos;s RNG Global Reset</title>
      </Head>

      <main style={pageStyle}>
        <section style={panelStyle}>
          <div style={eyebrowStyle}>SOL&apos;S RNG ADMIN</div>
          <h1 style={{ margin: "8px 0" }}>
            Global Redis Reset Dashboard
          </h1>

          <p style={mutedStyle}>
            Clear shared history, all viewers, channel systems, global
            progression, or the entire Redis database. CRON_SECRET,
            preview and exact confirmation are mandatory.
          </p>

          <div style={warningStyle}>
            Recovery backup is enabled by default. Keep it enabled
            unless you intentionally need an unrecoverable wipe.
          </div>

          <div style={gridStyle}>
            <Field
              label="CRON_SECRET"
              value={secret}
              setValue={setSecret}
              type="password"
              placeholder="Sent as Authorization: Bearer"
            />

            <Field
              label="Channel ID"
              value={channelId}
              setValue={(value) => {
                setChannelId(value.replace(/[^a-zA-Z0-9_-]/g, ""));
                clearPreview();
              }}
              placeholder="904797805"
            />

            <div>
              <label style={labelStyle}>Scope</label>
              <select
                value={scope}
                onChange={(event) => {
                  setScope(event.target.value as Scope);
                  clearPreview();
                }}
                style={inputStyle}
              >
                <option value="channel">
                  Selected channel only
                </option>
                <option value="all">
                  All channels / whole app
                </option>
              </select>
            </div>
          </div>

          <label style={backupStyle}>
            <input
              type="checkbox"
              checked={createBackup}
              onChange={(event) =>
                setCreateBackup(event.target.checked)
              }
              style={{ width: 18, height: 18 }}
            />
            <span>
              <strong>Create a recovery snapshot before reset</strong>
              <span style={descriptionStyle}>
                Uses your spare Redis storage. The snapshot can be
                restored from this page.
              </span>
            </span>
          </label>

          <div style={toolbarStyle}>
            <button
              style={secondaryButtonStyle}
              onClick={() => setSelection(historyIds)}
            >
              Select Firsts + Recents History
            </button>

            <button
              style={secondaryButtonStyle}
              onClick={() => setSelection(channelResetIds)}
            >
              Select Full Channel Reset
            </button>

            <button
              style={secondaryButtonStyle}
              onClick={() =>
                setSelection(
                  allIds.filter(
                    (id) =>
                      id !== "entire_database" &&
                      id !== "saved_reset_backups"
                  )
                )
              }
            >
              Select Full Known App Reset
            </button>

            <button
              style={nuclearSelectStyle}
              onClick={() => setSelection(["entire_database"])}
            >
              Select Nuclear Database Wipe
            </button>

            <button
              style={secondaryButtonStyle}
              onClick={() => setSelection([])}
            >
              Clear
            </button>

            <span style={selectionStyle}>
              {selected.length}/{allIds.length}
            </span>
          </div>

          {GROUPS.map((group) => (
            <section key={group.title} style={groupStyle}>
              <h2 style={{ marginTop: 0 }}>{group.title}</h2>

              <div style={optionGridStyle}>
                {group.ids.map(([id, title, description]) => {
                  const checked = selected.includes(id);
                  const nuclear = id === "entire_database";

                  return (
                    <label
                      key={id}
                      style={{
                        ...optionStyle,
                        borderColor: checked
                          ? nuclear
                            ? "#ff6f82"
                            : "#7f91ff"
                          : "#30395f",
                        background: checked
                          ? nuclear
                            ? "rgba(145,34,52,.27)"
                            : "rgba(69,86,181,.23)"
                          : "rgba(12,16,34,.72)",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(id)}
                        style={{ width: 18, height: 18 }}
                      />

                      <span>
                        <strong>{title}</strong>
                        <span style={descriptionStyle}>
                          {description}
                        </span>
                        <code style={codeStyle}>{id}</code>
                      </span>
                    </label>
                  );
                })}
              </div>
            </section>
          ))}

          <button
            style={previewButtonStyle}
            disabled={busy}
            onClick={() => run(false)}
          >
            {busy ? "Working..." : "Preview Global Reset"}
          </button>

          {preview?.ok && preview.plan && (
            <section style={previewStyle}>
              <h2 style={{ marginTop: 0 }}>Preview</h2>

              <p>
                Scope: <strong>{preview.plan.scope}</strong> |
                Matched keys:{" "}
                <strong>{preview.plan.matchedKeyCount}</strong> |
                Firsts mutations:{" "}
                <strong>{preview.plan.mutations.length}</strong> |
                Nuclear:{" "}
                <strong>
                  {preview.plan.nuclear ? "YES" : "No"}
                </strong>
              </p>

              <details open>
                <summary style={summaryStyle}>
                  Redis keys selected for deletion
                </summary>
                <pre style={preStyle}>
                  {preview.plan.deleteKeys.join("\n") ||
                    "No full-key deletions."}
                </pre>
              </details>

              <details>
                <summary style={summaryStyle}>
                  Field-level firsts cleanup
                </summary>
                <pre style={preStyle}>
                  {preview.plan.mutations
                    .map(
                      (item) =>
                        `${item.description}\n${item.key} | ${item.currentEntries} entries`
                    )
                    .join("\n\n") || "No field-level cleanup."}
                </pre>
              </details>

              <label style={labelStyle}>
                Type exactly:{" "}
                <code>{requiredConfirmation}</code>
              </label>

              <input
                value={confirmation}
                onChange={(event) =>
                  setConfirmation(event.target.value)
                }
                style={inputStyle}
                placeholder={requiredConfirmation}
                autoComplete="off"
              />

              <button
                style={{
                  ...executeButtonStyle,
                  opacity:
                    confirmation === requiredConfirmation && !busy
                      ? 1
                      : 0.52,
                }}
                disabled={
                  confirmation !== requiredConfirmation || busy
                }
                onClick={() => run(true)}
              >
                Permanently Execute Global Reset
              </button>
            </section>
          )}

          <section style={backupPanelStyle}>
            <div style={backupHeaderStyle}>
              <div>
                <h2 style={{ margin: 0 }}>Recovery snapshots</h2>
                <p style={{ ...mutedStyle, marginBottom: 0 }}>
                  Restore overwrites the keys stored in the snapshot.
                  It does not delete unrelated newer keys.
                </p>
              </div>

              <button
                style={secondaryButtonStyle}
                onClick={loadBackups}
              >
                Load Backups
              </button>
            </div>

            <select
              value={restoreKey}
              onChange={(event) => {
                setRestoreKey(event.target.value);
                setRestoreConfirmation("");
              }}
              style={inputStyle}
            >
              <option value="">Choose a backup</option>
              {(backups ?? []).map((backup) => (
                <option key={backup.key} value={backup.key}>
                  {new Date(backup.createdAt).toLocaleString()} —{" "}
                  {backup.scope} — {backup.sourceKeyCount} keys
                </option>
              ))}
            </select>

            {restoreKey && (
              <>
                <label style={labelStyle}>
                  Type exactly:{" "}
                  <code>RESTORE {restoreKey}</code>
                </label>

                <input
                  value={restoreConfirmation}
                  onChange={(event) =>
                    setRestoreConfirmation(event.target.value)
                  }
                  style={inputStyle}
                  placeholder={`RESTORE ${restoreKey}`}
                />

                <button
                  style={{
                    ...restoreButtonStyle,
                    opacity:
                      restoreConfirmation ===
                      `RESTORE ${restoreKey}`
                        ? 1
                        : 0.52,
                  }}
                  disabled={
                    restoreConfirmation !==
                      `RESTORE ${restoreKey}` || busy
                  }
                  onClick={restore}
                >
                  Restore Selected Snapshot
                </button>
              </>
            )}
          </section>

          {result && (
            <pre
              style={{
                ...resultStyle,
                color: result.ok ? "#baffcf" : "#ffb7c2",
              }}
            >
              {JSON.stringify(result, null, 2)}
            </pre>
          )}
        </section>
      </main>
    </>
  );
}

function Field(props: {
  label: string;
  value: string;
  setValue: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label style={labelStyle}>{props.label}</label>
      <input
        type={props.type ?? "text"}
        value={props.value}
        onChange={(event) => props.setValue(event.target.value)}
        placeholder={props.placeholder}
        style={inputStyle}
        autoComplete="off"
      />
    </div>
  );
}

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  padding: 24,
  color: "#f5f7ff",
  background:
    "radial-gradient(circle at top, rgba(72,81,180,.34), transparent 34%), #070914",
  fontFamily:
    "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
};

const panelStyle: CSSProperties = {
  maxWidth: 1180,
  margin: "0 auto",
  padding: 24,
  border: "1px solid #35406f",
  borderRadius: 22,
  background: "rgba(11,15,31,.95)",
  boxShadow: "0 24px 90px rgba(0,0,0,.42)",
};

const eyebrowStyle: CSSProperties = {
  color: "#aeb9ff",
  fontWeight: 900,
  letterSpacing: 1.2,
};

const mutedStyle: CSSProperties = {
  color: "#c7cde2",
  lineHeight: 1.55,
};

const warningStyle: CSSProperties = {
  margin: "18px 0",
  padding: 14,
  border: "1px solid #8b5560",
  borderRadius: 13,
  color: "#ffd5db",
  background: "rgba(117,44,58,.2)",
};

const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
  gap: 14,
};

const labelStyle: CSSProperties = {
  display: "block",
  margin: "13px 0 6px",
  fontWeight: 800,
  color: "#dce1f5",
};

const inputStyle: CSSProperties = {
  boxSizing: "border-box",
  width: "100%",
  padding: 12,
  border: "1px solid #4c588d",
  borderRadius: 11,
  color: "#fff",
  background: "#060812",
  fontSize: 15,
};

const backupStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 10,
  marginTop: 18,
  padding: 14,
  border: "1px solid #4b659d",
  borderRadius: 13,
  background: "rgba(33,59,103,.24)",
};

const toolbarStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: 10,
  margin: "21px 0",
};

const secondaryButtonStyle: CSSProperties = {
  padding: "10px 13px",
  border: "1px solid #4c5c9e",
  borderRadius: 10,
  color: "#fff",
  background: "#202b61",
  cursor: "pointer",
  fontWeight: 800,
};

const nuclearSelectStyle: CSSProperties = {
  padding: "10px 13px",
  border: "1px solid #d05c71",
  borderRadius: 10,
  color: "#fff",
  background: "#7d2638",
  cursor: "pointer",
  fontWeight: 900,
};

const selectionStyle: CSSProperties = {
  marginLeft: "auto",
  color: "#cbd3ff",
  fontWeight: 900,
};

const groupStyle: CSSProperties = {
  marginTop: 18,
  padding: 16,
  border: "1px solid #2f385f",
  borderRadius: 16,
  background: "rgba(8,11,24,.64)",
};

const optionGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(285px, 1fr))",
  gap: 10,
};

const optionStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 10,
  padding: 13,
  border: "1px solid",
  borderRadius: 13,
  cursor: "pointer",
};

const descriptionStyle: CSSProperties = {
  display: "block",
  marginTop: 5,
  color: "#bdc5dc",
  fontSize: 13,
  lineHeight: 1.4,
};

const codeStyle: CSSProperties = {
  display: "inline-block",
  marginTop: 7,
  color: "#9eabef",
  fontSize: 11,
};

const previewButtonStyle: CSSProperties = {
  width: "100%",
  marginTop: 20,
  padding: 14,
  border: "1px solid #6375ca",
  borderRadius: 13,
  color: "#fff",
  background: "linear-gradient(180deg, #34479e, #253273)",
  cursor: "pointer",
  fontWeight: 900,
};

const executeButtonStyle: CSSProperties = {
  width: "100%",
  marginTop: 14,
  padding: 14,
  border: "1px solid #d45c6f",
  borderRadius: 13,
  color: "#fff",
  background: "linear-gradient(180deg, #a13247, #711f31)",
  cursor: "pointer",
  fontWeight: 900,
};

const restoreButtonStyle: CSSProperties = {
  width: "100%",
  marginTop: 14,
  padding: 13,
  border: "1px solid #5fbc81",
  borderRadius: 12,
  color: "#fff",
  background: "#23613a",
  cursor: "pointer",
  fontWeight: 900,
};

const previewStyle: CSSProperties = {
  marginTop: 20,
  padding: 18,
  border: "1px solid #596ab1",
  borderRadius: 15,
  background: "rgba(23,30,65,.72)",
};

const summaryStyle: CSSProperties = {
  marginTop: 10,
  cursor: "pointer",
  fontWeight: 800,
};

const preStyle: CSSProperties = {
  maxHeight: 330,
  overflow: "auto",
  padding: 12,
  borderRadius: 10,
  color: "#c9ffd8",
  background: "#050710",
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
};

const backupPanelStyle: CSSProperties = {
  marginTop: 22,
  padding: 18,
  border: "1px solid #3d6c53",
  borderRadius: 15,
  background: "rgba(20,60,38,.18)",
};

const backupHeaderStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "space-between",
  gap: 12,
  marginBottom: 14,
};

const resultStyle: CSSProperties = {
  marginTop: 18,
  maxHeight: 440,
  overflow: "auto",
  padding: 14,
  border: "1px solid #343f70",
  borderRadius: 12,
  background: "#050710",
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
};

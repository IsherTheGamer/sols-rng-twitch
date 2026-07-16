import Head from "next/head";
import { useMemo, useState } from "react";
import type { CSSProperties } from "react";

const GROUPS = [
  {
    title: "Profile",
    description: "Each stored profile field can be reset independently.",
    items: [
      ["profile_rolls", "Normal rolls", "Only the standard !roll counter."],
      ["profile_token_rolls", "Token/potion rolls", "Token and legacy potion-roll counters."],
      ["profile_rarity_total", "Total rarity value", "Accumulated rarity value used by value leaderboards."],
      ["profile_xp", "XP", "Set XP to 0 without touching other fields."],
      ["profile_level", "Level", "Set displayed level to 1."],
      ["profile_weekly_xp", "Weekly XP counters", "Reset weekly tier caps/counts."],
      ["profile_level_rewards", "Claimed level rewards", "Allow level rewards to be claimed again."],
      ["profile_dev_xp_auras", "DEV XP aura tracking", "Forget DEV-exclusive XP aura history."],
      ["profile_owned_tiers", "Owned tier counts", "Reset tier ownership counters."],
      ["profile_highest_tier", "Highest tier", "Reset highest tier and rank."],
      ["profile_best_aura", "Best normal aura", "Clear the best standard roll."],
      ["profile_best_token", "Best token aura", "Clear best token/potion result."],
      ["profile_index", "Profile index entry", "Remove from username lookup and standard leaderboards."],
    ],
  },
  {
    title: "Inventory",
    description: "Token inventory and queued effects.",
    items: [
      ["inventory_tokens", "Stored tokens", "Delete owned roll and potion tokens."],
      ["inventory_active_buffs", "Active/queued token buffs", "Delete active timed and consume-on-roll effects."],
      ["inventory_pending_grants", "Pending grants", "Delete username-based admin/reward grants."],
    ],
  },
  {
    title: "Core, SHD and crafting",
    description: "Every Core-system section is separate.",
    items: [
      ["core_tier", "Core tier", "Reset to Core 0."],
      ["core_path_focus", "Core path and focus", "Reset to universal/main."],
      ["core_shd_level", "SHD level", "Reset SHD to uncrafted."],
      ["core_stardust", "Stardust", "Set stored Stardust to 0."],
      ["core_wall_seed", "Wall seed", "Generate a fresh wall seed."],
      ["core_materials", "Materials", "Delete all Core materials."],
      ["core_components", "Components", "Delete all crafted components."],
      ["core_frames", "Frames/chassis", "Delete frame storage."],
      ["core_subcores", "Sub-Cores", "Delete Sub-Cores and active selection."],
      ["core_reactor", "Stardust Reactor", "Reset level and deposit."],
      ["core_tokens", "Core crafting tokens", "Delete recipe/path/reactor/etc. tokens."],
      ["core_lootboxes", "Loot boxes", "Delete unopened boxes."],
      ["core_quest_progress", "Core quest progress", "Reset objective counters."],
      ["core_quest_claims", "Core quest claims", "Forget claimed Core quests."],
      ["core_achievements", "Achievement claims", "Forget claimed achievements."],
      ["core_unlocks", "Core unlock flags", "Reset feature unlocks."],
      ["core_stats", "Core statistics", "Reset crafting, rarity, box and reactor stats."],
      ["core_jobs", "Active jobs", "Delete active crafting/Core jobs."],
    ],
  },
  {
    title: "Knowledge, research and relics",
    description: "Activity of Knowledge player data.",
    items: [
      ["knowledge_currency", "Knowledge", "Set Knowledge to 0."],
      ["knowledge_merchant_marks", "Merchant Marks", "Set Marks to 0."],
      ["knowledge_relic_shards", "Relic Shards", "Set shards to 0."],
      ["knowledge_blueprint_fragments", "Blueprint Fragments", "Set fragments to 0."],
      ["knowledge_scanner", "Scanner level", "Reset Scanner to 0."],
      ["knowledge_research", "Research tree", "Lock all research again."],
      ["knowledge_blueprints", "Blueprint ownership", "Delete owned blueprints."],
      ["knowledge_relics", "Relics", "Delete owned/equipped relics."],
      ["knowledge_stats", "Knowledge statistics", "Reset boss, event and relic stats."],
      ["knowledge_boss_participation", "Active boss participation", "Remove damage entry from the current boss."],
    ],
  },
  {
    title: "Social, quests and history",
    description: "Shared objects are edited surgically; other viewers remain untouched.",
    items: [
      ["social_titles", "Titles", "Delete owned/equipped titles."],
      ["social_recent_pulls", "Recent pulls", "Remove entries from !recent."],
      ["social_flex", "Flex challenge", "Cancel the active challenge if involved."],
      ["quest_period_claims", "Period quest claims", "Delete personal/global daily-weekly-monthly-yearly claim keys."],
      ["quest_npc_claims", "NPC quest claims", "Remove this player's claimed-by markers."],
      ["mega_luck_history", "Best-luck history", "Delete stored best luck/aura history."],
      ["leaderboard_channel_periods", "Channel period leaderboards", "Remove user rows from daily/weekly/monthly/yearly tables."],
      ["leaderboard_global_periods", "Global period leaderboards", "Remove cross-channel user rows."],
      ["records_replay", "Rare replay history", "Remove entries shown by !replay."],
      ["records_slots", "Channel record slots", "Clear record slots currently owned by the player."],
      ["records_first_aura_discoveries", "!first / !firsts aura discoveries", "Remove player-owned aura first discoveries. Biome firsts are channel-owned and preserved."],
      ["player_cooldowns", "Cooldowns", "Delete player-specific command cooldowns."],
      ["roll_access", "10k roll access", "Remove from the dynamic allowlist."],
      ["other_exact_player_keys", "Other exact player keys", "Catch additional keys containing the channel ID and exact numeric user ID."],
    ],
  },
] as const;

type ResetOption = (typeof GROUPS)[number]["items"][number][0];

interface ApiResult {
  ok?: boolean;
  preview?: boolean;
  error?: string;
  message?: string;
  plan?: {
    target?: {
      channelId: string;
      username: string;
      userId: string;
      displayName: string;
    };
    options?: string[];
    fullPlayerReset?: boolean;
    items?: Array<{
      option: string;
      kind: string;
      key: string;
      matches: number;
      description: string;
    }>;
    notes?: string[];
  };
  totals?: {
    selectedItems: number;
    currentlyMatchedEntries: number;
  };
  selectedItems?: number;
  fullPlayerReset?: boolean;
  writes?: number;
  deletedKeys?: number;
  sharedChanges?: number;
  notes?: string[];
}

export default function PlayerResetPage() {
  const allOptions = useMemo(
    () =>
      GROUPS.flatMap((group) =>
        group.items.map((item) => item[0])
      ) as ResetOption[],
    []
  );

  const [secret, setSecret] = useState("");
  const [channelId, setChannelId] = useState("904797805");
  const [username, setUsername] = useState("");
  const [userId, setUserId] = useState("");
  const [selected, setSelected] = useState<ResetOption[]>([]);
  const [confirmation, setConfirmation] = useState("");
  const [preview, setPreview] = useState<ApiResult | null>(null);
  const [result, setResult] = useState<ApiResult | null>(null);
  const [busy, setBusy] = useState(false);

  const resolvedUsername =
    preview?.plan?.target?.username ||
    username.trim().toLowerCase().replace(/^@+/, "");

  const expectedConfirmation = resolvedUsername
    ? `RESET ${resolvedUsername}`
    : "RESET username";

  function clearPreview() {
    setPreview(null);
    setResult(null);
    setConfirmation("");
  }

  function toggle(option: ResetOption) {
    setSelected((current) =>
      current.includes(option)
        ? current.filter((item) => item !== option)
        : [...current, option]
    );
    clearPreview();
  }

  function selectGroup(options: readonly (readonly [ResetOption, string, string])[]) {
    const ids = options.map((item) => item[0]);
    setSelected((current) => [...new Set([...current, ...ids])]);
    clearPreview();
  }

  function clearGroup(options: readonly (readonly [ResetOption, string, string])[]) {
    const ids = new Set(options.map((item) => item[0]));
    setSelected((current) => current.filter((item) => !ids.has(item)));
    clearPreview();
  }

  async function callApi(execute: boolean) {
    if (!secret.trim()) {
      setResult({ ok: false, error: "Enter CRON_SECRET first." });
      return;
    }

    if (!username.trim() && !userId.trim()) {
      setResult({
        ok: false,
        error: "Enter a Twitch username or numeric user ID.",
      });
      return;
    }

    if (selected.length === 0) {
      setResult({
        ok: false,
        error: "Select at least one reset item.",
      });
      return;
    }

    setBusy(true);
    setResult(null);

    try {
      const response = await fetch("/api/player-reset", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${secret.trim()}`,
        },
        body: JSON.stringify({
          channelId,
          username,
          userId,
          options: selected,
          preview: !execute,
          confirmation: execute ? confirmation : "",
        }),
      });

      const data = (await response.json()) as ApiResult;

      if (execute) {
        setResult(data);

        if (data.ok) {
          setPreview(null);
          setConfirmation("");
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

  return (
    <>
      <Head>
        <title>Sol&apos;s RNG Granular Player Reset</title>
      </Head>

      <main style={pageStyle}>
        <section style={panelStyle}>
          <div style={eyebrowStyle}>SOL&apos;S RNG ADMIN</div>
          <h1 style={{ margin: "8px 0" }}>
            Granular Single-Player Reset
          </h1>

          <p style={mutedStyle}>
            Every player-owned field is selectable separately. A Full
            Player Reset selects every switch and deletes complete
            player objects where possible.
          </p>

          <div style={warningStyle}>
            Protected by CRON_SECRET. Preview is required, followed by
            an exact confirmation phrase.
          </div>

          <div style={gridStyle}>
            <Field
              label="CRON_SECRET"
              value={secret}
              setValue={setSecret}
              type="password"
              placeholder="Sent as a Bearer header"
            />
            <Field
              label="Channel ID"
              value={channelId}
              setValue={(value) =>
                setChannelId(value.replace(/\D/g, ""))
              }
              placeholder="904797805"
            />
            <Field
              label="Twitch username"
              value={username}
              setValue={(value) => {
                setUsername(value);
                clearPreview();
              }}
              placeholder="viewer_name"
            />
            <Field
              label="Twitch numeric user ID"
              value={userId}
              setValue={(value) => {
                setUserId(value.replace(/\D/g, ""));
                clearPreview();
              }}
              placeholder="Strongly recommended"
            />
          </div>

          <div style={toolbarStyle}>
            <button
              style={dangerSelectStyle}
              onClick={() => {
                setSelected(allOptions);
                clearPreview();
              }}
            >
              Select Full Player Reset ({allOptions.length})
            </button>

            <button
              style={secondaryButtonStyle}
              onClick={() => {
                setSelected([]);
                clearPreview();
              }}
            >
              Clear Everything
            </button>

            <span style={selectionStyle}>
              {selected.length}/{allOptions.length} selected
            </span>
          </div>

          {GROUPS.map((group) => (
            <section key={group.title} style={groupStyle}>
              <div style={groupHeaderStyle}>
                <div>
                  <h2 style={{ margin: 0 }}>{group.title}</h2>
                  <p style={{ ...mutedStyle, margin: "5px 0 0" }}>
                    {group.description}
                  </p>
                </div>

                <div style={miniToolbarStyle}>
                  <button
                    style={miniButtonStyle}
                    onClick={() => selectGroup(group.items)}
                  >
                    Select group
                  </button>
                  <button
                    style={miniButtonStyle}
                    onClick={() => clearGroup(group.items)}
                  >
                    Clear group
                  </button>
                </div>
              </div>

              <div style={optionGridStyle}>
                {group.items.map(([id, title, description]) => {
                  const checked = selected.includes(id);

                  return (
                    <label
                      key={id}
                      style={{
                        ...optionStyle,
                        borderColor: checked
                          ? "#7f91ff"
                          : "#30395f",
                        background: checked
                          ? "rgba(69,86,181,.23)"
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
            onClick={() => callApi(false)}
          >
            {busy ? "Working..." : "Preview Selected Reset"}
          </button>

          {preview?.ok && (
            <section style={previewStyle}>
              <h2 style={{ marginTop: 0 }}>Preview</h2>

              <p>
                Target:{" "}
                <strong>
                  {preview.plan?.target?.displayName} (
                  {preview.plan?.target?.userId})
                </strong>
              </p>

              <p>
                Selected:{" "}
                <strong>
                  {preview.totals?.selectedItems ?? 0}
                </strong>{" "}
                | Existing shared matches:{" "}
                <strong>
                  {preview.totals?.currentlyMatchedEntries ?? 0}
                </strong>{" "}
                | Full reset:{" "}
                <strong>
                  {preview.plan?.fullPlayerReset ? "YES" : "No"}
                </strong>
              </p>

              <details open>
                <summary style={summaryStyle}>
                  Selected operations
                </summary>
                <pre style={preStyle}>
                  {(preview.plan?.items ?? [])
                    .map(
                      (item) =>
                        `${item.option}\n  ${item.description}\n  ${item.key}${item.matches ? ` | matches ${item.matches}` : ""}`
                    )
                    .join("\n\n")}
                </pre>
              </details>

              <details>
                <summary style={summaryStyle}>Safety notes</summary>
                <pre style={preStyle}>
                  {(preview.plan?.notes ?? []).join("\n")}
                </pre>
              </details>

              <label style={labelStyle}>
                Type exactly:{" "}
                <code>{expectedConfirmation}</code>
              </label>

              <input
                value={confirmation}
                onChange={(event) =>
                  setConfirmation(event.target.value)
                }
                style={inputStyle}
                placeholder={expectedConfirmation}
                autoComplete="off"
              />

              <button
                style={{
                  ...executeButtonStyle,
                  opacity:
                    confirmation === expectedConfirmation && !busy
                      ? 1
                      : 0.52,
                }}
                disabled={
                  confirmation !== expectedConfirmation || busy
                }
                onClick={() => callApi(true)}
              >
                Permanently Execute Selected Reset
              </button>
            </section>
          )}

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

const toolbarStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: 10,
  margin: "21px 0",
};

const dangerSelectStyle: CSSProperties = {
  padding: "11px 15px",
  border: "1px solid #cc6072",
  borderRadius: 11,
  color: "#fff",
  background: "#7b2839",
  cursor: "pointer",
  fontWeight: 900,
};

const secondaryButtonStyle: CSSProperties = {
  padding: "11px 15px",
  border: "1px solid #4c5c9e",
  borderRadius: 11,
  color: "#fff",
  background: "#202b61",
  cursor: "pointer",
  fontWeight: 800,
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

const groupHeaderStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "space-between",
  gap: 12,
  marginBottom: 13,
};

const miniToolbarStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  alignItems: "center",
};

const miniButtonStyle: CSSProperties = {
  padding: "8px 10px",
  border: "1px solid #48578f",
  borderRadius: 9,
  color: "#fff",
  background: "#1b2554",
  cursor: "pointer",
  fontWeight: 800,
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

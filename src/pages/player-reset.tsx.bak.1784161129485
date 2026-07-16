import Head from "next/head";
import { useMemo, useState } from "react";
import type { CSSProperties } from "react";

const CATEGORY_OPTIONS = [
  {
    id: "profile",
    title: "Profile, rolls, XP & level",
    description:
      "Roll totals, rarity value, best auras, tiers, XP, level rewards, and profile leaderboard registration.",
  },
  {
    id: "inventory",
    title: "Inventory, tokens & active buffs",
    description:
      "Token inventory, active effects, pending token grants, and potion-token state.",
  },
  {
    id: "core",
    title: "Core, SHD, crafting & materials",
    description:
      "Core tier/path, Stardust, SHD, reactor, materials, components, boxes, Core quests, and achievements.",
  },
  {
    id: "knowledge",
    title: "Knowledge, research, relics & blueprints",
    description:
      "Knowledge currencies, research tree, scanner, relics, blueprint unlocks, and personal boss statistics.",
  },
  {
    id: "social",
    title: "Titles, recent pulls & flex activity",
    description:
      "Owned/equipped titles, recent rare pulls, and active flex challenge involvement.",
  },
  {
    id: "quests",
    title: "Quest claims & luck history",
    description:
      "Personal/global period claim markers, NPC claim history, and stored luck-history records.",
  },
  {
    id: "leaderboards",
    title: "Period leaderboards",
    description:
      "Removes the player from daily, weekly, monthly, yearly, and cross-channel period tables.",
  },
  {
    id: "records",
    title: "Replay, records & first discoveries",
    description:
      "Rare-pull replay history, record slots, and aura first-discovery ownership.",
  },
  {
    id: "cooldowns",
    title: "Cooldowns",
    description:
      "Player-specific roll and command cooldown keys for the selected channel.",
  },
  {
    id: "access",
    title: "10k roll allowlist",
    description:
      "Removes the username from the Redis-backed 10,000-roll allowlist.",
  },
  {
    id: "other",
    title: "Other exact player keys",
    description:
      "Catches additional player-owned Redis keys containing both this channel ID and exact user ID. Shared keys are excluded.",
  },
] as const;

type CategoryId = (typeof CATEGORY_OPTIONS)[number]["id"];

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
    deleteKeys?: string[];
    mutations?: Array<{
      kind: string;
      key: string;
      matches: number;
      description: string;
    }>;
    notes?: string[];
  };
  totals?: {
    directKeys: number;
    sharedMutations: number;
    sharedEntries: number;
  };
  deletedKeys?: number;
  sharedMutations?: number;
  sharedEntriesRemoved?: number;
  categories?: string[];
  notes?: string[];
}

export default function PlayerResetPage() {
  const allCategories = useMemo(
    () => CATEGORY_OPTIONS.map((category) => category.id),
    []
  );

  const [secret, setSecret] = useState("");
  const [channelId, setChannelId] = useState("904797805");
  const [username, setUsername] = useState("");
  const [userId, setUserId] = useState("");
  const [selected, setSelected] =
    useState<CategoryId[]>(allCategories);
  const [confirmation, setConfirmation] = useState("");
  const [preview, setPreview] = useState<ApiResult | null>(null);
  const [result, setResult] = useState<ApiResult | null>(null);
  const [busy, setBusy] = useState(false);

  const resolvedUsername =
    preview?.plan?.target?.username || username.trim().toLowerCase();

  const expectedConfirmation = resolvedUsername
    ? `RESET ${resolvedUsername}`
    : "RESET username";

  function toggleCategory(id: CategoryId) {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id]
    );
    setPreview(null);
    setResult(null);
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
        error: "Select at least one reset category.",
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
          categories: selected,
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
        <title>Sol&apos;s RNG Player Data Reset</title>
      </Head>

      <main style={pageStyle}>
        <section style={panelStyle}>
          <div style={eyebrowStyle}>SOL&apos;S RNG ADMIN</div>
          <h1 style={{ margin: "8px 0" }}>
            Single-Player Data Reset
          </h1>
          <p style={mutedStyle}>
            Reset one viewer without deleting the channel, other
            viewers, global rolls, biome/event state, server boosts, or
            Discord settings.
          </p>

          <div style={warningStyle}>
            Destructive action. Preview first, verify the resolved
            Twitch ID and affected keys, then type the confirmation
            phrase.
          </div>

          <div style={gridStyle}>
            <Field
              label="CRON_SECRET"
              value={secret}
              setValue={setSecret}
              type="password"
              placeholder="Kept in this page only"
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
                setPreview(null);
              }}
              placeholder="viewer_name"
            />
            <Field
              label="Twitch numeric user ID"
              value={userId}
              setValue={(value) => {
                setUserId(value.replace(/\D/g, ""));
                setPreview(null);
              }}
              placeholder="Recommended for perfect accuracy"
            />
          </div>

          <div style={toolbarStyle}>
            <button
              style={secondaryButtonStyle}
              onClick={() => {
                setSelected(allCategories);
                setPreview(null);
              }}
            >
              Select Full Player Reset
            </button>
            <button
              style={secondaryButtonStyle}
              onClick={() => {
                setSelected([]);
                setPreview(null);
              }}
            >
              Clear Selection
            </button>
          </div>

          <div style={categoryGridStyle}>
            {CATEGORY_OPTIONS.map((category) => {
              const checked = selected.includes(category.id);

              return (
                <label
                  key={category.id}
                  style={{
                    ...categoryStyle,
                    borderColor: checked ? "#7588ff" : "#30395f",
                    background: checked
                      ? "rgba(71,88,180,.22)"
                      : "rgba(13,17,36,.76)",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleCategory(category.id)}
                    style={{ width: 18, height: 18 }}
                  />
                  <span>
                    <strong>{category.title}</strong>
                    <span style={categoryDescriptionStyle}>
                      {category.description}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>

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
                Direct keys:{" "}
                <strong>{preview.totals?.directKeys ?? 0}</strong> |
                Shared structures:{" "}
                <strong>
                  {preview.totals?.sharedMutations ?? 0}
                </strong>{" "}
                | Matching shared entries:{" "}
                <strong>
                  {preview.totals?.sharedEntries ?? 0}
                </strong>
              </p>

              <details>
                <summary style={summaryStyle}>
                  Direct Redis keys
                </summary>
                <pre style={preStyle}>
                  {(preview.plan?.deleteKeys ?? []).join("\n") ||
                    "No direct keys currently exist."}
                </pre>
              </details>

              <details>
                <summary style={summaryStyle}>
                  Shared-data cleanup
                </summary>
                <pre style={preStyle}>
                  {(preview.plan?.mutations ?? [])
                    .map(
                      (item) =>
                        `${item.description}\n  ${item.key} (${item.matches})`
                    )
                    .join("\n\n") ||
                    "No matching shared entries."}
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
                  ...dangerButtonStyle,
                  opacity:
                    confirmation === expectedConfirmation && !busy
                      ? 1
                      : 0.55,
                }}
                disabled={
                  confirmation !== expectedConfirmation || busy
                }
                onClick={() => callApi(true)}
              >
                Permanently Reset Selected Player Data
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
    "radial-gradient(circle at top, rgba(72,81,180,.34), transparent 35%), #070914",
  fontFamily:
    "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
};

const panelStyle: CSSProperties = {
  maxWidth: 1040,
  margin: "0 auto",
  padding: 24,
  border: "1px solid #35406f",
  borderRadius: 22,
  background: "rgba(11,15,31,.94)",
  boxShadow: "0 24px 90px rgba(0,0,0,.42)",
};

const eyebrowStyle: CSSProperties = {
  color: "#aeb9ff",
  fontWeight: 900,
  letterSpacing: 1.2,
};

const mutedStyle: CSSProperties = {
  color: "#c7cde2",
  lineHeight: 1.6,
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
  gap: 10,
  margin: "20px 0 12px",
};

const categoryGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))",
  gap: 11,
};

const categoryStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 11,
  padding: 14,
  border: "1px solid",
  borderRadius: 14,
  cursor: "pointer",
};

const categoryDescriptionStyle: CSSProperties = {
  display: "block",
  marginTop: 5,
  color: "#bfc6dc",
  fontSize: 13,
  lineHeight: 1.45,
};

const secondaryButtonStyle: CSSProperties = {
  padding: "10px 14px",
  border: "1px solid #4c5c9e",
  borderRadius: 11,
  color: "#fff",
  background: "#202b61",
  cursor: "pointer",
  fontWeight: 800,
};

const previewButtonStyle: CSSProperties = {
  width: "100%",
  marginTop: 18,
  padding: 14,
  border: "1px solid #6375ca",
  borderRadius: 13,
  color: "#fff",
  background: "linear-gradient(180deg, #34479e, #253273)",
  cursor: "pointer",
  fontWeight: 900,
};

const dangerButtonStyle: CSSProperties = {
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
  maxHeight: 260,
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

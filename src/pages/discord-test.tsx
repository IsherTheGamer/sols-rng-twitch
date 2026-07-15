import Head from "next/head";
import { useMemo, useState } from "react";
import type { CSSProperties } from "react";

export default function DiscordTestPage() {
  const [token, setToken] = useState("");
  const [channel, setChannel] = useState("zipittt");
  const [channelId, setChannelId] = useState("904797805");
  const [player, setPlayer] = useState("isherthegamer");
  const [aura, setAura] = useState("Sovereign");
  const [rarity, setRarity] = useState("750000000");
  const [tier, setTier] = useState("Glorious");
  const [source, setSource] = useState("roll");
  const [output, setOutput] = useState("Nothing sent yet.");
  const [busy, setBusy] = useState(false);

  const endpoint = useMemo(() => {
    const params = new URLSearchParams({
      token,
      channel,
      channelId,
      player,
      aura,
      rarity,
      tier,
      source,
    });

    return `/api/discord-aura-test?${params.toString()}`;
  }, [token, channel, channelId, player, aura, rarity, tier, source]);

  async function sendTest() {
    if (!token.trim()) {
      setOutput("Paste your CRON_SECRET first.");
      return;
    }

    setBusy(true);
    setOutput("Sending safe Discord test...");

    try {
      const response = await fetch(endpoint, { cache: "no-store" });
      setOutput(await response.text());
    } catch (error) {
      setOutput(
        `Request failed: ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Head>
        <title>Sol's RNG Discord Aura Tester</title>
      </Head>

      <main style={pageStyle}>
        <div style={{ maxWidth: 820, margin: "0 auto" }}>
          <section style={cardStyle}>
            <div style={{ color: "#a8b4ff", fontWeight: 900 }}>
              SOL&apos;S RNG ADMIN
            </div>
            <h1 style={{ margin: "8px 0" }}>Discord Aura Tester</h1>
            <p style={{ color: "#cbd1e8", lineHeight: 1.6 }}>
              Sends the real aura-alert style without rolling, consuming HP,
              using a token, changing inventory, or updating any stats. The
              embed ends with a tiny <b>Test</b> marker.
            </p>

            <label style={labelStyle}>CRON_SECRET</label>
            <input
              type="password"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              style={inputStyle}
              placeholder="Paste your cron token"
            />

            <div style={gridStyle}>
              <Field label="Twitch channel" value={channel} setValue={setChannel} />
              <Field label="Channel ID" value={channelId} setValue={setChannelId} />
              <Field label="Player" value={player} setValue={setPlayer} />
              <Field label="Aura" value={aura} setValue={setAura} />
              <Field label="Rarity" value={rarity} setValue={setRarity} />
              <Field label="Tier" value={tier} setValue={setTier} />
            </div>

            <label style={labelStyle}>Source</label>
            <select
              value={source}
              onChange={(event) => setSource(event.target.value)}
              style={inputStyle}
            >
              <option value="roll">Roll</option>
              <option value="potion">Potion</option>
              <option value="token">Token</option>
            </select>

            <button
              onClick={sendTest}
              disabled={busy}
              style={{ ...buttonStyle, opacity: busy ? 0.65 : 1 }}
            >
              {busy ? "Sending..." : "Send Fake Aura Announcement"}
            </button>

            <pre style={outputStyle}>{output}</pre>
          </section>
        </div>
      </main>
    </>
  );
}

function Field(props: {
  label: string;
  value: string;
  setValue: (value: string) => void;
}) {
  return (
    <div>
      <label style={labelStyle}>{props.label}</label>
      <input
        value={props.value}
        onChange={(event) => props.setValue(event.target.value)}
        style={inputStyle}
      />
    </div>
  );
}

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  background:
    "radial-gradient(circle at top, rgba(90,70,190,.35), transparent 34%), #070914",
  color: "#f4f6ff",
  padding: 24,
  fontFamily:
    "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
};

const cardStyle: CSSProperties = {
  border: "1px solid #343e78",
  borderRadius: 22,
  padding: 22,
  background: "rgba(12,16,34,.88)",
  boxShadow: "0 24px 80px rgba(0,0,0,.34)",
};

const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
  marginTop: 8,
};

const labelStyle: CSSProperties = {
  display: "block",
  margin: "14px 0 6px",
  fontWeight: 800,
  color: "#cdd3ed",
};

const inputStyle: CSSProperties = {
  boxSizing: "border-box",
  width: "100%",
  padding: 12,
  border: "1px solid #4a5696",
  borderRadius: 12,
  background: "#070914",
  color: "#f5f7ff",
  fontSize: 15,
};

const buttonStyle: CSSProperties = {
  width: "100%",
  marginTop: 18,
  padding: 14,
  border: "1px solid #6474c9",
  borderRadius: 14,
  background: "linear-gradient(180deg, #34459a, #202d6b)",
  color: "#fff",
  fontWeight: 900,
  cursor: "pointer",
};

const outputStyle: CSSProperties = {
  marginTop: 18,
  minHeight: 72,
  padding: 14,
  border: "1px solid #27315f",
  borderRadius: 12,
  background: "#050711",
  color: "#bfffd3",
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
};

import Head from "next/head";
import { useState } from "react";
import type { CSSProperties } from "react";

export default function RollAccessPage() {
  const [token, setToken] = useState("");
  const [username, setUsername] = useState("");
  const [output, setOutput] = useState("No request yet.");
  const [busy, setBusy] = useState(false);

  async function call(action: string) {
    if (!token.trim()) {
      setOutput("Paste CRON_SECRET first.");
      return;
    }

    setBusy(true);

    const params = new URLSearchParams({
      token,
      action,
      channelId: "904797805",
    });

    if (username.trim()) params.set("username", username.trim());

    try {
      const response = await fetch(`/api/rollaccess?${params.toString()}`, {
        cache: "no-store",
      });
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
        <title>Sol's RNG Roll Access</title>
      </Head>

      <main style={pageStyle}>
        <section style={cardStyle}>
          <h1>10k Roll Access</h1>
          <p>Phone-friendly backup for the Twitch and Discord admin commands.</p>

          <label style={labelStyle}>CRON_SECRET</label>
          <input
            type="password"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            style={inputStyle}
          />

          <label style={labelStyle}>Twitch username</label>
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            style={inputStyle}
          />

          <div style={buttonGrid}>
            {["list", "add", "remove", "check", "clear"].map((action) => (
              <button
                key={action}
                onClick={() => call(action)}
                disabled={busy}
                style={buttonStyle}
              >
                {action}
              </button>
            ))}
          </div>

          <pre style={outputStyle}>{output}</pre>
        </section>
      </main>
    </>
  );
}

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  padding: 24,
  background: "#080a15",
  color: "#f5f7ff",
  fontFamily: "Inter, system-ui, sans-serif",
};

const cardStyle: CSSProperties = {
  maxWidth: 720,
  margin: "0 auto",
  padding: 22,
  border: "1px solid #384477",
  borderRadius: 20,
  background: "#10152b",
};

const labelStyle: CSSProperties = {
  display: "block",
  margin: "14px 0 6px",
  fontWeight: 800,
};

const inputStyle: CSSProperties = {
  boxSizing: "border-box",
  width: "100%",
  padding: 12,
  border: "1px solid #4c5a94",
  borderRadius: 12,
  background: "#070914",
  color: "#fff",
};

const buttonGrid: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
  marginTop: 16,
};

const buttonStyle: CSSProperties = {
  padding: "11px 14px",
  border: "1px solid #586ab2",
  borderRadius: 11,
  background: "#26346e",
  color: "#fff",
  fontWeight: 800,
  cursor: "pointer",
};

const outputStyle: CSSProperties = {
  minHeight: 70,
  marginTop: 18,
  padding: 13,
  borderRadius: 12,
  background: "#050711",
  color: "#baffd1",
  whiteSpace: "pre-wrap",
};

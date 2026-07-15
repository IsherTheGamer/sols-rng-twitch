import Head from "next/head";
import { useState } from "react";

export default function RollAccessPage() {
  const [token, setToken] = useState("");
  const [channelId, setChannelId] = useState("904797805");
  const [username, setUsername] = useState("");
  const [output, setOutput] = useState("No request yet.");
  const [busy, setBusy] = useState(false);

  async function run(action: string) {
    if (!token.trim()) {
      setOutput("Paste your CRON_SECRET first.");
      return;
    }

    const params = new URLSearchParams({
      token: token.trim(),
      action,
      channelId: channelId.trim() || "904797805",
    });

    if (username.trim()) params.set("username", username.trim());

    setBusy(true);

    try {
      const response = await fetch(`/api/rollaccess?${params.toString()}`, {
        method: "GET",
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
        <title>10k Roll Access</title>
      </Head>

      <main
        style={{
          minHeight: "100vh",
          padding: 24,
          color: "#f5f7ff",
          background:
            "radial-gradient(circle at top, #25315b 0, #101426 40%, #070910 100%)",
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
        }}
      >
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <section style={cardStyle}>
            <div style={{ color: "#a9b7ff", fontWeight: 900 }}>SOL'S RNG ADMIN</div>
            <h1 style={{ margin: "8px 0" }}>10k Roll Allowlist</h1>
            <p style={{ color: "#cbd2ee", lineHeight: 1.6 }}>
              Managers: <b>isherthegamer</b> (932837274) and <b>zipittt</b>
              (904797805). Changes are saved instantly in Redis and require no Vercel redeploy.
            </p>
          </section>

          <section style={{ ...cardStyle, marginTop: 16 }}>
            <label style={labelStyle}>CRON_SECRET</label>
            <input
              type="password"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              placeholder="Paste your cron secret"
              style={inputStyle}
            />

            <label style={labelStyle}>Channel ID</label>
            <input
              value={channelId}
              onChange={(event) => setChannelId(event.target.value)}
              style={inputStyle}
            />

            <label style={labelStyle}>Twitch username</label>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="username"
              style={inputStyle}
            />

            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 16 }}>
              <button disabled={busy} onClick={() => run("add")} style={buttonStyle}>Add</button>
              <button disabled={busy} onClick={() => run("remove")} style={buttonStyle}>Remove</button>
              <button disabled={busy} onClick={() => run("check")} style={buttonStyle}>Check</button>
              <button disabled={busy} onClick={() => run("list")} style={buttonStyle}>List</button>
              <button disabled={busy} onClick={() => run("clear")} style={dangerButtonStyle}>Clear dynamic list</button>
            </div>
          </section>

          <section style={{ ...cardStyle, marginTop: 16 }}>
            <h2 style={{ marginTop: 0 }}>Output</h2>
            <pre
              style={{
                background: "#050711",
                border: "1px solid #2c3568",
                borderRadius: 12,
                padding: 14,
                color: "#baffd6",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {output}
            </pre>
          </section>
        </div>
      </main>
    </>
  );
}

const cardStyle: React.CSSProperties = {
  padding: 20,
  border: "1px solid #30396e",
  borderRadius: 20,
  background: "rgba(12, 16, 34, .86)",
  boxShadow: "0 18px 70px rgba(0,0,0,.25)",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  margin: "14px 0 6px",
  color: "#cbd2ee",
  fontWeight: 800,
};

const inputStyle: React.CSSProperties = {
  boxSizing: "border-box",
  width: "100%",
  padding: 13,
  color: "#f5f7ff",
  background: "#070914",
  border: "1px solid #46518f",
  borderRadius: 12,
  fontSize: 16,
};

const buttonStyle: React.CSSProperties = {
  cursor: "pointer",
  padding: "12px 15px",
  color: "#f7f8ff",
  fontWeight: 900,
  background: "linear-gradient(180deg, #26336c, #17204a)",
  border: "1px solid #5362aa",
  borderRadius: 12,
};

const dangerButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  background: "linear-gradient(180deg, #6b263d, #431627)",
  border: "1px solid #a84f6c",
};

import type { CSSProperties } from "react";
import { useMemo, useState } from "react";

export default function ChatSendPage() {
  const [token, setToken] = useState("");
  const [channel, setChannel] = useState("zipittt");
  const [msg, setMsg] = useState("");
  const [result, setResult] = useState("");
  const [sending, setSending] = useState(false);

  const urlPreview = useMemo(() => {
    const params = new URLSearchParams();
    if (token) params.set("token", token);
    if (channel) params.set("channel", channel);
    if (msg) params.set("msg", msg);
    return `/api/chat-send?${params.toString()}`;
  }, [token, channel, msg]);

  async function sendMessage() {
    setSending(true);
    setResult("");

    try {
      const response = await fetch("/api/chat-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, channel, msg }),
      });

      const body = await response.text();
      setResult(body);
    } catch (error) {
      setResult(error instanceof Error ? error.message : "Send failed.");
    } finally {
      setSending(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", background: "#080a14", color: "#eef2ff", padding: 24, fontFamily: "Inter, system-ui, Arial" }}>
      <div style={{ maxWidth: 880, margin: "0 auto" }}>
        <p style={{ color: "#93a4d8", marginBottom: 8 }}>Sols RNG Twitch Tools</p>
        <h1 style={{ marginTop: 0 }}>Nightbot Chat Sender</h1>
        <p style={{ color: "#b9c1df", lineHeight: 1.6 }}>
          Send a message to Twitch chat through Nightbot using your protected cron token.
          Keep the token private — anyone with it can send messages.
        </p>

        <section style={{ background: "#11152a", border: "1px solid #20294d", borderRadius: 18, padding: 18, marginTop: 20 }}>
          <label style={{ display: "block", color: "#b9c1df", marginBottom: 6 }}>Cron token</label>
          <input
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="CRON_SECRET"
            type="password"
            style={inputStyle}
          />

          <label style={{ display: "block", color: "#b9c1df", margin: "14px 0 6px" }}>Twitch channel</label>
          <input
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
            placeholder="zipittt"
            style={inputStyle}
          />

          <label style={{ display: "block", color: "#b9c1df", margin: "14px 0 6px" }}>Message</label>
          <textarea
            value={msg}
            onChange={(e) => setMsg(e.target.value.slice(0, 390))}
            placeholder="Message to send in Twitch chat..."
            rows={5}
            style={{ ...inputStyle, resize: "vertical" }}
          />

          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginTop: 12, flexWrap: "wrap" }}>
            <span style={{ color: "#93a4d8" }}>{msg.length}/390 characters</span>
            <button
              onClick={sendMessage}
              disabled={sending || !token || !msg.trim()}
              style={{
                background: sending || !token || !msg.trim() ? "#33405f" : "#6d7cff",
                color: "white",
                border: 0,
                borderRadius: 12,
                padding: "12px 18px",
                cursor: sending || !token || !msg.trim() ? "not-allowed" : "pointer",
                fontWeight: 800,
              }}
            >
              {sending ? "Sending..." : "Send through Nightbot"}
            </button>
          </div>

          {result && (
            <pre style={{ background: "#080a14", border: "1px solid #26305b", borderRadius: 12, padding: 14, marginTop: 16, whiteSpace: "pre-wrap", color: "#b6ffdf" }}>
              {result}
            </pre>
          )}
        </section>

        <section style={{ background: "#11152a", border: "1px solid #20294d", borderRadius: 18, padding: 18, marginTop: 20 }}>
          <h2 style={{ marginTop: 0 }}>URL mode</h2>
          <p style={{ color: "#b9c1df" }}>You can also send by opening a URL like this:</p>
          <pre style={{ background: "#080a14", border: "1px solid #26305b", borderRadius: 12, padding: 14, overflowX: "auto", color: "#b6ffdf", whiteSpace: "pre-wrap" }}>
            https://sols-rng-twitch.vercel.app/api/chat-send?token=YOUR_CRON_SECRET&channel=zipittt&msg=Hello%20chat
          </pre>
          <p style={{ color: "#b9c1df" }}>Current preview:</p>
          <pre style={{ background: "#080a14", border: "1px solid #26305b", borderRadius: 12, padding: 14, overflowX: "auto", color: "#b6ffdf", whiteSpace: "pre-wrap" }}>
            {urlPreview}
          </pre>
        </section>
      </div>
    </main>
  );
}

const inputStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  background: "#080a14",
  border: "1px solid #26305b",
  borderRadius: 12,
  color: "#eef2ff",
  padding: "12px 14px",
  outline: "none",
  fontSize: 15,
};

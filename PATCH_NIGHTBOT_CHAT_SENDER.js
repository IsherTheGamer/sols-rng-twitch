const fs = require("fs");
const path = require("path");

function writeFile(filePath, content) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content);
  console.log(`✅ Wrote ${filePath}`);
}

writeFile("src/pages/api/chat-send.ts", `import type { NextApiRequest, NextApiResponse } from "next";
import { text, verifyCron } from "@/lib/api-helpers";
import { sendNightbotMessage } from "@/lib/nightbot";

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function normalizeChannel(input: string): string {
  return input
    .trim()
    .replace(/^@+/, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "");
}

function readBodyField(req: NextApiRequest, key: "msg" | "message"): string {
  if (!req.body || typeof req.body !== "object") return "";
  const value = (req.body as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

function readMessage(req: NextApiRequest): string {
  const raw =
    readBodyField(req, "msg") ||
    readBodyField(req, "message") ||
    first(req.query.msg) ||
    first(req.query.message) ||
    first(req.query.query) ||
    first(req.query.text);

  return raw.replace(/\\s+/g, " ").trim().slice(0, 390);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!verifyCron(req)) {
    return res.status(401).send("Unauthorized");
  }

  const channel =
    normalizeChannel(
      first(req.query.channel) ||
        first(req.query.channelName) ||
        process.env.DEFAULT_CHANNEL_NAME ||
        process.env.DEFAULT_CHANNEL ||
        ""
    ) || undefined;

  const msg = readMessage(req);

  if (!msg) {
    return text(res, "Use /api/chat-send?token=CRON_SECRET&channel=zipittt&msg=your message");
  }

  const ok = await sendNightbotMessage(msg, channel);

  if (!ok) {
    return text(res, "❌ Nightbot send failed. Check NIGHTBOT_TOKEN or connected Nightbot OAuth.");
  }

  return text(res, \`✅ Sent to \${channel ?? "default channel"}: \${msg}\`);
}
`);

writeFile("src/pages/chat-send.tsx", `import type { CSSProperties } from "react";
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
    return \`/api/chat-send?\${params.toString()}\`;
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
`);

if (fs.existsSync("src/pages/dashboard.tsx")) {
  let dashboard = fs.readFileSync("src/pages/dashboard.tsx", "utf8");
  if (!dashboard.includes("/chat-send")) {
    const link = `<div style={{ marginTop: 20 }}>
          <a href="/chat-send" style={{ color: "#b6ffdf", fontWeight: 800 }}>Open Nightbot Chat Sender →</a>
        </div>`;
    if (dashboard.includes("</main>")) {
      dashboard = dashboard.replace("</main>", `${link}\n      </main>`);
      fs.writeFileSync("src/pages/dashboard.tsx", dashboard);
      console.log("✅ Added chat sender link to dashboard");
    } else {
      console.log("⚠️ Could not find </main> in dashboard; page still added.");
    }
  } else {
    console.log("ℹ️ Dashboard already links to chat sender");
  }
}

console.log("✅ Nightbot chat sender patch complete.");

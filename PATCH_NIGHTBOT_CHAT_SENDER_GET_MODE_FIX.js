const fs = require("fs");

const file = "src/pages/chat-send.tsx";

if (!fs.existsSync(file)) {
  console.error("❌ Missing src/pages/chat-send.tsx. Install nightbot-chat-sender first.");
  process.exit(1);
}

let s = fs.readFileSync(file, "utf8");

const oldBlock = `  async function sendMessage() {
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
  }`;

const newBlock = `  async function sendMessage() {
    setSending(true);
    setResult("");

    try {
      const params = new URLSearchParams();
      params.set("token", token);
      params.set("channel", channel);
      params.set("msg", msg);

      // Use GET/query mode because it is the same path that works from a direct URL.
      // This avoids browser/body/proxy issues that can cause "Failed to fetch".
      const response = await fetch(\`/api/chat-send?\${params.toString()}\`, {
        method: "GET",
        cache: "no-store",
      });

      const body = await response.text();
      setResult(body || \`HTTP \${response.status}\`);
    } catch (error) {
      setResult(\`Failed to fetch. Try URL mode directly: /api/chat-send?token=YOUR_TOKEN&channel=\${channel}&msg=\${encodeURIComponent(msg)}\`);
    } finally {
      setSending(false);
    }
  }`;

if (s.includes(oldBlock)) {
  s = s.replace(oldBlock, newBlock);
} else if (!s.includes("Use GET/query mode")) {
  console.error("❌ Could not find website sendMessage POST block.");
  process.exit(1);
}

fs.writeFileSync(file, s);
console.log("✅ Chat sender page now uses GET/query mode instead of POST body.");

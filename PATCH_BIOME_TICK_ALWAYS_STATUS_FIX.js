const fs = require("fs");

const path = "src/pages/api/biome-tick.ts";

if (!fs.existsSync(path)) {
  console.error("❌ Missing src/pages/api/biome-tick.ts");
  process.exit(1);
}

let s = fs.readFileSync(path, "utf8");

// Ensure getBiomeStatus is imported.
s = s.replace(
  `import { processBiomeTick } from "@/lib/biome-engine";`,
  `import { processBiomeTick, getBiomeStatus } from "@/lib/biome-engine";`
);

// If the previous patch already imported it, avoid duplicate import text.
s = s.replace(
  `import { processBiomeTick, getBiomeStatus, getBiomeStatus } from "@/lib/biome-engine";`,
  `import { processBiomeTick, getBiomeStatus } from "@/lib/biome-engine";`
);

// Add status flag helper if missing. Existing fixed patch already has getFirst().
if (!s.includes("function isDisabledFlag(")) {
  const marker = `function normalizeChannel(input: string): string {`;
  if (!s.includes(marker)) {
    console.error("❌ Could not find normalizeChannel helper.");
    process.exit(1);
  }

  s = s.replace(
    marker,
    `function isDisabledFlag(input: string | string[] | undefined): boolean {
  const value = (getFirst(input) ?? "").trim().toLowerCase();
  return ["0", "false", "off", "no", "silent"].includes(value);
}

${marker}`
  );
}

// Replace status sending logic from old fixed version.
// Old version only sent duration when biome-engine generated a periodic statusMessage.
// New version sends status every cron tick by default.
const oldStatusBlock = `  if (result.statusMessage) {
    await sendNightbotMessage(getBiomeStatus(result.state), channelName);
  }`;

const newStatusBlock = `  // Default behavior: every cron tick sends the current biome + remaining duration.
  // Use &status=0 only if you want the cron to announce biome changes but not status.
  const shouldSendStatus = !isDisabledFlag(req.query.status);

  if (shouldSendStatus) {
    await sendNightbotMessage(getBiomeStatus(result.state), channelName);
  }`;

if (s.includes(oldStatusBlock)) {
  s = s.replace(oldStatusBlock, newStatusBlock);
} else if (!s.includes("const shouldSendStatus = !isDisabledFlag(req.query.status);")) {
  // For older/original biome-tick.ts, insert status before unlockText.
  const marker = `  if (unlockText) {
    await sendNightbotMessage(unlockText, channelName);
  }`;
  if (!s.includes(marker)) {
    console.error("❌ Could not find place to insert always-status send.");
    process.exit(1);
  }

  s = s.replace(marker, `${newStatusBlock}

${marker}`);
}

// Make response say status sent when enabled, not only when biome-engine internally generated statusMessage.
s = s.replace(
  `  if (result.statusMessage) parts.push("status sent");`,
  `  if (typeof shouldSendStatus !== "undefined" && shouldSendStatus) parts.push("status sent");`
);

fs.writeFileSync(path, s);
console.log("✅ Biome tick now sends current biome status every cron tick by default.");

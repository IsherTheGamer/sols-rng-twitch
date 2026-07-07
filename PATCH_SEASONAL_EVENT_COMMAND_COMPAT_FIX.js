const fs = require("fs");

function patchFile(path, patcher) {
  if (!fs.existsSync(path)) {
    console.warn(`⚠️ Missing ${path}, skipped.`);
    return;
  }
  const before = fs.readFileSync(path, "utf8");
  const after = patcher(before);
  if (after !== before) {
    fs.writeFileSync(path, after);
    console.log(`✅ Patched ${path}`);
  } else {
    console.log(`ℹ️ No changes needed for ${path}`);
  }
}

patchFile("src/lib/mega-feature-system.ts", (s) => {
  if (!s.includes('import { findEvent, events } from "./data";')) {
    s = s.replace(
      `import { getServerLuckMultiplier } from "./social-system";`,
      `import { getServerLuckMultiplier } from "./social-system";\nimport { findEvent, events } from "./data";\nimport { getChannelState, setChannelState } from "./state";`
    );
  }

  if (!s.includes("function findSeasonalEventForCommand")) {
    const helper = `
function findSeasonalEventForCommand(raw: string) {
  const q = clean(raw);
  if (!q) return undefined;
  return findEvent(q) ?? findEvent(q.replace(/_/g, " "));
}

function seasonalEventName(id: string): string {
  return findEvent(id)?.name ?? titleCase(id);
}

function seasonalEventIdsLabel(ids: string[]): string {
  if (ids.length === 0) return "none";
  return ids.map(seasonalEventName).join(", ");
}

function seasonalEventListText(): string {
  return events.map((event) => event.id).join(", ");
}

async function activateSeasonalEvent(channelId: string, user: NightbotUser | null, raw: string, isMod: boolean): Promise<string> {
  if (!isMod) return "Seasonal event activation is mod/broadcaster only.";
  const event = findSeasonalEventForCommand(raw);
  if (!event) {
    return \`Unknown seasonal event. Try: \${events.slice(-8).map((e) => e.id).join(", ")}\`;
  }
  const state = await getChannelState(channelId);
  const set = new Set(state.activeEvents ?? []);
  const alreadyActive = set.has(event.id);
  set.add(event.id);
  state.activeEvents = [...set];
  await setChannelState(state);
  const biomes = event.eventBiomes?.length ? \` | Event biomes: \${event.eventBiomes.join(", ")}\` : "";
  return \`\${alreadyActive ? "✅ Already active" : "✅ Event activated"}: \${event.name} | Event auras enabled\${biomes}. Use !event stop \${event.id} to disable.\`;
}

async function deactivateSeasonalEvent(channelId: string, raw: string, isMod: boolean): Promise<string> {
  if (!isMod) return "Seasonal event stop is mod/broadcaster only.";
  const state = await getChannelState(channelId);
  const target = clean(raw).toLowerCase();
  if (target === "all" || target === "seasonal" || target === "events" || target === "all_events") {
    const count = state.activeEvents?.length ?? 0;
    state.activeEvents = [];
    await setChannelState(state);
    return \`✅ Stopped \${count} seasonal event(s).\`;
  }
  const event = findSeasonalEventForCommand(raw);
  if (!event) return "Unknown seasonal event. Use !event list.";
  const before = state.activeEvents ?? [];
  state.activeEvents = before.filter((id) => id !== event.id);
  await setChannelState(state);
  return before.includes(event.id)
    ? \`✅ Event disabled: \${event.name}.\`
    : \`\${event.name} was not active.\`;
}
`;
    const marker = `export async function formatChannelEvent`;
    if (!s.includes(marker)) {
      console.error("❌ Could not find formatChannelEvent marker.");
      process.exit(1);
    }
    s = s.replace(marker, helper + "\n" + marker);
  }

  const replacement = `export async function formatChannelEvent(channelId: string, user: NightbotUser | null, query: string, isMod: boolean): Promise<string> {
  const r = getRedis();
  if (!r) return "Event database is not connected.";

  const args = query.trim().split(/\\s+/).filter(Boolean);
  const action = (args[0] ?? "status").toLowerCase();

  // Old compatibility: !event summer_2025, !event halloween_2025, etc.
  // This activates seasonal aura/event IDs in ChannelState.activeEvents.
  const directSeasonal = findSeasonalEventForCommand(query);
  if (directSeasonal && !["status", "start", "stop", "end", "off", "disable", "list", "events", "seasonal"].includes(action)) {
    return activateSeasonalEvent(channelId, user, query, isMod);
  }

  if (action === "list" || action === "events" || action === "seasonal") {
    const state = await getChannelState(channelId);
    return truncate(\`🎉 Seasonal Events | Active: \${seasonalEventIdsLabel(state.activeEvents ?? [])} | Available: \${seasonalEventListText()}\`, 390);
  }

  if (action === "start") {
    if (!isMod) return "Event start is mod/broadcaster only.";

    const target = args.slice(1).join(" ");
    const seasonal = findSeasonalEventForCommand(target);

    if (seasonal) {
      return activateSeasonalEvent(channelId, user, target, isMod);
    }

    const kind = (args[1] ?? "luckstorm").toLowerCase() as ChannelEvent["kind"];
    const mins = Math.max(1, Math.min(120, parseAmount(args[2], 10)));
    const percent = kind === "luckstorm" ? 25 : kind === "festival" ? 15 : 10;
    const event: ChannelEvent = { id: \`\${kind}:\${Date.now()}\`, name: titleCase(kind), kind, percent, createdAt: Date.now(), expiresAt: Date.now() + mins * 60 * 1000, createdBy: getDisplayName(user) };
    await r.set(kEvent(channelId), event);
    return \`🎉 Event started: \${event.name} +\${event.percent}% for \${mins}m.\`;
  }

  if (action === "on" || action === "enable" || action === "activate") {
    return activateSeasonalEvent(channelId, user, args.slice(1).join(" "), isMod);
  }

  if (action === "stop" || action === "end" || action === "off" || action === "disable") {
    if (!isMod) return "Event stop is mod/broadcaster only.";

    const target = args.slice(1).join(" ");
    if (target) {
      const seasonal = findSeasonalEventForCommand(target);
      if (seasonal || ["all", "seasonal", "events", "all_events"].includes(target.toLowerCase())) {
        return deactivateSeasonalEvent(channelId, target, isMod);
      }
    }

    await r.del(kEvent(channelId));
    return "🎉 Channel event stopped.";
  }

  const state = await getChannelState(channelId);
  const seasonalText = \`Seasonal: \${seasonalEventIdsLabel(state.activeEvents ?? [])}\`;
  const event = await getActiveChannelEvent(channelId);

  if (!event) {
    return truncate(\`🎉 No channel boost event active. \${seasonalText}. Mods: !event summer_2025 OR !event start luckstorm 10\`, 390);
  }

  const left = Math.ceil((event.expiresAt - Date.now()) / 1000);
  return truncate(\`🎉 Boost Event: \${event.name} +\${event.percent}% | \${Math.floor(left / 60)}m\${left % 60}s left | \${seasonalText}\`, 390);
}

`;

  const re = /export async function formatChannelEvent\(channelId: string, user: NightbotUser \| null, query: string, isMod: boolean\): Promise<string> \{[\s\S]*?\n\}\n\nexport async function getActiveChannelEvent/;
  if (!re.test(s)) {
    console.error("❌ Could not replace formatChannelEvent block.");
    process.exit(1);
  }
  s = s.replace(re, replacement + "export async function getActiveChannelEvent");
  return s;
});

patchFile("src/lib/social-system.ts", (s) => {
  if (s.includes("Seasonal event command restored")) return s;
  const marker = `const UPDATE_NOTES = [`;
  if (!s.includes(marker)) return s;
  return s.replace(
    marker,
    `const UPDATE_NOTES = [\n  "Seasonal event command restored: mods can use !event summer_2025, !event christmas_2025, !event easter_2026, etc. New boost events still use !event start luckstorm 10.",`
  );
});

patchFile("src/lib/sol-info.ts", (s) => {
  if (s.includes("!event summer_2025")) return s;
  return s.replace(
    `"!event = channel event status",`,
    `"!event = channel event status",\n  "!event summer_2025 = activate a seasonal aura/event pool",\n  "!event stop summer_2025 = disable a seasonal event",\n  "!event start luckstorm 10 = start a temporary channel boost",`
  );
});

console.log("✅ Seasonal event command compatibility fix complete.");

const fs = require("fs");

function fail(msg) {
  console.error("❌ " + msg);
  process.exit(1);
}

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

patchFile("src/lib/activity-of-knowledge-system.ts", (s) => {
  if (!s.includes("function normalizeResearchMode")) {
    const insertAfter = `function researchStatusLine(node: ResearchNode, player: PlayerActivityState): string {
  const status = player.unlockedResearch[node.id] ? "✅" : \`🧠 \${formatAmount(node.cost)}\`;
  const gate = node.coreRequired ? \` Core \${node.coreRequired}+\` : "";
  return \`\${status} \${node.id}: \${node.name}\${gate}\`;
}`;

    const replacement = insertAfter + `

const RESEARCH_BRANCHES: ResearchBranch[] = [
  "archive",
  "crafting",
  "core",
  "relic",
  "scanner",
  "boss",
  "market",
  "blueprint",
  "forecast",
];

const RESEARCH_BRANCH_LABELS: Record<ResearchBranch, string> = {
  archive: "Archive / Knowledge",
  crafting: "Crafting",
  core: "Core Walls",
  relic: "Relics",
  scanner: "Scanner",
  boss: "Boss Damage",
  market: "Marketplace",
  blueprint: "Blueprints",
  forecast: "Forecast",
};

const RESEARCH_BRANCH_HELP: Record<ResearchBranch, string> = {
  archive: "Knowledge economy upgrades. Archive Memory makes rare activity and duplicate knowledge systems more valuable.",
  crafting: "Crafting quality-of-life and future efficiency upgrades. This branch should stay small so crafting does not become OP.",
  core: "Core-wall planning. Helps reveal walls, blueprint gates, frames, chassis, and late-core requirements.",
  relic: "Relic slots, relic strength, and the expensive relic rarity reroll machine.",
  scanner: "Information upgrades. More signal/detail, but never exact rare-biome guarantees.",
  boss: "Boss damage upgrades. Max bonus is +250%, meaning 3.5x total damage.",
  market: "Safer merchant economy. More offers, blueprint/relic shard access, tiny discount tools.",
  blueprint: "Blueprint discovery, fragment use, and wall-breaking systems.",
  forecast: "Semi-smart daily advice using recent activity, but intentionally not exact predictions.",
};

function normalizeResearchMode(raw: string | undefined | null): string {
  return (raw ?? "")
    .toLowerCase()
    .trim()
    .replace(/^!+/, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function findResearchNode(raw: string): ResearchNode | undefined {
  const q = normalizeResearchMode(raw);
  return RESEARCH_TREE.find(
    (node) =>
      node.id === q ||
      normalizeResearchMode(node.name) === q ||
      normalizeResearchMode(node.name).replace(/_/g, "") === q.replace(/_/g, "")
  );
}

function isResearchBranch(raw: string): raw is ResearchBranch {
  return RESEARCH_BRANCHES.includes(raw as ResearchBranch);
}

function researchEffectNow(node: ResearchNode): string {
  if (node.scannerLevel) return \`Unlocks Scanner Lv.\${node.scannerLevel}.\`;

  if (node.id.startsWith("boss_damage_")) {
    const pct = BOSS_DAMAGE_RESEARCH.find(([id]) => id === node.id)?.[1] ?? 0;
    return \`Boss damage bonus becomes +\${pct}% if this is your highest boss damage node.\`;
  }

  if (node.id === "relic_slot_2") return "Unlocks the second relic slot for future/equipped relic balancing.";
  if (node.id === "relic_slot_3") return "Unlocks the third relic slot. Balanced for Core 150+ progression.";
  if (node.id === "relic_reforger") return "Unlocks the expensive relic rarity reroll machine.";
  if (node.id === "relic_attune_1") return "Relic effect strength foundation: intended +5% relic effect scaling.";
  if (node.id === "relic_attune_2") return "Relic effect strength foundation: intended +10% relic effect scaling.";

  if (node.id === "archive_memory_1") return "Archive/Knowledge foundation. This is meant to boost Knowledge value from rare activity by +5%.";
  if (node.id === "archive_memory_2") return "Deeper Archive memory. This is meant to improve duplicate blueprint/relic conversion into Knowledge.";

  if (node.id === "forecast_1") return "Unlocks/justifies basic daily forecast usage.";
  if (node.id === "forecast_2") return "Forecast starts caring more about activity context.";
  if (node.id === "forecast_3") return "Forecast becomes more personalized once later systems use player progress.";

  if (node.branch === "blueprint") return "Blueprint wall/planning upgrade. Used to reveal or prepare late unlock requirements.";
  if (node.branch === "core") return "Core wall planning upgrade. Used for future wall visibility and recipe planning.";
  if (node.branch === "market") return "Marketplace upgrade foundation. Used for safer offers and later market improvements.";
  if (node.branch === "crafting") return "Crafting efficiency foundation. Kept small to protect balance.";

  return "Progression foundation upgrade.";
}

function researchWhyItMatters(node: ResearchNode): string {
  switch (node.branch) {
    case "archive":
      return "This branch answers: how do I earn and use Knowledge better?";
    case "crafting":
      return "This branch answers: how do I craft smoother without making materials worthless?";
    case "core":
      return "This branch answers: what wall is coming and what blueprint/frame/chassis do I need?";
    case "relic":
      return "This branch answers: how many relics can I use and how far can relic rarity go?";
    case "scanner":
      return "This branch answers: what is happening now, and what should I focus on?";
    case "boss":
      return "This branch answers: how hard do my rolls hit bosses?";
    case "market":
      return "This branch answers: what safe items can I buy without breaking the economy?";
    case "blueprint":
      return "This branch answers: how do I unlock walls, machines, and special recipes?";
    case "forecast":
      return "This branch answers: what is a good direction today without exact spoilers?";
  }
}

function researchRequirementText(node: ResearchNode): string {
  const reqs = [
    node.requires?.length ? \`Requires: \${node.requires.join(", ")}\` : null,
    node.coreRequired ? \`Core \${node.coreRequired}+\` : null,
    \`Cost: \${formatAmount(node.cost)} Knowledge\`,
  ].filter(Boolean);
  return reqs.join(" | ");
}

function formatResearchBranches(): string {
  return truncate(
    \`🧠 Research Branches: \${RESEARCH_BRANCHES.map((b) => \`\${b}=\${RESEARCH_BRANCH_LABELS[b]}\`).join(" | ")} | Use !research <branch>, !research info <id>, or !research unlock <id>\`,
    390
  );
}

function formatResearchBranch(branch: ResearchBranch, player: PlayerActivityState, rawPage?: string): string {
  const nodes = RESEARCH_TREE.filter((node) => node.branch === branch);
  const totalPages = Math.max(1, Math.ceil(nodes.length / 4));
  const page = Math.max(1, Math.min(totalPages, Number(rawPage || 1) || 1));
  const shown = nodes.slice((page - 1) * 4, page * 4).map((node) => researchStatusLine(node, player));
  return truncate(
    \`🧠 \${RESEARCH_BRANCH_LABELS[branch]} \${page}/\${totalPages}: \${RESEARCH_BRANCH_HELP[branch]} | \${shown.join(" | ")}\`,
    390
  );
}

function formatResearchNodeDetail(node: ResearchNode, player: PlayerActivityState, rawPage?: string): string {
  const page = Math.max(1, Math.min(2, Number(rawPage || 1) || 1));
  const unlocked = player.unlockedResearch[node.id] ? "Unlocked ✅" : "Locked ⬜";

  if (page === 2) {
    return truncate(
      \`🧠 \${node.name} 2/2 | Why: \${researchWhyItMatters(node)} | Branch: \${RESEARCH_BRANCH_LABELS[node.branch]} | ID: \${node.id} | Unlock: !research unlock \${node.id}\`,
      390
    );
  }

  return truncate(
    \`🧠 \${node.name} 1/2 | \${unlocked} | \${researchRequirementText(node)} | Effect: \${researchEffectNow(node)} | Page 2: !research info \${node.id} 2\`,
    390
  );
}`;

    if (!s.includes(insertAfter)) fail("Could not find researchStatusLine block.");
    s = s.replace(insertAfter, replacement);
  }

  const start = s.indexOf(`export async function formatResearch(`);
  const end = s.indexOf(`\n\nexport async function unlockResearch`, start);
  if (start === -1 || end === -1) fail("Could not find formatResearch function.");

  if (!s.slice(start, end).includes("formatResearchBranches")) {
    const newFormat = `export async function formatResearch(channelId: string, user: NightbotUser | null, raw = ""): Promise<string> {
  const p = await getPlayerState(channelId, user);
  const parts = raw.trim().split(/\\s+/).filter(Boolean);
  const mode = normalizeResearchMode(parts[0] ?? "");

  if (!mode || mode === "help") {
    return truncate(\`🧠 Research | Knowledge \${formatAmount(p.knowledge)} | Use !research branches, !research <branch>, !research info <id>, !research unlock <id>. Example: !research boss\`, 390);
  }

  if (mode === "branches" || mode === "tree") {
    return formatResearchBranches();
  }

  if (mode === "info" || mode === "detail" || mode === "details") {
    const possiblePage = parts[parts.length - 1];
    const nodeInput = /^\\d+$/.test(possiblePage) ? parts.slice(1, -1).join(" ") : parts.slice(1).join(" ");
    const node = findResearchNode(nodeInput);
    if (!node) return "Unknown research upgrade. Use !research branches or !research <branch>.";
    return formatResearchNodeDetail(node, p, /^\\d+$/.test(possiblePage) ? possiblePage : undefined);
  }

  if (isResearchBranch(mode)) {
    return formatResearchBranch(mode, p, parts[1]);
  }

  const directNode = findResearchNode(parts[0]);
  if (directNode) {
    return formatResearchNodeDetail(directNode, p, parts[1]);
  }

  const pageRaw = parts[0];
  const page = clampInt(Number(pageRaw || 1), 1, 99);
  const pageSize = 5;
  const total = Math.max(1, Math.ceil(RESEARCH_TREE.length / pageSize));
  const safePage = Math.min(page, total);
  const shown = RESEARCH_TREE.slice((safePage - 1) * pageSize, safePage * pageSize).map((node) => researchStatusLine(node, p));
  return truncate(\`🧠 Research All \${safePage}/\${total} | Knowledge \${formatAmount(p.knowledge)} | \${shown.join(" | ")} | Details: !research info <id>\`, 390);
}`;
    s = s.slice(0, start) + newFormat + s.slice(end);
  }

  s = s.replace(
    `  if (!node) return \`Unknown research. Use !research to see IDs.\`;`,
    `  if (!node) return \`Unknown research. Use !research branches or !research info <id>.\`;`
  );

  return s;
});

patchFile("src/pages/activity.tsx", (s) => {
  if (s.includes("Research Tree Help")) return s;

  const section = `
        <section style={{ background: "#11152a", border: "1px solid #20294d", borderRadius: 18, padding: 18, marginTop: 20 }}>
          <h2 style={{ marginTop: 0 }}>Research Tree Help</h2>
          <p style={{ color: "#b9c1df" }}>The research command now has branch pages and upgrade detail pages.</p>
          <pre style={{ background: "#080a14", border: "1px solid #26305b", borderRadius: 12, padding: 14, overflowX: "auto", color: "#b6ffdf", whiteSpace: "pre-wrap" }}>{\`!research branches
!research archive
!research boss
!research scanner
!research relic
!research blueprint
!research info archive_memory_1
!research info boss_damage_1
!research unlock scanner_1\`}</pre>
        </section>`;

  return s.replace(`      </div>\n    </main>`, `${section}\n      </div>\n    </main>`);
});

patchFile("src/lib/sol-info.ts", (s) => {
  if (!s.includes("!research branches")) {
    s = s.replace(
      `"!research = view Research Tree pages. Use !research unlock <id> to unlock upgrades.",`,
      `"!research = research help. Use !research branches, !research <branch>, !research info <id>, or !research unlock <id>.",
  "!research branches = list branches. Branches: archive, crafting, core, relic, scanner, boss, market, blueprint, forecast.",`
    );
  }
  return s;
});

console.log("✅ Research tree detail rework complete.");

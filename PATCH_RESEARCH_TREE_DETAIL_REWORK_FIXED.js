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

patchFile("src/lib/activity-of-knowledge-system.ts", (s) => {
  if (!s.includes("const RESEARCH_BRANCHES")) {
    const helper = `
const RESEARCH_BRANCHES:Branch[]=["archive","crafting","core","relic","scanner","boss","market","blueprint","forecast"];
const RESEARCH_BRANCH_LABELS:Record<Branch,string>={archive:"Archive / Knowledge",crafting:"Crafting",core:"Core Walls",relic:"Relics",scanner:"Scanner",boss:"Boss Damage",market:"Marketplace",blueprint:"Blueprints",forecast:"Forecast"};
const RESEARCH_BRANCH_HELP:Record<Branch,string>={
archive:"Knowledge economy upgrades. Archive Memory means your account is learning from rare activity and duplicate systems.",
crafting:"Crafting quality-of-life and future efficiency upgrades. Kept small so crafting does not become broken.",
core:"Core-wall planning. Helps reveal walls, blueprint gates, frames, chassis, and late-core requirements.",
relic:"Relic slots, relic strength, and the expensive relic rarity reroll machine.",
scanner:"Information upgrades. More signal/detail, but never exact rare-biome guarantees.",
boss:"Boss damage upgrades. Max bonus is +250%, meaning 3.5x total damage.",
market:"Safer merchant economy. Better offers, blueprint/relic shard access, and tiny discount tools.",
blueprint:"Blueprint discovery, fragment use, and wall-breaking systems.",
forecast:"Semi-smart daily advice using recent activity, but intentionally not exact predictions."
};
function rnorm(raw:string|undefined|null){return(raw??"").toLowerCase().trim().replace(/^!+/,"").replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"")}
function findNode(raw:string){const q=rnorm(raw);return TREE.find(x=>x.id===q||rnorm(x.name)===q||rnorm(x.name).replace(/_/g,"")===q.replace(/_/g,""))}
function isBranch(raw:string):raw is Branch{return RESEARCH_BRANCHES.includes(raw as Branch)}
function effectNow(node:Node){if(node.scanner)return \`Unlocks Scanner Lv.\${node.scanner}.\`; if(node.id.startsWith("boss_damage_")){const pct=BDMG.find(([id])=>id===node.id)?.[1]??0;return \`Boss damage bonus becomes +\${pct}% if this is your highest boss damage upgrade.\`} if(node.id==="relic_slot_2")return"Unlocks the second relic slot."; if(node.id==="relic_slot_3")return"Unlocks the third relic slot. Balanced around Core 150+."; if(node.id==="relic_reforger")return"Unlocks the expensive relic rarity reroll machine."; if(node.id==="relic_attune_1")return"Relic effect strength foundation. Intended +5% relic effect scaling."; if(node.id==="relic_attune_2")return"Relic effect strength foundation. Intended +10% relic effect scaling."; if(node.id==="archive_memory_1")return"Archive/Knowledge foundation. Your activity becomes easier to convert into Knowledge rewards later."; if(node.id==="archive_memory_2")return"Deeper Archive memory. Improves duplicate blueprint/relic conversion into Knowledge later."; if(node.id==="forecast_1")return"Unlocks/justifies basic daily forecast usage."; if(node.id==="forecast_2")return"Forecast starts caring more about activity context."; if(node.id==="forecast_3")return"Forecast becomes more personalized once later systems use player progress."; if(node.branch==="blueprint")return"Blueprint wall/planning upgrade. Used to reveal or prepare late unlock requirements."; if(node.branch==="core")return"Core wall planning upgrade. Used for future wall visibility and recipe planning."; if(node.branch==="market")return"Marketplace upgrade foundation. Used for safer offers and later market improvements."; if(node.branch==="crafting")return"Crafting efficiency foundation. Kept small to protect balance."; return"Progression foundation upgrade."}
function whyNode(node:Node){if(node.branch==="archive")return"This branch answers: how do I earn/use Knowledge better?"; if(node.branch==="crafting")return"This branch answers: how do I craft smoother without making materials worthless?"; if(node.branch==="core")return"This branch answers: what wall is coming and what blueprint/frame/chassis do I need?"; if(node.branch==="relic")return"This branch answers: how many relics can I use and how far can relic rarity go?"; if(node.branch==="scanner")return"This branch answers: what is happening now, and what should I focus on?"; if(node.branch==="boss")return"This branch answers: how hard do my rolls hit bosses?"; if(node.branch==="market")return"This branch answers: what safe items can I buy without breaking the economy?"; if(node.branch==="blueprint")return"This branch answers: how do I unlock walls, machines, and special recipes?"; return"This branch answers: what is a good direction today without exact spoilers?"}
function reqText(node:Node){return[(node.req?.length?\`Requires: \${node.req.join(", ")}\`:null),(node.core?\`Core \${node.core}+\`:null),\`Cost: \${amt(node.cost)} Knowledge\`].filter(Boolean).join(" | ")}
function fmtBranches(){return truncate(\`🧠 Research Branches: \${RESEARCH_BRANCHES.map(b=>\`\${b}=\${RESEARCH_BRANCH_LABELS[b]}\`).join(" | ")} | Use !research <branch>, !research info <id>, or !research unlock <id>\`,390)}
function fmtBranch(branch:Branch,p:PlayerState,rawPage?:string){const nodes=TREE.filter(x=>x.branch===branch); const total=Math.max(1,Math.ceil(nodes.length/4)); const page=Math.max(1,Math.min(total,Number(rawPage||1)||1)); const shown=nodes.slice((page-1)*4,page*4).map(x=>line(x,p)); return truncate(\`🧠 \${RESEARCH_BRANCH_LABELS[branch]} \${page}/\${total}: \${RESEARCH_BRANCH_HELP[branch]} | \${shown.join(" | ")}\`,390)}
function fmtNode(node:Node,p:PlayerState,rawPage?:string){const page=Math.max(1,Math.min(2,Number(rawPage||1)||1)); const unlocked=p.unlockedResearch[node.id]?"Unlocked ✅":"Locked ⬜"; if(page===2)return truncate(\`🧠 \${node.name} 2/2 | Why: \${whyNode(node)} | Branch: \${RESEARCH_BRANCH_LABELS[node.branch]} | ID: \${node.id} | Unlock: !research unlock \${node.id}\`,390); return truncate(\`🧠 \${node.name} 1/2 | \${unlocked} | \${reqText(node)} | Effect: \${effectNow(node)} | Page 2: !research info \${node.id} 2\`,390)}
`;
    const marker = `function line(node:Node,p:PlayerState){`;
    const idx = s.indexOf(marker);
    if (idx === -1) {
      console.error("❌ Could not find compact research line() function.");
      process.exit(1);
    }
    const nextExport = s.indexOf("\nexport async function formatKnowledge", idx);
    if (nextExport === -1) {
      console.error("❌ Could not find formatKnowledge export.");
      process.exit(1);
    }
    s = s.slice(0, nextExport) + helper + s.slice(nextExport);
  }

  const newFormat = `export async function formatResearch(channelId:string,user:NightbotUser|null,raw=""){const p=await getP(channelId,user); const parts=raw.trim().split(/\\s+/).filter(Boolean); const mode=rnorm(parts[0]??""); if(!mode||mode==="help")return truncate(\`🧠 Research | Knowledge \${amt(p.knowledge)} | Use !research branches, !research <branch>, !research info <id>, !research unlock <id>. Example: !research boss\`,390); if(mode==="branches"||mode==="tree")return fmtBranches(); if(mode==="info"||mode==="detail"||mode==="details"){const rawNode=parts.slice(1).filter(x=>!/^[12]$/.test(x)).join(" "); const node=findNode(rawNode); if(!node)return "Unknown research upgrade. Use !research branches or !research <branch>."; return fmtNode(node,p,parts[parts.length-1])} if(isBranch(mode))return fmtBranch(mode,p,parts[1]); const direct=findNode(parts[0]); if(direct)return fmtNode(direct,p,parts[1]); const page=clamp(Number(parts[0]||1),1,99); const size=5,total=Math.max(1,Math.ceil(TREE.length/size)),safe=Math.min(page,total); const shown=TREE.slice((safe-1)*size,safe*size).map(x=>line(x,p)); return truncate(\`🧠 Research All \${safe}/\${total} | Knowledge \${amt(p.knowledge)} | \${shown.join(" | ")} | Details: !research info <id>\`,390)}`;

  const re = /export async function formatResearch\(channelId:string,user:NightbotUser\|null,raw=""\)\{[\s\S]*?\}\nexport async function unlockResearch/;
  if (!re.test(s)) {
    console.error("❌ Could not replace compact formatResearch().");
    process.exit(1);
  }
  s = s.replace(re, `${newFormat}\nexport async function unlockResearch`);

  s = s.replace(`Unknown research. Use !research to see IDs.`, `Unknown research. Use !research branches or !research info <id>.`);

  return s;
});

patchFile("src/pages/activity.tsx", (s) => {
  if (s.includes("Research Tree Help")) return s;
  const section = `
        <section style={{ background: "#11152a", border: "1px solid #20294d", borderRadius: 18, padding: 18, marginTop: 20 }}>
          <h2 style={{ marginTop: 0 }}>Research Tree Help</h2>
          <p style={{ color: "#b9c1df" }}>The research command now has branch pages and detailed upgrade pages.</p>
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
  return s.replace(`      </div>
    </main>`, `${section}
      </div>
    </main>`);
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

console.log("✅ Fixed research tree detail rework complete.");

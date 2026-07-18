import { truncate } from "./format";

interface GuideEntry {
  id: string;
  name: string;
  aliases?: string[];
  obtain: string;
  use: string;
  command?: string;
}

const MATERIALS: GuideEntry[] = [
  { id:"scrap", name:"Scrap", obtain:"Every successful aura roll; Starter Boxes; quests; Activity Market Scrap Packs.", use:"Basic components, chassis, frames, and early wall components." },
  { id:"metal_bits", name:"Metal Bits", aliases:["metal","bits"], obtain:"Every successful aura roll; Activity Market Scrap Packs.", use:"Basic components, chassis, and frames." },
  { id:"mechanical_scrap", name:"Mechanical Scrap", aliases:["mechanical"], obtain:"Guaranteed 1 every 5 successful aura rolls; Activity Market Scrap Packs.", use:"Early components, chassis, and frames." },
  { id:"circuit_scrap", name:"Circuit Scrap", aliases:["circuit"], obtain:"Any 1/450+ aura; Daily Crafting; Starter Boxes; Activity Market Circuit Packs.", use:"Electronics and Core 16–49 path-wall components." },
  { id:"signal_fragment", name:"Signal Fragment", aliases:["signal"], obtain:"Any 1/10,000+ aura; quests; boxes; Activity Market Circuit Packs.", use:"Mid-tier electronics, SHD, and early path walls." },
  { id:"refined_alloy", name:"Refined Alloy", aliases:["refined"], obtain:"Any 1/50,000+ aura; quests; Core/Quest Boxes; Activity Market packs.", use:"Tier 5+ crafting and Core 16–89 path walls." },
  { id:"stabilized_flux", name:"Stabilized Flux", aliases:["flux"], obtain:"Any 1/1,000,000+ aura; weekly quests; Core Boxes; Activity Market advanced packs.", use:"Tier 6+ crafting and Core 50–129 path walls." },
  { id:"chrono_dust", name:"Chrono Dust", aliases:["chrono"], obtain:"Any 1/5,000,000+ aura.", use:"Core 90–129 path-wall components and time recipes." },
  { id:"quantum_residue", name:"Quantum Residue", aliases:["quantum"], obtain:"Any 1/10,000,000+ aura; weekly rare quest; Reactor Boxes.", use:"Tier 7+ crafting and Core 90–169 path walls." },
  { id:"void_glass", name:"Void Glass", aliases:["void"], obtain:"Any 1/25,000,000+ aura.", use:"Biome and dimensional crafting." },
  { id:"stellar_ink", name:"Stellar Ink", aliases:["stellar","ink"], obtain:"Any 1/75,000,000+ aura.", use:"Biome, blueprint, and stellar crafting." },
  { id:"reality_thread", name:"Reality Thread", aliases:["reality","thread"], obtain:"Any 1/100,000,000+ aura; weekly rare quest; Reactor Boxes.", use:"Tier 8+ crafting and Core 130–219 path walls." },
  { id:"dimensional_seal", name:"Dimensional Seal", aliases:["seal","dimensional"], obtain:"Any 1/250,000,000+ aura; Anomaly Boxes.", use:"Late path-wall and dimensional recipes." },
  { id:"anomaly_matter", name:"Anomaly Matter", aliases:["anomaly"], obtain:"Any 1/500,000,000+ aura; Anomaly Boxes; Dev Boxes.", use:"Core 170+ path walls and anomaly crafting." },
  { id:"singularity_shard", name:"Singularity Shard", aliases:["singularity","shard"], obtain:"Any 1/1,000,000,000+ aura.", use:"Core 170+ wall components and singularity recipes." },
  { id:"glitched_alloy", name:"Glitched Alloy", aliases:["glitched"], obtain:"Any 1/1,000,000,000+ aura.", use:"Final Core 220–250 path-wall components." },
  { id:"forbidden_circuit", name:"Forbidden Circuit", aliases:["forbidden"], obtain:"Any 1/5,000,000,000+ aura; Anomaly Boxes.", use:"Only final Core 220–250 wall components and Forbidden recipes." },
  { id:"thermal_paste", name:"Thermal Paste", aliases:["thermal","paste"], obtain:"Special event, market, blueprint, or future reward rotations.", use:"Optional advanced electronics; not required by early Core walls." },
  { id:"conductive_gel", name:"Conductive Gel", aliases:["conductive","gel"], obtain:"Special event, market, blueprint, or future reward rotations.", use:"Optional support electronics; not required by early Core walls." },
  { id:"energy_cell", name:"Energy Cell", aliases:["energy"], obtain:"Special event, market, blueprint, or future reward rotations.", use:"Optional power recipes; not required by early Core walls." },
  { id:"debug_fragment", name:"Debug Fragment", aliases:["debug"], obtain:"Developer/admin rewards only.", use:"Developer-exclusive recipes." },
];

const TOKENS: GuideEntry[] = [
  { id:"recipe_token", name:"Recipe Token", aliases:["recipe"], obtain:"Weekly quests, achievements, Core/Anomaly/Reactor Boxes, and events.", use:"Consumed automatically by high-tier component, Core, SHD, and Reactor recipes.", command:"!core token recipe" },
  { id:"path_token", name:"Path Token", aliases:["path"], obtain:"Core 15 progression, path story rewards, and Dev Boxes.", use:"Consumed automatically when choosing/switching paths and crafting Realignment systems.", command:"!core token path" },
  { id:"reactor_token", name:"Reactor Token", aliases:["reactor"], obtain:"Reactor story quest, Reactor achievement, and Reactor Boxes.", use:"Consumed automatically by higher Stardust Reactor upgrades.", command:"!core token reactor" },
  { id:"crafting_token", name:"Crafting Token", aliases:["crafting","craft"], obtain:"Daily Crafting quest and Quest Boxes.", use:"Activate a 25% discount on your next successful component craft.", command:"!core token use crafting" },
  { id:"quest_token", name:"Quest Token", aliases:["quest"], obtain:"Daily Rolling, Starter/Quest Boxes, rare quests, and path bonuses.", use:"Instantly adds 25% progress to one unfinished daily/weekly Core quest.", command:"!core token use quest" },
  { id:"wall_token", name:"Wall Token", aliases:["wall"], obtain:"Weekly Core quest, Core achievements, Core/Anomaly/Dev Boxes.", use:"Consumed automatically by randomized wall Cores and Sub-Cores.", command:"!core token wall" },
  { id:"anomaly_token", name:"Anomaly Token", aliases:["anomaly"], obtain:"Anomaly Boxes and late anomaly progression.", use:"Consumed automatically by Core 130+ Anomaly wall components.", command:"!core token anomaly" },
];

const BOXES: GuideEntry[] = [
  { id:"starter_box", name:"Starter Box", aliases:["starter"], obtain:"Beginner achievements, SHD story, and early rewards.", use:"Scrap, Circuit Scrap, Signal Fragments, and Quest Tokens.", command:"!box open starter" },
  { id:"core_box", name:"Core Box", aliases:["core"], obtain:"Every 10th Core, weekly Core quests, and milestones.", use:"Refined Alloy, Stabilized Flux, Recipe Tokens, and possible Wall Tokens.", command:"!box open core" },
  { id:"quest_box", name:"Quest Box", aliases:["quest"], obtain:"Daily Rare Hunt, roll achievements, and quest rewards.", use:"Signal Fragments, Refined Alloy, Quest Tokens, and Crafting Tokens.", command:"!box open quest" },
  { id:"reactor_box", name:"Reactor Box", aliases:["reactor"], obtain:"Reactor story, achievement, and reactor rewards.", use:"Quantum Residue, Reality Thread, Reactor Tokens, and Recipe Tokens.", command:"!box open reactor" },
  { id:"anomaly_box", name:"Anomaly Box", aliases:["anomaly"], obtain:"Core 100 rewards and late progression.", use:"Anomaly Matter, Dimensional Seals, Forbidden Circuits, and Anomaly Tokens.", command:"!box open anomaly" },
  { id:"dev_box", name:"Dev Box", aliases:["dev"], obtain:"Developer/admin rewards only.", use:"Debug and late-game materials/tokens.", command:"!box open dev" },
];

const COMPONENT_FAMILIES = [
  "wire","cable","plate","rod","screw","bolt","coil","resistor","smd_resistor",
  "transistor","smd_transistor","capacitor","smd_capacitor","diode","smd_diode",
  "fuse","relay","sensor","emitter","lens","heat_sink","battery_cell","power_cell",
  "circuit_board","processor","logic_chip","regulator","stabilizer","conduit","matrix",
] as const;

const PATH_LADDERS: Record<string, string[]> = {
  safe:["stability_buffer","stability_lock","quantum_anchor","reality_bastion","singularity_seal","absolute_lock"],
  risk:["volatile_capacitor","risk_compressor","chaos_engine","rupture_core","singularity_overdrive","cataclysm_drive"],
  support:["support_relay","support_regulator","logistics_matrix","restoration_hub","quantum_coordinator","celestial_network"],
  biome:["biome_sensor","biome_lens","climate_resonator","dimensional_ecoscope","worldseed_prism","omnibiome_array"],
  precision:["targeting_filter","precision_filter","probability_calibrator","reality_sieve","singularity_scope","absolute_predictor"],
  token:["token_socket","token_amplifier","voucher_encoder","token_reactor","infinite_ledger","sovereign_mint"],
  anomaly:["instability_buffer","anomaly_compressor","rift_decoder","null_processor","paradox_engine","forbidden_singularity"],
};
const PATH_RANGES = ["Core 16–49","Core 50–89","Core 90–129","Core 130–169","Core 170–219","Core 220–250"];

function normalize(input:string|undefined|null){return(input??"").toLowerCase().trim().replace(/^!+/,"").replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"");}
function titleCase(input:string){return input.split(/[_\-\s:]+/g).filter(Boolean).map(x=>x.charAt(0).toUpperCase()+x.slice(1)).join(" ");}
function findEntry(entries:GuideEntry[],raw:string){const q=normalize(raw);if(!q)return undefined;return entries.find(e=>[e.id,e.name,...(e.aliases??[])].map(normalize).some(v=>v===q||v.replace(/_/g,"")===q.replace(/_/g,"")));}
function page(raw:string|undefined,total:number){const n=Number(String(raw??"1").replace(/,/g,""));return Math.max(1,Math.min(total,Number.isFinite(n)?Math.floor(n):1));}
function entry(e:GuideEntry,icon:string){return truncate(`${icon} ${e.name} | Obtain: ${e.obtain} | Use: ${e.use}${e.command?` | Command: ${e.command}`:""}`,390);}
function list(entries:GuideEntry[],raw:string|undefined,title:string){const size=3,total=Math.max(1,Math.ceil(entries.length/size)),p=page(raw,total),shown=entries.slice((p-1)*size,p*size);return truncate(`${title} ${p}/${total}: ${shown.map(e=>`${e.name} — ${e.obtain}`).join(" | ")}`,390);}

const PATH_COMPONENTS:GuideEntry[]=Object.entries(PATH_LADDERS).flatMap(([path,ids])=>ids.map((id,i)=>({id,name:titleCase(id),aliases:[`${path}_${i+1}`],obtain:`Crafted ${titleCase(path)} wall component for ${PATH_RANGES[i]}.`,use:`Required only by ${titleCase(path)} wall Cores/Sub-Cores in ${PATH_RANGES[i]}; one craft makes x2.`,command:`!craft recipe ${id}`})));

export function formatMaterialGuide(query="",pageRaw="1"){const e=query&&!/^\d+$/.test(query)?findEntry(MATERIALS,query):undefined;return e?entry(e,"🧱"):query&&!/^\d+$/.test(query)?`Unknown material: ${query}. Try !info obtain <item>.`:list(MATERIALS,/^\d+$/.test(query)?query:pageRaw,"🧱 Material Sources");}
export function formatTokenSourceGuide(query="",pageRaw="1"){const e=query&&!/^\d+$/.test(query)?findEntry(TOKENS,query):undefined;return e?entry(e,"🎟️"):query&&!/^\d+$/.test(query)?`Unknown Core token: ${query}. Try !info token sources.`:list(TOKENS,/^\d+$/.test(query)?query:pageRaw,"🎟️ Core Token Guide");}
export function isKnownTokenGuide(query:string){return Boolean(findEntry(TOKENS,query));}
export function formatBoxGuide(query="",pageRaw="1"){const e=query&&!/^\d+$/.test(query)?findEntry(BOXES,query):undefined;return e?entry(e,"📦"):query&&!/^\d+$/.test(query)?`Unknown box: ${query}. Try !info boxes.`:list(BOXES,/^\d+$/.test(query)?query:pageRaw,"📦 Box Guide");}

function genericComponent(query:string){const id=normalize(query),match=id.match(/^(.+?)_(\d+)$/),raw=match?.[1]??id,family=COMPONENT_FAMILIES.find(x=>normalize(x)===normalize(raw)||normalize(titleCase(x))===normalize(raw));if(!family)return null;const tier=Math.max(1,Math.min(10,Number(match?.[2]??1)));return{id:`${family}_${tier}`,tier};}
export function formatComponentGuide(query="",pageRaw="1"){
  if(query&&!/^\d+$/.test(query)){const path=findEntry(PATH_COMPONENTS,query);if(path)return entry(path,"🧭");const c=genericComponent(query);if(!c)return`Unknown component: ${query}. Try !info components or !info paths.`;return truncate(`⚙️ ${titleCase(c.id)} | Craft: !craft recipe ${c.id} | Higher tiers use the previous tier plus rarity materials. ${c.tier<=5?"Makes x2 per batch.":c.tier<=7?"Makes x1 with duplicate chances.":"Late tier; may consume Recipe Tokens."}`,390);}
  const entries=COMPONENT_FAMILIES.map(id=>({id,name:titleCase(id),obtain:`Craft !craft recipe ${id}_1; use _2 through _10.`,use:"Core, SHD, Reactor, and advanced recipes."}));
  return list(entries,/^\d+$/.test(query)?query:pageRaw,"⚙️ Component Families");
}
export function formatPathComponentGuide(path="",_pageRaw="1"){const p=normalize(path);if(p&&PATH_LADDERS[p])return truncate(`🧭 ${titleCase(p)} walls: ${PATH_LADDERS[p].map((id,i)=>`${PATH_RANGES[i]}=${titleCase(id)}`).join(" | ")} | Each craft makes x2.`,390);return truncate(`🧭 Paths: ${Object.keys(PATH_LADDERS).join(", ")} | Use !info path <name>.`,390);}
export function formatObtainGuide(query="",pageRaw="1"){const q=query.trim();if(!q||/^\d+$/.test(q))return"🔎 Obtain | !info material <name> | component <name> | token <name> | box <name> | path <name>";const m=findEntry(MATERIALS,q);if(m)return entry(m,"🧱");const t=findEntry(TOKENS,q);if(t)return entry(t,"🎟️");const b=findEntry(BOXES,q);if(b)return entry(b,"📦");const p=findEntry(PATH_COMPONENTS,q);if(p)return entry(p,"🧭");if(genericComponent(q))return formatComponentGuide(q,pageRaw);return`No obtain guide found for ${q}.`;}

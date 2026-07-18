import { Redis } from "@upstash/redis";
import type { NightbotUser } from "./nightbot";
import type { RollHitResult } from "./roll-engine";
import { truncate } from "./format";
import {
  getCoreGuideSnapshot,
  getCoreState,
  grantCoreMaterials,
} from "./core-system";

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  redis = new Redis({ url, token });
  return redis;
}

type Branch =
  | "archive"
  | "crafting"
  | "core"
  | "relic"
  | "scanner"
  | "boss"
  | "market"
  | "blueprint"
  | "forecast";

type ResearchNode = {
  id: string;
  branch: Branch;
  name: string;
  effect: string;
  cost: number;
  requires?: string[];
  coreRequired?: number;
  scannerLevel?: number;
};

type Boss = {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  startedAt: number;
  endsAt: number;
  participants: Record<string, { name: string; damage: number }>;
  defeated: boolean;
};

type WorldEvent = {
  id: string;
  name: string;
  description: string;
  rarity: "common" | "rare" | "legendary";
  effect:
    | "materials"
    | "knowledge"
    | "relics"
    | "blueprints"
    | "market"
    | "boss"
    | "scanner";
  startedAt: number;
  endsAt: number;
};

type Forecast = {
  date: string;
  text: string;
  confidence: "low" | "medium" | "high";
  generatedAt: number;
};

type MarketItem = {
  id: string;
  name: string;
  baseCost: number;
  reward: string;
  research?: string;
};

type ChannelState = {
  channelId: string;
  channelName: string;
  boss: Boss | null;
  worldEvent: WorldEvent | null;
  forecast: Forecast | null;
  marketDate: string | null;
  marketItems: MarketItem[];
  stats: {
    bossesDefeated: number;
    worldEventsStarted: number;
    globalQuestCompletions: number;
  };
  updatedAt: number;
};

type RelicRarity =
  | "common"
  | "uncommon"
  | "rare"
  | "epic"
  | "mythic"
  | "astral"
  | "glitched"
  | "forbidden";

type RelicEffect =
  | "knowledge"
  | "boss_damage"
  | "merchant_marks"
  | "market_discount"
  | "blueprint_find"
  | "relic_shards"
  | "scanner";

type Relic = {
  id: string;
  name: string;
  rarity: RelicRarity;
  level: number;
  equipped: boolean;
  effect?: RelicEffect;
};

type PlayerState = {
  channelId: string;
  userId: string;
  displayName: string;
  knowledge: number;
  merchantMarks: number;
  relicShards: number;
  blueprintFragments: number;
  scannerLevel: number;
  unlockedResearch: Record<string, boolean>;
  blueprints: Record<string, boolean>;
  relics: Relic[];
  stats: {
    bossDamage: number;
    bossKills: number;
    knowledgeEarned: number;
    worldEventsSeen: number;
    relicRerolls: number;
  };
  updatedAt: number;
};

type Blueprint = {
  id: string;
  name: string;
  cost: number;
  source: string;
  effect: string;
  research?: string;
  scanner?: number;
  core?: number;
};

const PCACHE = new Map<string, { expiresAt: number; value: PlayerState }>();
const CCACHE = new Map<string, { expiresAt: number; value: ChannelState }>();
const CACHE_MS = 3500;
const EVENT_CHANCE = 1 / 250;
const EVENT_MIN_MS = 25 * 60 * 1000;

const BRANCHES: Branch[] = [
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

const BRANCH_NAMES: Record<Branch, string> = {
  archive: "Knowledge Income",
  crafting: "Workshop Supplies",
  core: "Core Guidance",
  relic: "Relics",
  scanner: "Scanner",
  boss: "Boss Damage",
  market: "Marketplace",
  blueprint: "Blueprints",
  forecast: "Forecast",
};

const BRANCH_HELP: Record<Branch, string> = {
  archive: "Increase Knowledge earned from rare rolls.",
  crafting: "Make Activity Market material packs larger.",
  core: "Reveal your Core path and upcoming wall.",
  relic: "Unlock slots, stronger effects, and rerolls.",
  scanner: "Reveal useful live information and next actions.",
  boss: "Increase damage dealt to bosses.",
  market: "Unlock offers and lower prices.",
  blueprint: "Reveal sources and assemble permanent upgrades.",
  forecast: "Improve the daily recommendation.",
};

const TREE: ResearchNode[] = [
  { id: "archive_memory_1", branch: "archive", name: "Archive Memory I", effect: "+10% Knowledge from rare rolls.", cost: 30 },
  { id: "archive_memory_2", branch: "archive", name: "Archive Memory II", effect: "Knowledge multiplier becomes +25%.", cost: 120, requires: ["archive_memory_1"] },
  { id: "craft_efficiency_1", branch: "crafting", name: "Workshop Logistics I", effect: "Market material packs give +25%.", cost: 60 },
  { id: "craft_efficiency_2", branch: "crafting", name: "Workshop Logistics II", effect: "Market material packs give +50%.", cost: 180, requires: ["craft_efficiency_1"] },
  { id: "core_mapping_1", branch: "core", name: "Core Mapping I", effect: "Scanner shows your current Core/path.", cost: 75 },
  { id: "core_mapping_2", branch: "core", name: "Core Mapping II", effect: "Scanner shows the next wall component.", cost: 250, requires: ["core_mapping_1"], coreRequired: 25 },
  { id: "boss_damage_1", branch: "boss", name: "Hunter Training I", effect: "+10% boss damage.", cost: 50 },
  { id: "boss_damage_2", branch: "boss", name: "Hunter Training II", effect: "+25% boss damage.", cost: 150, requires: ["boss_damage_1"] },
  { id: "boss_damage_3", branch: "boss", name: "Hunter Training III", effect: "+50% boss damage.", cost: 400, requires: ["boss_damage_2"], coreRequired: 25 },
  { id: "boss_damage_4", branch: "boss", name: "Hunter Training IV", effect: "+100% boss damage.", cost: 1000, requires: ["boss_damage_3"], coreRequired: 75 },
  { id: "boss_damage_5", branch: "boss", name: "Hunter Training V", effect: "+175% boss damage.", cost: 2500, requires: ["boss_damage_4"], coreRequired: 150 },
  { id: "boss_damage_6", branch: "boss", name: "Hunter Training VI", effect: "+250% boss damage.", cost: 6000, requires: ["boss_damage_5"], coreRequired: 230 },
  { id: "relic_slot_2", branch: "relic", name: "Relic Slot II", effect: "Equip up to 2 relics.", cost: 200, coreRequired: 25 },
  { id: "relic_slot_3", branch: "relic", name: "Relic Slot III", effect: "Equip up to 3 relics.", cost: 800, requires: ["relic_slot_2"], coreRequired: 100 },
  { id: "relic_attune_1", branch: "relic", name: "Relic Attunement I", effect: "All equipped relic effects are 5% stronger.", cost: 300, requires: ["relic_slot_2"] },
  { id: "relic_attune_2", branch: "relic", name: "Relic Attunement II", effect: "All equipped relic effects are 10% stronger.", cost: 1000, requires: ["relic_attune_1"], coreRequired: 100 },
  { id: "relic_reforger", branch: "relic", name: "Relic Reforger", effect: "Unlocks !relics reroll.", cost: 1500, requires: ["relic_attune_1"], coreRequired: 125 },
  ...Array.from({ length: 10 }, (_, index): ResearchNode => {
    const level = index + 1;
    const roman = ["I","II","III","IV","V","VI","VII","VIII","IX","X"][index];
    const costs = [40,120,250,500,850,1400,2200,3200,4500,6500];
    const cores = [0,5,25,50,75,100,125,150,175,200];
    const effects = [
      "Shows whether Activity signals exist.",
      "Shows active boss information.",
      "Shows rare-signal strength.",
      "Shows active world events.",
      "Shows a recommended next action.",
      "Shows event reward focus.",
      "Connects to Forecast confidence.",
      "Shows blueprint/relic opportunity hints.",
      "Improves signal detail.",
      "Maximum detail; never guarantees RNG.",
    ];
    return {
      id: `scanner_${level}`,
      branch: "scanner",
      name: `Scanner ${roman}`,
      effect: effects[index],
      cost: costs[index],
      requires: level > 1 ? [`scanner_${level - 1}`] : undefined,
      coreRequired: cores[index] || undefined,
      scannerLevel: level,
    };
  }),
  { id: "market_contacts_1", branch: "market", name: "Market Contacts I", effect: "Unlocks Relic Shard and Blueprint Fragment offers.", cost: 150 },
  { id: "market_contacts_2", branch: "market", name: "Market Contacts II", effect: "Unlocks Stabilized Supply Packs.", cost: 500, requires: ["market_contacts_1"] },
  { id: "market_haggle_1", branch: "market", name: "Market Haggle I", effect: "Activity Market prices are 10% cheaper.", cost: 900, requires: ["market_contacts_2"] },
  { id: "blueprint_reading", branch: "blueprint", name: "Blueprint Reading", effect: "Blueprint info reveals exact sources.", cost: 125 },
  { id: "blueprint_assembly", branch: "blueprint", name: "Blueprint Assembly", effect: "Unlocks !blueprints assemble.", cost: 350, requires: ["blueprint_reading"] },
  { id: "wall_breaker_1", branch: "blueprint", name: "Wall Breaker I", effect: "+50% Blueprint Fragments from boss defeats.", cost: 900, requires: ["blueprint_assembly"], coreRequired: 75 },
  { id: "forecast_1", branch: "forecast", name: "Forecast I", effect: "Forecast considers boss/event state.", cost: 80 },
  { id: "forecast_2", branch: "forecast", name: "Forecast II", effect: "Forecast gives a more specific next command.", cost: 300, requires: ["forecast_1"] },
  { id: "forecast_3", branch: "forecast", name: "Forecast III", effect: "Forecast includes Core and blueprint progress.", cost: 1000, requires: ["forecast_2"], coreRequired: 75 },
];

const BOSS_RESEARCH: Array<[string, number]> = [
  ["boss_damage_1", 10],
  ["boss_damage_2", 25],
  ["boss_damage_3", 50],
  ["boss_damage_4", 100],
  ["boss_damage_5", 175],
  ["boss_damage_6", 250],
];

const BLUEPRINTS: Blueprint[] = [
  { id: "biome_lens", name: "Biome Lens Blueprint", cost: 3, source: "Boss defeats, Blueprint Rain, and Market.", effect: "+10% Knowledge during Activity world events.", research: "blueprint_assembly", scanner: 5 },
  { id: "relic_forge", name: "Relic Forge Blueprint", cost: 4, source: "Boss defeats, Relic Echo, and Market.", effect: "Unlocks !relics forge.", research: "blueprint_assembly" },
  { id: "quantum_press", name: "Quantum Press Blueprint", cost: 6, source: "Boss defeats and Blueprint Rain.", effect: "Relic costs -20%; material packs +25%.", research: "blueprint_assembly", core: 50 },
  { id: "boss_beacon", name: "Boss Beacon Blueprint", cost: 7, source: "Boss defeats and advanced Market contacts.", effect: "Unlocks !boss beacon for 150 Marks.", research: "blueprint_assembly", core: 50 },
  { id: "archive_terminal", name: "Archive Terminal Blueprint", cost: 8, source: "Knowledge milestones and major bosses.", effect: "+15% Knowledge from rare rolls.", research: "archive_memory_2", core: 75 },
  { id: "forbidden_frame", name: "Forbidden Frame Blueprint", cost: 12, source: "Forbidden Architect and Core 200+.", effect: "+50% boss Relic Shard rewards.", research: "wall_breaker_1", core: 200 },
];

const RARITIES: RelicRarity[] = ["common","uncommon","rare","epic","mythic","astral","glitched","forbidden"];
const RELIC_LABELS: Record<RelicEffect, string> = {
  knowledge: "Knowledge gain",
  boss_damage: "Boss damage",
  merchant_marks: "Merchant Mark gain",
  market_discount: "Market discount",
  blueprint_find: "Blueprint Fragment chance",
  relic_shards: "Relic Shard rewards",
  scanner: "Scanner signal strength",
};
const THEMES = ["Archive","Hunter","Market","Blueprint","Relic","Scanner","Core","Void","Astral","Quantum","Reality","Singularity"] as const;
const TYPES = ["Lens","Orb","Quill","Fang","Coin","Prism","Compass","Anvil","Shard","Crown","Engine","Beacon","Thread","Gear","Sigil"] as const;
const THEME_EFFECT: Record<string, RelicEffect> = {
  Archive: "knowledge",
  Hunter: "boss_damage",
  Market: "market_discount",
  Blueprint: "blueprint_find",
  Relic: "relic_shards",
  Scanner: "scanner",
  Core: "boss_damage",
  Void: "merchant_marks",
  Astral: "knowledge",
  Quantum: "blueprint_find",
  Reality: "merchant_marks",
  Singularity: "relic_shards",
};

function n(){ return Date.now(); }
function today(){ return new Date().toISOString().slice(0,10); }
function pk(c:string,u:string){ return `aok:player:${c}:${u}`; }
function ck(c:string){ return `aok:channel:${c}`; }
function uid(u:NightbotUser|null){ return u?.providerId ?? "anon"; }
function uname(u:NightbotUser|null){ return u?.displayName ?? u?.name ?? "Player"; }
function amt(v:number){ return Math.floor(v).toLocaleString("en-US"); }
function clamp(v:number,min:number,max:number){ return Math.max(min,Math.min(max,Math.floor(v||0))); }
function norm(raw:string|undefined|null){ return (raw??"").toLowerCase().trim().replace(/^!+/,"").replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,""); }
function pick<T>(items:readonly T[]):T{ return items[Math.floor(Math.random()*items.length)]; }
function left(ms:number){ const m=Math.floor(Math.max(0,ms)/60000),h=Math.floor(m/60); return h>0?`${h}h ${m%60}m`:`${m}m`; }

function defaultP(c:string,u:NightbotUser|null):PlayerState{
  return {channelId:c,userId:uid(u),displayName:uname(u),knowledge:0,merchantMarks:0,relicShards:0,blueprintFragments:0,scannerLevel:0,unlockedResearch:{},blueprints:{},relics:[],stats:{bossDamage:0,bossKills:0,knowledgeEarned:0,worldEventsSeen:0,relicRerolls:0},updatedAt:n()};
}
function inferEffect(r:Partial<Relic>):RelicEffect{
  if(r.effect)return r.effect;
  return THEME_EFFECT[String(r.name??"").split(/\s+/)[0]] ?? "knowledge";
}
function normP(x:Partial<PlayerState>|null|undefined,c:string,u:NightbotUser|null):PlayerState{
  const b=defaultP(c,u); if(!x)return b;
  return {...b,...x,channelId:c,userId:x.userId??b.userId,displayName:uname(u)||x.displayName||b.displayName,knowledge:clamp(x.knowledge??0,0,Number.MAX_SAFE_INTEGER),merchantMarks:clamp(x.merchantMarks??0,0,Number.MAX_SAFE_INTEGER),relicShards:clamp(x.relicShards??0,0,Number.MAX_SAFE_INTEGER),blueprintFragments:clamp(x.blueprintFragments??0,0,Number.MAX_SAFE_INTEGER),scannerLevel:clamp(x.scannerLevel??0,0,10),unlockedResearch:x.unlockedResearch??{},blueprints:x.blueprints??{},relics:(x.relics??[]).slice(0,50).map((r,i)=>({id:String(r.id??`legacy_${i}`),name:String(r.name??`Relic ${i+1}`),rarity:RARITIES.includes(r.rarity as RelicRarity)?r.rarity as RelicRarity:"common",level:clamp(r.level??1,1,10),equipped:Boolean(r.equipped),effect:inferEffect(r)})),stats:{...b.stats,...(x.stats??{})},updatedAt:n()};
}
function defaultC(c:string,name:string):ChannelState{
  return {channelId:c,channelName:name,boss:null,worldEvent:null,forecast:null,marketDate:null,marketItems:[],stats:{bossesDefeated:0,worldEventsStarted:0,globalQuestCompletions:0},updatedAt:n()};
}
function normC(x:Partial<ChannelState>|null|undefined,c:string,name:string):ChannelState{
  const b=defaultC(c,name); if(!x)return b;
  return {...b,...x,channelId:c,channelName:name||x.channelName||c,boss:x.boss??null,worldEvent:x.worldEvent??null,forecast:x.forecast??null,marketItems:x.marketItems??[],stats:{...b.stats,...(x.stats??{})},updatedAt:n()};
}
async function getP(c:string,u:NightbotUser|null){ const key=pk(c,uid(u)),cached=PCACHE.get(key); if(cached&&cached.expiresAt>n())return cached.value; const r=getRedis(); if(!r)return defaultP(c,u); const state=normP(await r.get<PlayerState>(key),c,u); PCACHE.set(key,{expiresAt:n()+CACHE_MS,value:state}); return state; }
async function saveP(p:PlayerState){ p.updatedAt=n(); PCACHE.set(pk(p.channelId,p.userId),{expiresAt:n()+CACHE_MS,value:p}); const r=getRedis(); if(r)await r.set(pk(p.channelId,p.userId),p); }
async function getC(c:string,name=c){ const key=ck(c),cached=CCACHE.get(key); if(cached&&cached.expiresAt>n())return cached.value; const r=getRedis(); if(!r)return defaultC(c,name); const state=normC(await r.get<ChannelState>(key),c,name); CCACHE.set(key,{expiresAt:n()+CACHE_MS,value:state}); return state; }
async function saveC(c:ChannelState){ c.updatedAt=n(); CCACHE.set(ck(c.channelId),{expiresAt:n()+CACHE_MS,value:c}); const r=getRedis(); if(r)await r.set(ck(c.channelId),c); }
function boss(c:ChannelState){ const b=c.boss; return !b||b.defeated||b.endsAt<=n()||b.hp<=0?null:b; }
function event(c:ChannelState){ const e=c.worldEvent; return !e||e.endsAt<=n()?null:e; }

function findNode(raw:string){ const q=norm(raw); return TREE.find(x=>[x.id,x.name].map(norm).some(v=>v===q||v.replace(/_/g,"")===q.replace(/_/g,""))); }
function prereqs(p:PlayerState,node:ResearchNode){ return (node.requires??[]).every(id=>p.unlockedResearch[id]); }
function nextNode(p:PlayerState){ return TREE.filter(x=>!p.unlockedResearch[x.id]&&prereqs(p,x)).sort((a,b)=>a.cost-b.cost).find(x=>x.cost<=p.knowledge) ?? TREE.filter(x=>!p.unlockedResearch[x.id]&&prereqs(p,x)).sort((a,b)=>a.cost-b.cost)[0] ?? null; }
function knowledgeMult(p:PlayerState){ return p.unlockedResearch.archive_memory_2?1.25:p.unlockedResearch.archive_memory_1?1.1:1; }
function bossResearch(p:PlayerState){ let best=0; for(const [id,pct] of BOSS_RESEARCH)if(p.unlockedResearch[id])best=Math.max(best,pct); return best; }
function slots(p:PlayerState){ return p.unlockedResearch.relic_slot_3?3:p.unlockedResearch.relic_slot_2?2:1; }
function attune(p:PlayerState){ return p.unlockedResearch.relic_attune_2?1.1:p.unlockedResearch.relic_attune_1?1.05:1; }
function basePct(r:RelicRarity){ return [2,3,5,8,12,18,28,45][RARITIES.indexOf(r)]; }
function relicPct(p:PlayerState,r:Relic){ return basePct(r.rarity)*(1+(r.level-1)*.12)*attune(p); }
function relicTotal(p:PlayerState,e:RelicEffect){ return p.relics.filter(r=>r.equipped&&inferEffect(r)===e).reduce((s,r)=>s+relicPct(p,r),0); }
function workshop(p:PlayerState){ let m=p.unlockedResearch.craft_efficiency_2?1.5:p.unlockedResearch.craft_efficiency_1?1.25:1; if(p.blueprints.quantum_press)m*=1.25; return m; }
function discount(p:PlayerState){ return Math.min(.35,(p.unlockedResearch.market_haggle_1 ? .1 : 0)+relicTotal(p,"market_discount")/100); }
function relicDiscount(p:PlayerState){ return p.blueprints.quantum_press ? .2 : 0; }
function discounted(v:number,d:number){ return Math.max(1,Math.floor(v*(1-d))); }

function makeBoss():Boss{
  const t=pick([{id:"scrap_titan",name:"Scrap Titan",hp:3500},{id:"circuit_hydra",name:"Circuit Hydra",hp:6500},{id:"stardust_warden",name:"Stardust Warden",hp:11000},{id:"void_leviathan",name:"Void Leviathan",hp:18000},{id:"glitched_monarch",name:"Glitched Monarch",hp:30000},{id:"forbidden_architect",name:"Forbidden Architect",hp:50000},{id:"archive_devourer",name:"Archive Devourer",hp:75000}] as const);
  return {...t,maxHp:t.hp,startedAt:n(),endsAt:n()+3*60*60*1000,participants:{},defeated:false};
}
function makeEvent():WorldEvent{
  const t=pick([
    {id:"meteor_shower",name:"Meteor Shower",description:"Basic material activity is favored.",effect:"materials" as const,rarity:"common" as const},
    {id:"archive_surge",name:"Archive Surge",description:"+25% Knowledge from rare rolls.",effect:"knowledge" as const,rarity:"rare" as const},
    {id:"relic_echo",name:"Relic Echo",description:"1M+ rolls can find Relic Shards.",effect:"relics" as const,rarity:"rare" as const},
    {id:"blueprint_rain",name:"Blueprint Rain",description:"1M+ rolls can find Blueprint Fragments.",effect:"blueprints" as const,rarity:"rare" as const},
    {id:"market_festival",name:"Market Festival",description:"+25% Merchant Marks from boss damage.",effect:"market" as const,rarity:"common" as const},
    {id:"boss_omen",name:"Boss Omen",description:"+25% boss damage.",effect:"boss" as const,rarity:"rare" as const},
    {id:"glitched_signal",name:"Glitched Signal",description:"Scanner signals are stronger.",effect:"scanner" as const,rarity:"legendary" as const},
  ] as const);
  const duration=t.rarity==="legendary"?75*60000:t.rarity==="rare"?50*60000:35*60000;
  return {...t,startedAt:n(),endsAt:n()+Math.max(EVENT_MIN_MS,duration)};
}
function kFrom(r:number){ if(r>=1e9)return 50;if(r>=1e8)return 25;if(r>=1e7)return 12;if(r>=1e6)return 6;if(r>=1e5)return 3;if(r>=1e4)return 1;return 0; }
function hitDmg(h:RollHitResult){ const r=h.effectiveRarity,tags=(h.aura.tags??[]).map((x: string)=>x.toLowerCase()); let d=1;if(r>=1e4)d+=1;if(r>=1e5)d+=3;if(r>=1e6)d+=5;if(r>=1e7)d+=10;if(r>=1e8)d+=25;if(r>=1e9||tags.includes("challenged")||tags.includes("challenged+"))d+=50;return d; }

function findBlueprint(raw:string){ const q=norm(raw); return BLUEPRINTS.find(x=>[x.id,x.name].map(norm).some(v=>v===q||v.replace(/_/g,"")===q.replace(/_/g,""))); }
function findRelic(p:PlayerState,raw:string){ const index=Number(raw.trim()); if(Number.isInteger(index)&&index>=1&&index<=p.relics.length)return p.relics[index-1]; const q=norm(raw); return p.relics.find(r=>[r.id,r.name].map(norm).some(v=>v===q||v.replace(/_/g,"")===q.replace(/_/g,""))); }
function relicRef(p:PlayerState,r:Relic){ return Math.max(1,p.relics.indexOf(r)+1); }
function effectText(p:PlayerState,r:Relic){ return `+${relicPct(p,r).toFixed(1)}% ${RELIC_LABELS[inferEffect(r)]}`; }
function newRelic():Relic{ const theme=pick(THEMES); return {id:`relic_${n()}_${Math.random().toString(36).slice(2,8)}`,name:`${theme} ${pick(TYPES)}`,rarity:Math.random()<.01?"epic":Math.random()<.08?"rare":Math.random()<.3?"uncommon":"common",level:1,equipped:false,effect:THEME_EFFECT[theme]}; }
function nextRarity(r:RelicRarity){ const i=RARITIES.indexOf(r),roll=Math.random(); return RARITIES[clamp(i+(roll<.03?2:roll<.53?1:roll>.92?-1:0),0,RARITIES.length-1)]; }

function marketItems(p:PlayerState):MarketItem[]{
  return [
    {id:"scrap_pack",name:"Scrap Supply Pack",baseCost:8,reward:"100 Scrap, 50 Metal Bits, 10 Mechanical Scrap"},
    {id:"circuit_pack",name:"Circuit Supply Pack",baseCost:20,reward:"50 Circuit Scrap, 5 Signal Fragments"},
    {id:"knowledge_note",name:"Knowledge Note",baseCost:35,reward:"25 Knowledge"},
    {id:"relic_shards",name:"Relic Shard Bundle",baseCost:50,reward:"5 Relic Shards",research:"market_contacts_1"},
    {id:"blueprint_fragment",name:"Blueprint Fragment",baseCost:60,reward:"1 Blueprint Fragment",research:"market_contacts_1"},
    {id:"stabilized_pack",name:"Stabilized Supply Pack",baseCost:95,reward:"30 Refined Alloy, 3 Stabilized Flux",research:"market_contacts_2"},
  ].filter(x=>!x.research||p.unlockedResearch[x.research]);
}

export async function formatKnowledge(channelId:string,user:NightbotUser|null){
  const p=await getP(channelId,user),next=nextNode(p);
  return truncate(`🧠 ${p.displayName} | Knowledge ${amt(p.knowledge)} → !research | Marks ${amt(p.merchantMarks)} → !market | Relic Shards ${amt(p.relicShards)} → !relics guide | Blueprint Fragments ${amt(p.blueprintFragments)} → !blueprints guide | Next: ${next?`${next.name} (${amt(next.cost)}): !research next`:"Research complete"}`);
}

export async function formatResearch(channelId:string,user:NightbotUser|null,raw=""){
  const p=await getP(channelId,user),parts=raw.trim().split(/\s+/).filter(Boolean),mode=norm(parts[0]??"");
  if(!mode||mode==="help"||mode==="guide")return truncate(`🧠 Research Guide | Earn Knowledge from 1/10k+ rolls → !research next → !research info <id> → !research unlock <id>. Current: ${amt(p.knowledge)} Knowledge.`);
  if(mode==="branches"||mode==="tree")return truncate(`🧠 Branches: ${BRANCHES.map(b=>`${b}=${BRANCH_NAMES[b]}`).join(" | ")} | Open: !research scanner`);
  if(mode==="next"||mode==="recommend"){const x=nextNode(p);if(!x)return"✅ All research unlocked.";return truncate(`🧠 Recommended: ${x.name} | ${p.knowledge>=x.cost?"Affordable now":`Need ${amt(x.cost-p.knowledge)} more Knowledge`} | Effect: ${x.effect} | Command: !research unlock ${x.id}`);}
  if(mode==="info"||mode==="detail"){const x=findNode(parts.slice(1).join(" "));if(!x)return"Unknown research. Use !research branches.";return truncate(`🧠 ${x.name} | ${p.unlockedResearch[x.id]?"Unlocked ✅":"Locked ⬜"} | Cost ${amt(x.cost)} Knowledge${x.coreRequired?` | Core ${x.coreRequired}+`:""}${x.requires?.length?` | Requires ${x.requires.join(", ")}`:""} | Effect: ${x.effect}`);}
  if(BRANCHES.includes(mode as Branch)){const b=mode as Branch,nodes=TREE.filter(x=>x.branch===b),page=clamp(Number(parts[1]||1),1,99),size=4,total=Math.max(1,Math.ceil(nodes.length/size)),safe=Math.min(page,total),shown=nodes.slice((safe-1)*size,safe*size);return truncate(`🧠 ${BRANCH_NAMES[b]} ${safe}/${total} | ${BRANCH_HELP[b]} | ${shown.map(x=>`${p.unlockedResearch[x.id]?"✅":prereqs(p,x)?p.knowledge>=x.cost?"🟢":"⬜":"🔒"} ${x.id} ${amt(x.cost)}`).join(" | ")} | !research info <id>`);}
  const direct=findNode(raw);if(direct)return truncate(`🧠 ${direct.name} | ${p.unlockedResearch[direct.id]?"Unlocked ✅":"Locked ⬜"} | Cost ${amt(direct.cost)} | Effect: ${direct.effect} | !research unlock ${direct.id}`);
  return"Unknown research command. Use !research guide, next, or branches.";
}

export async function unlockResearch(channelId:string,user:NightbotUser|null,rawId:string){
  const node=findNode(rawId);if(!node)return"Unknown research. Use !research next.";
  const p=await getP(channelId,user);if(p.unlockedResearch[node.id])return`${node.name} already unlocked. Effect: ${node.effect}`;
  for(const req of node.requires??[])if(!p.unlockedResearch[req])return`${node.name} requires ${findNode(req)?.name??req} first.`;
  if(node.coreRequired){const core=await getCoreState(channelId,user);if(core.coreTier<node.coreRequired)return`${node.name} requires Core ${node.coreRequired}. Current: ${core.coreTier}.`;}
  if(p.knowledge<node.cost)return`${node.name} needs ${amt(node.cost)} Knowledge. You have ${amt(p.knowledge)}; need ${amt(node.cost-p.knowledge)} more.`;
  p.knowledge-=node.cost;p.unlockedResearch[node.id]=true;if(node.scannerLevel)p.scannerLevel=Math.max(p.scannerLevel,node.scannerLevel);await saveP(p);
  return`✅ Unlocked ${node.name}! Effect active: ${node.effect}`;
}

export async function formatScanner(channelId:string,channelName:string,user:NightbotUser|null){
  const [p,c]=await Promise.all([getP(channelId,user),getC(channelId,channelName)]);if(p.scannerLevel<=0)return"📡 Scanner locked. Earn 40 Knowledge, then !research unlock scanner_1.";
  const e=event(c),b=boss(c),parts=[`📡 Scanner Lv.${p.scannerLevel}/10`];
  if(p.scannerLevel>=2)parts.push(`Boss: ${b?`${b.name} ${amt(b.hp)}/${amt(b.maxHp)} HP`:"none"}`);
  if(p.scannerLevel>=3)parts.push(`Signal: ${e?.rarity==="legendary"||relicTotal(p,"scanner")>=10?"High":e?.rarity==="rare"?"Medium":"Low"}`);
  if(p.scannerLevel>=4)parts.push(`Event: ${e?`${e.name} ${left(e.endsAt-n())}`:"none"}`);
  if(p.unlockedResearch.core_mapping_1&&p.scannerLevel>=4){const s=await getCoreGuideSnapshot(channelId,user);parts.push(`Core: ${s.path} ${s.currentTier}`);if(p.unlockedResearch.core_mapping_2&&p.scannerLevel>=5)parts.push(`Next: Core ${s.nextTier}${s.isWall?` wall ${s.wallComponent}`:""}`);}
  if(p.scannerLevel>=5)parts.push(`Do now: ${b?"roll to damage boss":e?.effect==="knowledge"?"roll 1/10k+ for boosted Knowledge":e?.effect==="relics"?"roll 1M+ for Shards":e?.effect==="blueprints"?"roll 1M+ for Fragments":"use !research next"}`);
  if(p.scannerLevel<10)parts.push(`Upgrade: !research unlock scanner_${p.scannerLevel+1}`);
  return truncate(parts.join(" | "));
}

export async function formatWorldEvent(channelId:string,channelName:string){const c=await getC(channelId,channelName),e=event(c);return e?truncate(`🌍 ${e.name} (${e.rarity}) | ${e.description} | Left ${left(e.endsAt-n())}`):"🌍 No Activity world event. Use !scanner or !forecast.";}
export async function maybeStartActivityWorldEvent(o:{channelId:string;channelName:string;biomeId:string}){if(Math.random()>=EVENT_CHANCE)return{started:false,message:null as string|null};const c=await getC(o.channelId,o.channelName);if(event(c))return{started:false,message:null as string|null};const e=makeEvent();c.worldEvent=e;c.stats.worldEventsStarted+=1;await saveC(c);return{started:true,message:`🌍 Activity Event: ${e.name} started for ${left(e.endsAt-e.startedAt)}! ${e.description}`};}

export async function formatForecast(channelId:string,channelName:string,user:NightbotUser|null=null){
  const [c,p]=await Promise.all([getC(channelId,channelName),getP(channelId,user)]);if(!p.unlockedResearch.forecast_1)return"🔮 Forecast locked. Use !research unlock forecast_1.";
  const e=event(c),b=boss(c);let confidence:Forecast["confidence"]=b||e?"medium":"low";if(p.unlockedResearch.forecast_3&&p.scannerLevel>=7)confidence=b||e?"high":"medium";
  let tip=b?`Roll now to damage ${b.name}.`:e?.effect==="knowledge"?"Roll 1/10k+ for boosted Knowledge.":e?.effect==="relics"?"Roll 1M+ for Relic Shards.":e?.effect==="blueprints"?"Roll 1M+ for Blueprint Fragments.":"Use !research next and keep rolling.";
  if(p.unlockedResearch.forecast_3){const s=await getCoreGuideSnapshot(channelId,user);if(s.isWall)tip+=` Prepare ${s.wallComponent} for Core ${s.nextTier}.`;}
  const text=`🔮 Forecast (${confidence}) | ${tip}`;c.forecast={date:today(),text,confidence,generatedAt:n()};await saveC(c);return truncate(text);
}

export async function formatBoss(channelId:string,channelName:string){const c=await getC(channelId,channelName),b=c.boss;if(!b)return"🐉 No boss active. Mods: !boss start | Boss Beacon owners: !boss beacon";if(b.defeated||b.hp<=0)return`🏆 ${b.name} defeated!`;if(b.endsAt<=n())return`⌛ ${b.name} expired.`;const top=Object.values(b.participants).sort((a,b)=>b.damage-a.damage).slice(0,3).map(x=>`${x.name} ${amt(x.damage)}`).join(", ");return truncate(`🐉 ${b.name} | HP ${amt(b.hp)}/${amt(b.maxHp)} | Left ${left(b.endsAt-n())} | Roll to damage | Top: ${top||"none"}`);}
export async function startBoss(channelId:string,channelName:string){const c=await getC(channelId,channelName),cur=boss(c);if(cur)return`${cur.name} already active. HP ${amt(cur.hp)}/${amt(cur.maxHp)}.`;c.boss=makeBoss();await saveC(c);return`🐉 Boss started: ${c.boss.name}! HP ${amt(c.boss.maxHp)}.`;}
export async function startBossWithBeacon(channelId:string,channelName:string,user:NightbotUser|null){const [c,p]=await Promise.all([getC(channelId,channelName),getP(channelId,user)]);if(!p.blueprints.boss_beacon)return"Boss Beacon requires !blueprints assemble boss_beacon.";const cur=boss(c);if(cur)return`${cur.name} already active.`;if(p.merchantMarks<150)return`Boss Beacon costs 150 Marks. You have ${amt(p.merchantMarks)}.`;p.merchantMarks-=150;c.boss=makeBoss();await Promise.all([saveP(p),saveC(c)]);return`📡 Boss Beacon used! ${c.boss.name} started for 150 Marks.`;}

export async function recordActivityRolls(o:{channelId:string;channelName:string;user:NightbotUser|null;results:RollHitResult[]}){
  if(!o.user||o.results.length===0)return;const best=Math.max(...o.results.map(r=>r.effectiveRarity)),baseK=kFrom(best),c=await getC(o.channelId,o.channelName),b=boss(c),e=event(c);if(!b&&!e&&baseK<=0)return;
  const p=await getP(o.channelId,o.user);let sp=false,sc=false;
  if(baseK>0){let m=knowledgeMult(p)*(1+relicTotal(p,"knowledge")/100);if(e?.effect==="knowledge")m*=1.25;if(e&&p.blueprints.biome_lens)m*=1.1;if(p.blueprints.archive_terminal)m*=1.15;const gain=Math.max(1,Math.floor(baseK*m));p.knowledge+=gain;p.stats.knowledgeEarned+=gain;sp=true;}
  if(e&&p.stats.worldEventsSeen===0){p.stats.worldEventsSeen=1;sp=true;}
  if(e?.effect==="relics"&&best>=1e6&&Math.random()<.15+Math.min(.25,relicTotal(p,"relic_shards")/100)){p.relicShards+=1;sp=true;}
  if(e?.effect==="blueprints"&&best>=1e6&&Math.random()<.12+Math.min(.25,relicTotal(p,"blueprint_find")/100)){p.blueprintFragments+=1;sp=true;}
  if(b){const base=o.results.reduce((s,r)=>s+hitDmg(r),0),mult=(1+bossResearch(p)/100+relicTotal(p,"boss_damage")/100)*(e?.effect==="boss"?1.25:1),damage=Math.max(1,Math.floor(base*mult));b.hp=Math.max(0,b.hp-damage);const ent=b.participants[p.userId]??{name:p.displayName,damage:0};ent.name=p.displayName;ent.damage+=damage;b.participants[p.userId]=ent;p.stats.bossDamage+=damage;let marks=Math.max(1,Math.floor(damage/25)*(1+relicTotal(p,"merchant_marks")/100));if(e?.effect==="market")marks*=1.25;p.merchantMarks+=Math.max(1,Math.floor(marks));sp=sc=true;if(b.hp<=0&&!b.defeated){b.defeated=true;c.stats.bossesDefeated+=1;p.stats.bossKills+=1;p.knowledge+=100;p.blueprintFragments+=Math.max(1,Math.floor(2*(p.unlockedResearch.wall_breaker_1||p.blueprints.forbidden_frame?1.5:1)));p.relicShards+=Math.max(1,Math.floor(5*(p.blueprints.forbidden_frame?1.5:1)*(1+relicTotal(p,"relic_shards")/100)));}}
  await Promise.all([sp?saveP(p):Promise.resolve(),sc?saveC(c):Promise.resolve()]);
}

export async function formatMarket(channelId:string,channelName:string,user:NightbotUser|null=null){const [c,p]=await Promise.all([getC(channelId,channelName),getP(channelId,user)]),items=marketItems(p);c.marketDate=today();c.marketItems=items;await saveC(c);return truncate(`🏪 Market | Marks ${amt(p.merchantMarks)} | ${items.map(x=>`${x.id} ${discounted(x.baseCost,discount(p))}`).join(" | ")} | !market buy <id>`);}
export async function buyMarketItem(channelId:string,channelName:string,user:NightbotUser|null,itemId:string){
  const [c,p]=await Promise.all([getC(channelId,channelName),getP(channelId,user)]),item=marketItems(p).find(x=>x.id===norm(itemId));if(!item)return"Unknown/locked item. Use !market.";const cost=discounted(item.baseCost,discount(p));if(p.merchantMarks<cost)return`${item.name} costs ${cost} Marks. You have ${amt(p.merchantMarks)}.`;p.merchantMarks-=cost;let reward="";
  if(item.id==="knowledge_note"){p.knowledge+=25;reward="25 Knowledge";}else if(item.id==="relic_shards"){p.relicShards+=5;reward="5 Relic Shards";}else if(item.id==="blueprint_fragment"){p.blueprintFragments+=1;reward="1 Blueprint Fragment";}else{const m=workshop(p),materials:Record<string,number>=item.id==="scrap_pack"?{scrap:Math.floor(100*m),metal_bits:Math.floor(50*m),mechanical_scrap:Math.floor(10*m)}:item.id==="circuit_pack"?{circuit_scrap:Math.floor(50*m),signal_fragment:Math.floor(5*m)}:{refined_alloy:Math.floor(30*m),stabilized_flux:Math.floor(3*m)};await grantCoreMaterials(channelId,user,materials);reward=Object.entries(materials).map(([id,v])=>`${amt(v)} ${id.replace(/_/g," ")}`).join(", ");}
  c.marketDate=today();c.marketItems=marketItems(p);await Promise.all([saveP(p),saveC(c)]);return`✅ Bought ${item.name} for ${cost} Marks. Received ${reward}.`;
}

export async function formatBlueprints(channelId:string,user:NightbotUser|null,raw=""){
  const p=await getP(channelId,user),parts=raw.trim().split(/\s+/).filter(Boolean),mode=norm(parts[0]??"");
  if(!mode||mode==="list")return truncate(`📘 Blueprints | Fragments ${amt(p.blueprintFragments)} | ${BLUEPRINTS.map(x=>`${p.blueprints[x.id]?"✅":"⬜"} ${x.id}(${x.cost})`).join(" | ")} | !blueprints guide`);
  if(mode==="guide"||mode==="help")return"📘 Guide | Earn Fragments from bosses/Blueprint Rain/Market → unlock blueprint_assembly → !blueprints info <id> → !blueprints assemble <id>.";
  if(mode==="assemble"||mode==="unlock"){const x=findBlueprint(parts.slice(1).join(" "));if(!x)return"Unknown blueprint.";if(p.blueprints[x.id])return`${x.name} already owned. Effect: ${x.effect}`;if(x.research&&!p.unlockedResearch[x.research])return`${x.name} requires research ${x.research}.`;if(x.scanner&&p.scannerLevel<x.scanner)return`${x.name} requires Scanner Lv.${x.scanner}.`;if(x.core){const core=await getCoreState(channelId,user);if(core.coreTier<x.core)return`${x.name} requires Core ${x.core}. Current ${core.coreTier}.`;}if(p.blueprintFragments<x.cost)return`${x.name} needs ${x.cost} Fragments. You have ${amt(p.blueprintFragments)}.`;p.blueprintFragments-=x.cost;p.blueprints[x.id]=true;await saveP(p);return`✅ Assembled ${x.name}! Effect: ${x.effect}`;}
  if(mode==="info"||mode==="detail")parts.shift();const x=findBlueprint(parts.join(" ")||raw);if(!x)return"Unknown blueprint. Use !blueprints.";
  return truncate(`📘 ${x.name} | ${p.blueprints[x.id]?"Owned ✅":"Not owned ⬜"} | Cost ${x.cost} Fragments${x.core?` | Core ${x.core}+`:""}${x.scanner?` | Scanner ${x.scanner}+`:""} | Effect: ${x.effect} | Sources: ${p.unlockedResearch.blueprint_reading?x.source:"unlock Blueprint Reading"} | !blueprints assemble ${x.id}`);
}

export async function formatRelics(channelId:string,user:NightbotUser|null,raw=""): Promise<string>{
  const p=await getP(channelId,user),parts=raw.trim().split(/\s+/).filter(Boolean),mode=norm(parts[0]??"");
  if(!mode)return truncate(`🧿 Relics | Owned ${p.relics.length}/50 | Equipped ${p.relics.filter(x=>x.equipped).length}/${slots(p)} | Shards ${amt(p.relicShards)} | !relics guide/list/forge/info/equip/upgrade/reroll`);
  if(mode==="guide"||mode==="help")return"🧿 Guide | Earn Shards → !blueprints assemble relic_forge → !relics forge → !relics info 1 → !relics equip 1 → !relics upgrade 1.";
  if(mode==="list"){const page=clamp(Number(parts[1]||1),1,99),size=4,total=Math.max(1,Math.ceil(p.relics.length/size)),safe=Math.min(page,total),shown=p.relics.slice((safe-1)*size,safe*size);return truncate(`🧿 Relics ${safe}/${total}: ${shown.length?shown.map(r=>`${relicRef(p,r)}.${r.equipped?"⭐":""}${r.name} ${r.rarity} L${r.level}`).join(" | "):"None; !relics guide"}`);}
  if(mode==="forge"){if(!p.blueprints.relic_forge)return"Forge requires !blueprints assemble relic_forge.";if(p.relics.length>=50)return"Relic storage full.";const d=relicDiscount(p),shards=discounted(15,d),knowledge=discounted(100,d);if(p.relicShards<shards||p.knowledge<knowledge)return`Forge costs ${shards} Shards + ${knowledge} Knowledge. You have ${amt(p.relicShards)} + ${amt(p.knowledge)}.`;p.relicShards-=shards;p.knowledge-=knowledge;const relic=newRelic();p.relics.push(relic);await saveP(p);return`🧿 Forged #${p.relics.length} ${relic.name} [${relic.rarity}] | ${effectText(p,relic)} | !relics equip ${p.relics.length}`;}
  if(mode==="info"||mode==="detail"){const r=findRelic(p,parts.slice(1).join(" "));if(!r)return"Relic not found. !relics list";return truncate(`🧿 #${relicRef(p,r)} ${r.name} | ${r.rarity} Lv.${r.level}/10 | ${r.equipped?"Equipped ⭐":"Unequipped"} | ${effectText(p,r)} | !relics equip/upgrade/reroll ${relicRef(p,r)}`);}
  if(mode==="equip"){const r=findRelic(p,parts.slice(1).join(" "));if(!r)return"Relic not found.";if(r.equipped)return`${r.name} already equipped.`;if(p.relics.filter(x=>x.equipped).length>=slots(p))return`All ${slots(p)} slot(s) full. Unequip one or research another slot.`;r.equipped=true;await saveP(p);return`⭐ Equipped ${r.name}! ${effectText(p,r)}`;}
  if(mode==="unequip"){if(norm(parts.slice(1).join(" "))==="all"){p.relics.forEach(r=>r.equipped=false);await saveP(p);return"✅ Unequipped all relics.";}const r=findRelic(p,parts.slice(1).join(" "));if(!r)return"Relic not found.";r.equipped=false;await saveP(p);return`✅ Unequipped ${r.name}.`;}
  if(mode==="upgrade"){const r=findRelic(p,parts.slice(1).join(" "));if(!r)return"Relic not found.";if(r.level>=10)return`${r.name} already Lv.10.`;const d=relicDiscount(p),ri=RARITIES.indexOf(r.rarity)+1,shards=discounted(5+r.level*ri*2,d),knowledge=discounted(25+r.level*ri*20,d);if(p.relicShards<shards||p.knowledge<knowledge)return`Upgrade costs ${shards} Shards + ${knowledge} Knowledge.`;p.relicShards-=shards;p.knowledge-=knowledge;r.level+=1;await saveP(p);return`✅ ${r.name} Lv.${r.level}! ${effectText(p,r)}`;}
  if(mode==="reroll")return rerollRelic(channelId,user,parts.slice(1).join(" "));
  const r=findRelic(p,raw);return r?formatRelics(channelId,user,`info ${relicRef(p,r)}`):"Unknown relic command. Use !relics guide.";
}

export async function rerollRelic(channelId:string,user:NightbotUser|null,raw=""){
  const p=await getP(channelId,user);if(!p.unlockedResearch.relic_reforger)return"Rerolls require Relic Reforger research.";const r=findRelic(p,raw);if(!r)return"Relic not found.";
  const d=relicDiscount(p),ri=RARITIES.indexOf(r.rarity)+1,shards=discounted(20+ri*20,d),knowledge=discounted(200+ri*250,d);if(p.relicShards<shards||p.knowledge<knowledge)return`Reroll costs ${shards} Shards + ${knowledge} Knowledge.`;
  p.relicShards-=shards;p.knowledge-=knowledge;const old=r.rarity;r.rarity=nextRarity(r.rarity);p.stats.relicRerolls+=1;await saveP(p);return`🧿 ${r.name}: ${old} → ${r.rarity} | ${effectText(p,r)}`;
}

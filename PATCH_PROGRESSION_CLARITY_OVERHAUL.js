#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const replacements = {"src/lib/activity-of-knowledge-system.ts": "import { Redis } from \"@upstash/redis\";\nimport type { NightbotUser } from \"./nightbot\";\nimport type { RollHitResult } from \"./roll-engine\";\nimport { truncate } from \"./format\";\nimport {\n  getCoreGuideSnapshot,\n  getCoreState,\n  grantCoreMaterials,\n} from \"./core-system\";\n\nlet redis: Redis | null = null;\n\nfunction getRedis(): Redis | null {\n  if (redis) return redis;\n  const url = process.env.UPSTASH_REDIS_REST_URL;\n  const token = process.env.UPSTASH_REDIS_REST_TOKEN;\n  if (!url || !token) return null;\n  redis = new Redis({ url, token });\n  return redis;\n}\n\ntype Branch =\n  | \"archive\"\n  | \"crafting\"\n  | \"core\"\n  | \"relic\"\n  | \"scanner\"\n  | \"boss\"\n  | \"market\"\n  | \"blueprint\"\n  | \"forecast\";\n\ntype ResearchNode = {\n  id: string;\n  branch: Branch;\n  name: string;\n  effect: string;\n  cost: number;\n  requires?: string[];\n  coreRequired?: number;\n  scannerLevel?: number;\n};\n\ntype Boss = {\n  id: string;\n  name: string;\n  hp: number;\n  maxHp: number;\n  startedAt: number;\n  endsAt: number;\n  participants: Record<string, { name: string; damage: number }>;\n  defeated: boolean;\n};\n\ntype WorldEvent = {\n  id: string;\n  name: string;\n  description: string;\n  rarity: \"common\" | \"rare\" | \"legendary\";\n  effect:\n    | \"materials\"\n    | \"knowledge\"\n    | \"relics\"\n    | \"blueprints\"\n    | \"market\"\n    | \"boss\"\n    | \"scanner\";\n  startedAt: number;\n  endsAt: number;\n};\n\ntype Forecast = {\n  date: string;\n  text: string;\n  confidence: \"low\" | \"medium\" | \"high\";\n  generatedAt: number;\n};\n\ntype MarketItem = {\n  id: string;\n  name: string;\n  baseCost: number;\n  reward: string;\n  research?: string;\n};\n\ntype ChannelState = {\n  channelId: string;\n  channelName: string;\n  boss: Boss | null;\n  worldEvent: WorldEvent | null;\n  forecast: Forecast | null;\n  marketDate: string | null;\n  marketItems: MarketItem[];\n  stats: {\n    bossesDefeated: number;\n    worldEventsStarted: number;\n    globalQuestCompletions: number;\n  };\n  updatedAt: number;\n};\n\ntype RelicRarity =\n  | \"common\"\n  | \"uncommon\"\n  | \"rare\"\n  | \"epic\"\n  | \"mythic\"\n  | \"astral\"\n  | \"glitched\"\n  | \"forbidden\";\n\ntype RelicEffect =\n  | \"knowledge\"\n  | \"boss_damage\"\n  | \"merchant_marks\"\n  | \"market_discount\"\n  | \"blueprint_find\"\n  | \"relic_shards\"\n  | \"scanner\";\n\ntype Relic = {\n  id: string;\n  name: string;\n  rarity: RelicRarity;\n  level: number;\n  equipped: boolean;\n  effect?: RelicEffect;\n};\n\ntype PlayerState = {\n  channelId: string;\n  userId: string;\n  displayName: string;\n  knowledge: number;\n  merchantMarks: number;\n  relicShards: number;\n  blueprintFragments: number;\n  scannerLevel: number;\n  unlockedResearch: Record<string, boolean>;\n  blueprints: Record<string, boolean>;\n  relics: Relic[];\n  stats: {\n    bossDamage: number;\n    bossKills: number;\n    knowledgeEarned: number;\n    worldEventsSeen: number;\n    relicRerolls: number;\n  };\n  updatedAt: number;\n};\n\ntype Blueprint = {\n  id: string;\n  name: string;\n  cost: number;\n  source: string;\n  effect: string;\n  research?: string;\n  scanner?: number;\n  core?: number;\n};\n\nconst PCACHE = new Map<string, { expiresAt: number; value: PlayerState }>();\nconst CCACHE = new Map<string, { expiresAt: number; value: ChannelState }>();\nconst CACHE_MS = 3500;\nconst EVENT_CHANCE = 1 / 250;\nconst EVENT_MIN_MS = 25 * 60 * 1000;\n\nconst BRANCHES: Branch[] = [\n  \"archive\",\n  \"crafting\",\n  \"core\",\n  \"relic\",\n  \"scanner\",\n  \"boss\",\n  \"market\",\n  \"blueprint\",\n  \"forecast\",\n];\n\nconst BRANCH_NAMES: Record<Branch, string> = {\n  archive: \"Knowledge Income\",\n  crafting: \"Workshop Supplies\",\n  core: \"Core Guidance\",\n  relic: \"Relics\",\n  scanner: \"Scanner\",\n  boss: \"Boss Damage\",\n  market: \"Marketplace\",\n  blueprint: \"Blueprints\",\n  forecast: \"Forecast\",\n};\n\nconst BRANCH_HELP: Record<Branch, string> = {\n  archive: \"Increase Knowledge earned from rare rolls.\",\n  crafting: \"Make Activity Market material packs larger.\",\n  core: \"Reveal your Core path and upcoming wall.\",\n  relic: \"Unlock slots, stronger effects, and rerolls.\",\n  scanner: \"Reveal useful live information and next actions.\",\n  boss: \"Increase damage dealt to bosses.\",\n  market: \"Unlock offers and lower prices.\",\n  blueprint: \"Reveal sources and assemble permanent upgrades.\",\n  forecast: \"Improve the daily recommendation.\",\n};\n\nconst TREE: ResearchNode[] = [\n  { id: \"archive_memory_1\", branch: \"archive\", name: \"Archive Memory I\", effect: \"+10% Knowledge from rare rolls.\", cost: 30 },\n  { id: \"archive_memory_2\", branch: \"archive\", name: \"Archive Memory II\", effect: \"Knowledge multiplier becomes +25%.\", cost: 120, requires: [\"archive_memory_1\"] },\n  { id: \"craft_efficiency_1\", branch: \"crafting\", name: \"Workshop Logistics I\", effect: \"Market material packs give +25%.\", cost: 60 },\n  { id: \"craft_efficiency_2\", branch: \"crafting\", name: \"Workshop Logistics II\", effect: \"Market material packs give +50%.\", cost: 180, requires: [\"craft_efficiency_1\"] },\n  { id: \"core_mapping_1\", branch: \"core\", name: \"Core Mapping I\", effect: \"Scanner shows your current Core/path.\", cost: 75 },\n  { id: \"core_mapping_2\", branch: \"core\", name: \"Core Mapping II\", effect: \"Scanner shows the next wall component.\", cost: 250, requires: [\"core_mapping_1\"], coreRequired: 25 },\n  { id: \"boss_damage_1\", branch: \"boss\", name: \"Hunter Training I\", effect: \"+10% boss damage.\", cost: 50 },\n  { id: \"boss_damage_2\", branch: \"boss\", name: \"Hunter Training II\", effect: \"+25% boss damage.\", cost: 150, requires: [\"boss_damage_1\"] },\n  { id: \"boss_damage_3\", branch: \"boss\", name: \"Hunter Training III\", effect: \"+50% boss damage.\", cost: 400, requires: [\"boss_damage_2\"], coreRequired: 25 },\n  { id: \"boss_damage_4\", branch: \"boss\", name: \"Hunter Training IV\", effect: \"+100% boss damage.\", cost: 1000, requires: [\"boss_damage_3\"], coreRequired: 75 },\n  { id: \"boss_damage_5\", branch: \"boss\", name: \"Hunter Training V\", effect: \"+175% boss damage.\", cost: 2500, requires: [\"boss_damage_4\"], coreRequired: 150 },\n  { id: \"boss_damage_6\", branch: \"boss\", name: \"Hunter Training VI\", effect: \"+250% boss damage.\", cost: 6000, requires: [\"boss_damage_5\"], coreRequired: 230 },\n  { id: \"relic_slot_2\", branch: \"relic\", name: \"Relic Slot II\", effect: \"Equip up to 2 relics.\", cost: 200, coreRequired: 25 },\n  { id: \"relic_slot_3\", branch: \"relic\", name: \"Relic Slot III\", effect: \"Equip up to 3 relics.\", cost: 800, requires: [\"relic_slot_2\"], coreRequired: 100 },\n  { id: \"relic_attune_1\", branch: \"relic\", name: \"Relic Attunement I\", effect: \"All equipped relic effects are 5% stronger.\", cost: 300, requires: [\"relic_slot_2\"] },\n  { id: \"relic_attune_2\", branch: \"relic\", name: \"Relic Attunement II\", effect: \"All equipped relic effects are 10% stronger.\", cost: 1000, requires: [\"relic_attune_1\"], coreRequired: 100 },\n  { id: \"relic_reforger\", branch: \"relic\", name: \"Relic Reforger\", effect: \"Unlocks !relics reroll.\", cost: 1500, requires: [\"relic_attune_1\"], coreRequired: 125 },\n  ...Array.from({ length: 10 }, (_, index): ResearchNode => {\n    const level = index + 1;\n    const roman = [\"I\",\"II\",\"III\",\"IV\",\"V\",\"VI\",\"VII\",\"VIII\",\"IX\",\"X\"][index];\n    const costs = [40,120,250,500,850,1400,2200,3200,4500,6500];\n    const cores = [0,5,25,50,75,100,125,150,175,200];\n    const effects = [\n      \"Shows whether Activity signals exist.\",\n      \"Shows active boss information.\",\n      \"Shows rare-signal strength.\",\n      \"Shows active world events.\",\n      \"Shows a recommended next action.\",\n      \"Shows event reward focus.\",\n      \"Connects to Forecast confidence.\",\n      \"Shows blueprint/relic opportunity hints.\",\n      \"Improves signal detail.\",\n      \"Maximum detail; never guarantees RNG.\",\n    ];\n    return {\n      id: `scanner_${level}`,\n      branch: \"scanner\",\n      name: `Scanner ${roman}`,\n      effect: effects[index],\n      cost: costs[index],\n      requires: level > 1 ? [`scanner_${level - 1}`] : undefined,\n      coreRequired: cores[index] || undefined,\n      scannerLevel: level,\n    };\n  }),\n  { id: \"market_contacts_1\", branch: \"market\", name: \"Market Contacts I\", effect: \"Unlocks Relic Shard and Blueprint Fragment offers.\", cost: 150 },\n  { id: \"market_contacts_2\", branch: \"market\", name: \"Market Contacts II\", effect: \"Unlocks Stabilized Supply Packs.\", cost: 500, requires: [\"market_contacts_1\"] },\n  { id: \"market_haggle_1\", branch: \"market\", name: \"Market Haggle I\", effect: \"Activity Market prices are 10% cheaper.\", cost: 900, requires: [\"market_contacts_2\"] },\n  { id: \"blueprint_reading\", branch: \"blueprint\", name: \"Blueprint Reading\", effect: \"Blueprint info reveals exact sources.\", cost: 125 },\n  { id: \"blueprint_assembly\", branch: \"blueprint\", name: \"Blueprint Assembly\", effect: \"Unlocks !blueprints assemble.\", cost: 350, requires: [\"blueprint_reading\"] },\n  { id: \"wall_breaker_1\", branch: \"blueprint\", name: \"Wall Breaker I\", effect: \"+50% Blueprint Fragments from boss defeats.\", cost: 900, requires: [\"blueprint_assembly\"], coreRequired: 75 },\n  { id: \"forecast_1\", branch: \"forecast\", name: \"Forecast I\", effect: \"Forecast considers boss/event state.\", cost: 80 },\n  { id: \"forecast_2\", branch: \"forecast\", name: \"Forecast II\", effect: \"Forecast gives a more specific next command.\", cost: 300, requires: [\"forecast_1\"] },\n  { id: \"forecast_3\", branch: \"forecast\", name: \"Forecast III\", effect: \"Forecast includes Core and blueprint progress.\", cost: 1000, requires: [\"forecast_2\"], coreRequired: 75 },\n];\n\nconst BOSS_RESEARCH: Array<[string, number]> = [\n  [\"boss_damage_1\", 10],\n  [\"boss_damage_2\", 25],\n  [\"boss_damage_3\", 50],\n  [\"boss_damage_4\", 100],\n  [\"boss_damage_5\", 175],\n  [\"boss_damage_6\", 250],\n];\n\nconst BLUEPRINTS: Blueprint[] = [\n  { id: \"biome_lens\", name: \"Biome Lens Blueprint\", cost: 3, source: \"Boss defeats, Blueprint Rain, and Market.\", effect: \"+10% Knowledge during Activity world events.\", research: \"blueprint_assembly\", scanner: 5 },\n  { id: \"relic_forge\", name: \"Relic Forge Blueprint\", cost: 4, source: \"Boss defeats, Relic Echo, and Market.\", effect: \"Unlocks !relics forge.\", research: \"blueprint_assembly\" },\n  { id: \"quantum_press\", name: \"Quantum Press Blueprint\", cost: 6, source: \"Boss defeats and Blueprint Rain.\", effect: \"Relic costs -20%; material packs +25%.\", research: \"blueprint_assembly\", core: 50 },\n  { id: \"boss_beacon\", name: \"Boss Beacon Blueprint\", cost: 7, source: \"Boss defeats and advanced Market contacts.\", effect: \"Unlocks !boss beacon for 150 Marks.\", research: \"blueprint_assembly\", core: 50 },\n  { id: \"archive_terminal\", name: \"Archive Terminal Blueprint\", cost: 8, source: \"Knowledge milestones and major bosses.\", effect: \"+15% Knowledge from rare rolls.\", research: \"archive_memory_2\", core: 75 },\n  { id: \"forbidden_frame\", name: \"Forbidden Frame Blueprint\", cost: 12, source: \"Forbidden Architect and Core 200+.\", effect: \"+50% boss Relic Shard rewards.\", research: \"wall_breaker_1\", core: 200 },\n];\n\nconst RARITIES: RelicRarity[] = [\"common\",\"uncommon\",\"rare\",\"epic\",\"mythic\",\"astral\",\"glitched\",\"forbidden\"];\nconst RELIC_LABELS: Record<RelicEffect, string> = {\n  knowledge: \"Knowledge gain\",\n  boss_damage: \"Boss damage\",\n  merchant_marks: \"Merchant Mark gain\",\n  market_discount: \"Market discount\",\n  blueprint_find: \"Blueprint Fragment chance\",\n  relic_shards: \"Relic Shard rewards\",\n  scanner: \"Scanner signal strength\",\n};\nconst THEMES = [\"Archive\",\"Hunter\",\"Market\",\"Blueprint\",\"Relic\",\"Scanner\",\"Core\",\"Void\",\"Astral\",\"Quantum\",\"Reality\",\"Singularity\"] as const;\nconst TYPES = [\"Lens\",\"Orb\",\"Quill\",\"Fang\",\"Coin\",\"Prism\",\"Compass\",\"Anvil\",\"Shard\",\"Crown\",\"Engine\",\"Beacon\",\"Thread\",\"Gear\",\"Sigil\"] as const;\nconst THEME_EFFECT: Record<string, RelicEffect> = {\n  Archive: \"knowledge\",\n  Hunter: \"boss_damage\",\n  Market: \"market_discount\",\n  Blueprint: \"blueprint_find\",\n  Relic: \"relic_shards\",\n  Scanner: \"scanner\",\n  Core: \"boss_damage\",\n  Void: \"merchant_marks\",\n  Astral: \"knowledge\",\n  Quantum: \"blueprint_find\",\n  Reality: \"merchant_marks\",\n  Singularity: \"relic_shards\",\n};\n\nfunction n(){ return Date.now(); }\nfunction today(){ return new Date().toISOString().slice(0,10); }\nfunction pk(c:string,u:string){ return `aok:player:${c}:${u}`; }\nfunction ck(c:string){ return `aok:channel:${c}`; }\nfunction uid(u:NightbotUser|null){ return u?.providerId ?? \"anon\"; }\nfunction uname(u:NightbotUser|null){ return u?.displayName ?? u?.name ?? \"Player\"; }\nfunction amt(v:number){ return Math.floor(v).toLocaleString(\"en-US\"); }\nfunction clamp(v:number,min:number,max:number){ return Math.max(min,Math.min(max,Math.floor(v||0))); }\nfunction norm(raw:string|undefined|null){ return (raw??\"\").toLowerCase().trim().replace(/^!+/,\"\").replace(/[^a-z0-9]+/g,\"_\").replace(/^_+|_+$/g,\"\"); }\nfunction pick<T>(items:readonly T[]):T{ return items[Math.floor(Math.random()*items.length)]; }\nfunction left(ms:number){ const m=Math.floor(Math.max(0,ms)/60000),h=Math.floor(m/60); return h>0?`${h}h ${m%60}m`:`${m}m`; }\n\nfunction defaultP(c:string,u:NightbotUser|null):PlayerState{\n  return {channelId:c,userId:uid(u),displayName:uname(u),knowledge:0,merchantMarks:0,relicShards:0,blueprintFragments:0,scannerLevel:0,unlockedResearch:{},blueprints:{},relics:[],stats:{bossDamage:0,bossKills:0,knowledgeEarned:0,worldEventsSeen:0,relicRerolls:0},updatedAt:n()};\n}\nfunction inferEffect(r:Partial<Relic>):RelicEffect{\n  if(r.effect)return r.effect;\n  return THEME_EFFECT[String(r.name??\"\").split(/\\s+/)[0]] ?? \"knowledge\";\n}\nfunction normP(x:Partial<PlayerState>|null|undefined,c:string,u:NightbotUser|null):PlayerState{\n  const b=defaultP(c,u); if(!x)return b;\n  return {...b,...x,channelId:c,userId:x.userId??b.userId,displayName:uname(u)||x.displayName||b.displayName,knowledge:clamp(x.knowledge??0,0,Number.MAX_SAFE_INTEGER),merchantMarks:clamp(x.merchantMarks??0,0,Number.MAX_SAFE_INTEGER),relicShards:clamp(x.relicShards??0,0,Number.MAX_SAFE_INTEGER),blueprintFragments:clamp(x.blueprintFragments??0,0,Number.MAX_SAFE_INTEGER),scannerLevel:clamp(x.scannerLevel??0,0,10),unlockedResearch:x.unlockedResearch??{},blueprints:x.blueprints??{},relics:(x.relics??[]).slice(0,50).map((r,i)=>({id:String(r.id??`legacy_${i}`),name:String(r.name??`Relic ${i+1}`),rarity:RARITIES.includes(r.rarity as RelicRarity)?r.rarity as RelicRarity:\"common\",level:clamp(r.level??1,1,10),equipped:Boolean(r.equipped),effect:inferEffect(r)})),stats:{...b.stats,...(x.stats??{})},updatedAt:n()};\n}\nfunction defaultC(c:string,name:string):ChannelState{\n  return {channelId:c,channelName:name,boss:null,worldEvent:null,forecast:null,marketDate:null,marketItems:[],stats:{bossesDefeated:0,worldEventsStarted:0,globalQuestCompletions:0},updatedAt:n()};\n}\nfunction normC(x:Partial<ChannelState>|null|undefined,c:string,name:string):ChannelState{\n  const b=defaultC(c,name); if(!x)return b;\n  return {...b,...x,channelId:c,channelName:name||x.channelName||c,boss:x.boss??null,worldEvent:x.worldEvent??null,forecast:x.forecast??null,marketItems:x.marketItems??[],stats:{...b.stats,...(x.stats??{})},updatedAt:n()};\n}\nasync function getP(c:string,u:NightbotUser|null){ const key=pk(c,uid(u)),cached=PCACHE.get(key); if(cached&&cached.expiresAt>n())return cached.value; const r=getRedis(); if(!r)return defaultP(c,u); const state=normP(await r.get<PlayerState>(key),c,u); PCACHE.set(key,{expiresAt:n()+CACHE_MS,value:state}); return state; }\nasync function saveP(p:PlayerState){ p.updatedAt=n(); PCACHE.set(pk(p.channelId,p.userId),{expiresAt:n()+CACHE_MS,value:p}); const r=getRedis(); if(r)await r.set(pk(p.channelId,p.userId),p); }\nasync function getC(c:string,name=c){ const key=ck(c),cached=CCACHE.get(key); if(cached&&cached.expiresAt>n())return cached.value; const r=getRedis(); if(!r)return defaultC(c,name); const state=normC(await r.get<ChannelState>(key),c,name); CCACHE.set(key,{expiresAt:n()+CACHE_MS,value:state}); return state; }\nasync function saveC(c:ChannelState){ c.updatedAt=n(); CCACHE.set(ck(c.channelId),{expiresAt:n()+CACHE_MS,value:c}); const r=getRedis(); if(r)await r.set(ck(c.channelId),c); }\nfunction boss(c:ChannelState){ const b=c.boss; return !b||b.defeated||b.endsAt<=n()||b.hp<=0?null:b; }\nfunction event(c:ChannelState){ const e=c.worldEvent; return !e||e.endsAt<=n()?null:e; }\n\nfunction findNode(raw:string){ const q=norm(raw); return TREE.find(x=>[x.id,x.name].map(norm).some(v=>v===q||v.replace(/_/g,\"\")===q.replace(/_/g,\"\"))); }\nfunction prereqs(p:PlayerState,node:ResearchNode){ return (node.requires??[]).every(id=>p.unlockedResearch[id]); }\nfunction nextNode(p:PlayerState){ return TREE.filter(x=>!p.unlockedResearch[x.id]&&prereqs(p,x)).sort((a,b)=>a.cost-b.cost).find(x=>x.cost<=p.knowledge) ?? TREE.filter(x=>!p.unlockedResearch[x.id]&&prereqs(p,x)).sort((a,b)=>a.cost-b.cost)[0] ?? null; }\nfunction knowledgeMult(p:PlayerState){ return p.unlockedResearch.archive_memory_2?1.25:p.unlockedResearch.archive_memory_1?1.1:1; }\nfunction bossResearch(p:PlayerState){ let best=0; for(const [id,pct] of BOSS_RESEARCH)if(p.unlockedResearch[id])best=Math.max(best,pct); return best; }\nfunction slots(p:PlayerState){ return p.unlockedResearch.relic_slot_3?3:p.unlockedResearch.relic_slot_2?2:1; }\nfunction attune(p:PlayerState){ return p.unlockedResearch.relic_attune_2?1.1:p.unlockedResearch.relic_attune_1?1.05:1; }\nfunction basePct(r:RelicRarity){ return [2,3,5,8,12,18,28,45][RARITIES.indexOf(r)]; }\nfunction relicPct(p:PlayerState,r:Relic){ return basePct(r.rarity)*(1+(r.level-1)*.12)*attune(p); }\nfunction relicTotal(p:PlayerState,e:RelicEffect){ return p.relics.filter(r=>r.equipped&&inferEffect(r)===e).reduce((s,r)=>s+relicPct(p,r),0); }\nfunction workshop(p:PlayerState){ let m=p.unlockedResearch.craft_efficiency_2?1.5:p.unlockedResearch.craft_efficiency_1?1.25:1; if(p.blueprints.quantum_press)m*=1.25; return m; }\nfunction discount(p:PlayerState){ return Math.min(.35,(p.unlockedResearch.market_haggle_1 ? .1 : 0)+relicTotal(p,\"market_discount\")/100); }\nfunction relicDiscount(p:PlayerState){ return p.blueprints.quantum_press ? .2 : 0; }\nfunction discounted(v:number,d:number){ return Math.max(1,Math.floor(v*(1-d))); }\n\nfunction makeBoss():Boss{\n  const t=pick([{id:\"scrap_titan\",name:\"Scrap Titan\",hp:3500},{id:\"circuit_hydra\",name:\"Circuit Hydra\",hp:6500},{id:\"stardust_warden\",name:\"Stardust Warden\",hp:11000},{id:\"void_leviathan\",name:\"Void Leviathan\",hp:18000},{id:\"glitched_monarch\",name:\"Glitched Monarch\",hp:30000},{id:\"forbidden_architect\",name:\"Forbidden Architect\",hp:50000},{id:\"archive_devourer\",name:\"Archive Devourer\",hp:75000}] as const);\n  return {...t,maxHp:t.hp,startedAt:n(),endsAt:n()+3*60*60*1000,participants:{},defeated:false};\n}\nfunction makeEvent():WorldEvent{\n  const t=pick([\n    {id:\"meteor_shower\",name:\"Meteor Shower\",description:\"Basic material activity is favored.\",effect:\"materials\" as const,rarity:\"common\" as const},\n    {id:\"archive_surge\",name:\"Archive Surge\",description:\"+25% Knowledge from rare rolls.\",effect:\"knowledge\" as const,rarity:\"rare\" as const},\n    {id:\"relic_echo\",name:\"Relic Echo\",description:\"1M+ rolls can find Relic Shards.\",effect:\"relics\" as const,rarity:\"rare\" as const},\n    {id:\"blueprint_rain\",name:\"Blueprint Rain\",description:\"1M+ rolls can find Blueprint Fragments.\",effect:\"blueprints\" as const,rarity:\"rare\" as const},\n    {id:\"market_festival\",name:\"Market Festival\",description:\"+25% Merchant Marks from boss damage.\",effect:\"market\" as const,rarity:\"common\" as const},\n    {id:\"boss_omen\",name:\"Boss Omen\",description:\"+25% boss damage.\",effect:\"boss\" as const,rarity:\"rare\" as const},\n    {id:\"glitched_signal\",name:\"Glitched Signal\",description:\"Scanner signals are stronger.\",effect:\"scanner\" as const,rarity:\"legendary\" as const},\n  ] as const);\n  const duration=t.rarity===\"legendary\"?75*60000:t.rarity===\"rare\"?50*60000:35*60000;\n  return {...t,startedAt:n(),endsAt:n()+Math.max(EVENT_MIN_MS,duration)};\n}\nfunction kFrom(r:number){ if(r>=1e9)return 50;if(r>=1e8)return 25;if(r>=1e7)return 12;if(r>=1e6)return 6;if(r>=1e5)return 3;if(r>=1e4)return 1;return 0; }\nfunction hitDmg(h:RollHitResult){ const r=h.effectiveRarity,tags=(h.aura.tags??[]).map((x: string)=>x.toLowerCase()); let d=1;if(r>=1e4)d+=1;if(r>=1e5)d+=3;if(r>=1e6)d+=5;if(r>=1e7)d+=10;if(r>=1e8)d+=25;if(r>=1e9||tags.includes(\"challenged\")||tags.includes(\"challenged+\"))d+=50;return d; }\n\nfunction findBlueprint(raw:string){ const q=norm(raw); return BLUEPRINTS.find(x=>[x.id,x.name].map(norm).some(v=>v===q||v.replace(/_/g,\"\")===q.replace(/_/g,\"\"))); }\nfunction findRelic(p:PlayerState,raw:string){ const index=Number(raw.trim()); if(Number.isInteger(index)&&index>=1&&index<=p.relics.length)return p.relics[index-1]; const q=norm(raw); return p.relics.find(r=>[r.id,r.name].map(norm).some(v=>v===q||v.replace(/_/g,\"\")===q.replace(/_/g,\"\"))); }\nfunction relicRef(p:PlayerState,r:Relic){ return Math.max(1,p.relics.indexOf(r)+1); }\nfunction effectText(p:PlayerState,r:Relic){ return `+${relicPct(p,r).toFixed(1)}% ${RELIC_LABELS[inferEffect(r)]}`; }\nfunction newRelic():Relic{ const theme=pick(THEMES); return {id:`relic_${n()}_${Math.random().toString(36).slice(2,8)}`,name:`${theme} ${pick(TYPES)}`,rarity:Math.random()<.01?\"epic\":Math.random()<.08?\"rare\":Math.random()<.3?\"uncommon\":\"common\",level:1,equipped:false,effect:THEME_EFFECT[theme]}; }\nfunction nextRarity(r:RelicRarity){ const i=RARITIES.indexOf(r),roll=Math.random(); return RARITIES[clamp(i+(roll<.03?2:roll<.53?1:roll>.92?-1:0),0,RARITIES.length-1)]; }\n\nfunction marketItems(p:PlayerState):MarketItem[]{\n  return [\n    {id:\"scrap_pack\",name:\"Scrap Supply Pack\",baseCost:8,reward:\"100 Scrap, 50 Metal Bits, 10 Mechanical Scrap\"},\n    {id:\"circuit_pack\",name:\"Circuit Supply Pack\",baseCost:20,reward:\"50 Circuit Scrap, 5 Signal Fragments\"},\n    {id:\"knowledge_note\",name:\"Knowledge Note\",baseCost:35,reward:\"25 Knowledge\"},\n    {id:\"relic_shards\",name:\"Relic Shard Bundle\",baseCost:50,reward:\"5 Relic Shards\",research:\"market_contacts_1\"},\n    {id:\"blueprint_fragment\",name:\"Blueprint Fragment\",baseCost:60,reward:\"1 Blueprint Fragment\",research:\"market_contacts_1\"},\n    {id:\"stabilized_pack\",name:\"Stabilized Supply Pack\",baseCost:95,reward:\"30 Refined Alloy, 3 Stabilized Flux\",research:\"market_contacts_2\"},\n  ].filter(x=>!x.research||p.unlockedResearch[x.research]);\n}\n\nexport async function formatKnowledge(channelId:string,user:NightbotUser|null){\n  const p=await getP(channelId,user),next=nextNode(p);\n  return truncate(`🧠 ${p.displayName} | Knowledge ${amt(p.knowledge)} → !research | Marks ${amt(p.merchantMarks)} → !market | Relic Shards ${amt(p.relicShards)} → !relics guide | Blueprint Fragments ${amt(p.blueprintFragments)} → !blueprints guide | Next: ${next?`${next.name} (${amt(next.cost)}): !research next`:\"Research complete\"}`);\n}\n\nexport async function formatResearch(channelId:string,user:NightbotUser|null,raw=\"\"){\n  const p=await getP(channelId,user),parts=raw.trim().split(/\\s+/).filter(Boolean),mode=norm(parts[0]??\"\");\n  if(!mode||mode===\"help\"||mode===\"guide\")return truncate(`🧠 Research Guide | Earn Knowledge from 1/10k+ rolls → !research next → !research info <id> → !research unlock <id>. Current: ${amt(p.knowledge)} Knowledge.`);\n  if(mode===\"branches\"||mode===\"tree\")return truncate(`🧠 Branches: ${BRANCHES.map(b=>`${b}=${BRANCH_NAMES[b]}`).join(\" | \")} | Open: !research scanner`);\n  if(mode===\"next\"||mode===\"recommend\"){const x=nextNode(p);if(!x)return\"✅ All research unlocked.\";return truncate(`🧠 Recommended: ${x.name} | ${p.knowledge>=x.cost?\"Affordable now\":`Need ${amt(x.cost-p.knowledge)} more Knowledge`} | Effect: ${x.effect} | Command: !research unlock ${x.id}`);}\n  if(mode===\"info\"||mode===\"detail\"){const x=findNode(parts.slice(1).join(\" \"));if(!x)return\"Unknown research. Use !research branches.\";return truncate(`🧠 ${x.name} | ${p.unlockedResearch[x.id]?\"Unlocked ✅\":\"Locked ⬜\"} | Cost ${amt(x.cost)} Knowledge${x.coreRequired?` | Core ${x.coreRequired}+`:\"\"}${x.requires?.length?` | Requires ${x.requires.join(\", \")}`:\"\"} | Effect: ${x.effect}`);}\n  if(BRANCHES.includes(mode as Branch)){const b=mode as Branch,nodes=TREE.filter(x=>x.branch===b),page=clamp(Number(parts[1]||1),1,99),size=4,total=Math.max(1,Math.ceil(nodes.length/size)),safe=Math.min(page,total),shown=nodes.slice((safe-1)*size,safe*size);return truncate(`🧠 ${BRANCH_NAMES[b]} ${safe}/${total} | ${BRANCH_HELP[b]} | ${shown.map(x=>`${p.unlockedResearch[x.id]?\"✅\":prereqs(p,x)?p.knowledge>=x.cost?\"🟢\":\"⬜\":\"🔒\"} ${x.id} ${amt(x.cost)}`).join(\" | \")} | !research info <id>`);}\n  const direct=findNode(raw);if(direct)return truncate(`🧠 ${direct.name} | ${p.unlockedResearch[direct.id]?\"Unlocked ✅\":\"Locked ⬜\"} | Cost ${amt(direct.cost)} | Effect: ${direct.effect} | !research unlock ${direct.id}`);\n  return\"Unknown research command. Use !research guide, next, or branches.\";\n}\n\nexport async function unlockResearch(channelId:string,user:NightbotUser|null,rawId:string){\n  const node=findNode(rawId);if(!node)return\"Unknown research. Use !research next.\";\n  const p=await getP(channelId,user);if(p.unlockedResearch[node.id])return`${node.name} already unlocked. Effect: ${node.effect}`;\n  for(const req of node.requires??[])if(!p.unlockedResearch[req])return`${node.name} requires ${findNode(req)?.name??req} first.`;\n  if(node.coreRequired){const core=await getCoreState(channelId,user);if(core.coreTier<node.coreRequired)return`${node.name} requires Core ${node.coreRequired}. Current: ${core.coreTier}.`;}\n  if(p.knowledge<node.cost)return`${node.name} needs ${amt(node.cost)} Knowledge. You have ${amt(p.knowledge)}; need ${amt(node.cost-p.knowledge)} more.`;\n  p.knowledge-=node.cost;p.unlockedResearch[node.id]=true;if(node.scannerLevel)p.scannerLevel=Math.max(p.scannerLevel,node.scannerLevel);await saveP(p);\n  return`✅ Unlocked ${node.name}! Effect active: ${node.effect}`;\n}\n\nexport async function formatScanner(channelId:string,channelName:string,user:NightbotUser|null){\n  const [p,c]=await Promise.all([getP(channelId,user),getC(channelId,channelName)]);if(p.scannerLevel<=0)return\"📡 Scanner locked. Earn 40 Knowledge, then !research unlock scanner_1.\";\n  const e=event(c),b=boss(c),parts=[`📡 Scanner Lv.${p.scannerLevel}/10`];\n  if(p.scannerLevel>=2)parts.push(`Boss: ${b?`${b.name} ${amt(b.hp)}/${amt(b.maxHp)} HP`:\"none\"}`);\n  if(p.scannerLevel>=3)parts.push(`Signal: ${e?.rarity===\"legendary\"||relicTotal(p,\"scanner\")>=10?\"High\":e?.rarity===\"rare\"?\"Medium\":\"Low\"}`);\n  if(p.scannerLevel>=4)parts.push(`Event: ${e?`${e.name} ${left(e.endsAt-n())}`:\"none\"}`);\n  if(p.unlockedResearch.core_mapping_1&&p.scannerLevel>=4){const s=await getCoreGuideSnapshot(channelId,user);parts.push(`Core: ${s.path} ${s.currentTier}`);if(p.unlockedResearch.core_mapping_2&&p.scannerLevel>=5)parts.push(`Next: Core ${s.nextTier}${s.isWall?` wall ${s.wallComponent}`:\"\"}`);}\n  if(p.scannerLevel>=5)parts.push(`Do now: ${b?\"roll to damage boss\":e?.effect===\"knowledge\"?\"roll 1/10k+ for boosted Knowledge\":e?.effect===\"relics\"?\"roll 1M+ for Shards\":e?.effect===\"blueprints\"?\"roll 1M+ for Fragments\":\"use !research next\"}`);\n  if(p.scannerLevel<10)parts.push(`Upgrade: !research unlock scanner_${p.scannerLevel+1}`);\n  return truncate(parts.join(\" | \"));\n}\n\nexport async function formatWorldEvent(channelId:string,channelName:string){const c=await getC(channelId,channelName),e=event(c);return e?truncate(`🌍 ${e.name} (${e.rarity}) | ${e.description} | Left ${left(e.endsAt-n())}`):\"🌍 No Activity world event. Use !scanner or !forecast.\";}\nexport async function maybeStartActivityWorldEvent(o:{channelId:string;channelName:string;biomeId:string}){if(Math.random()>=EVENT_CHANCE)return{started:false,message:null as string|null};const c=await getC(o.channelId,o.channelName);if(event(c))return{started:false,message:null as string|null};const e=makeEvent();c.worldEvent=e;c.stats.worldEventsStarted+=1;await saveC(c);return{started:true,message:`🌍 Activity Event: ${e.name} started for ${left(e.endsAt-e.startedAt)}! ${e.description}`};}\n\nexport async function formatForecast(channelId:string,channelName:string,user:NightbotUser|null=null){\n  const [c,p]=await Promise.all([getC(channelId,channelName),getP(channelId,user)]);if(!p.unlockedResearch.forecast_1)return\"🔮 Forecast locked. Use !research unlock forecast_1.\";\n  const e=event(c),b=boss(c);let confidence:Forecast[\"confidence\"]=b||e?\"medium\":\"low\";if(p.unlockedResearch.forecast_3&&p.scannerLevel>=7)confidence=b||e?\"high\":\"medium\";\n  let tip=b?`Roll now to damage ${b.name}.`:e?.effect===\"knowledge\"?\"Roll 1/10k+ for boosted Knowledge.\":e?.effect===\"relics\"?\"Roll 1M+ for Relic Shards.\":e?.effect===\"blueprints\"?\"Roll 1M+ for Blueprint Fragments.\":\"Use !research next and keep rolling.\";\n  if(p.unlockedResearch.forecast_3){const s=await getCoreGuideSnapshot(channelId,user);if(s.isWall)tip+=` Prepare ${s.wallComponent} for Core ${s.nextTier}.`;}\n  const text=`🔮 Forecast (${confidence}) | ${tip}`;c.forecast={date:today(),text,confidence,generatedAt:n()};await saveC(c);return truncate(text);\n}\n\nexport async function formatBoss(channelId:string,channelName:string){const c=await getC(channelId,channelName),b=c.boss;if(!b)return\"🐉 No boss active. Mods: !boss start | Boss Beacon owners: !boss beacon\";if(b.defeated||b.hp<=0)return`🏆 ${b.name} defeated!`;if(b.endsAt<=n())return`⌛ ${b.name} expired.`;const top=Object.values(b.participants).sort((a,b)=>b.damage-a.damage).slice(0,3).map(x=>`${x.name} ${amt(x.damage)}`).join(\", \");return truncate(`🐉 ${b.name} | HP ${amt(b.hp)}/${amt(b.maxHp)} | Left ${left(b.endsAt-n())} | Roll to damage | Top: ${top||\"none\"}`);}\nexport async function startBoss(channelId:string,channelName:string){const c=await getC(channelId,channelName),cur=boss(c);if(cur)return`${cur.name} already active. HP ${amt(cur.hp)}/${amt(cur.maxHp)}.`;c.boss=makeBoss();await saveC(c);return`🐉 Boss started: ${c.boss.name}! HP ${amt(c.boss.maxHp)}.`;}\nexport async function startBossWithBeacon(channelId:string,channelName:string,user:NightbotUser|null){const [c,p]=await Promise.all([getC(channelId,channelName),getP(channelId,user)]);if(!p.blueprints.boss_beacon)return\"Boss Beacon requires !blueprints assemble boss_beacon.\";const cur=boss(c);if(cur)return`${cur.name} already active.`;if(p.merchantMarks<150)return`Boss Beacon costs 150 Marks. You have ${amt(p.merchantMarks)}.`;p.merchantMarks-=150;c.boss=makeBoss();await Promise.all([saveP(p),saveC(c)]);return`📡 Boss Beacon used! ${c.boss.name} started for 150 Marks.`;}\n\nexport async function recordActivityRolls(o:{channelId:string;channelName:string;user:NightbotUser|null;results:RollHitResult[]}){\n  if(!o.user||o.results.length===0)return;const best=Math.max(...o.results.map(r=>r.effectiveRarity)),baseK=kFrom(best),c=await getC(o.channelId,o.channelName),b=boss(c),e=event(c);if(!b&&!e&&baseK<=0)return;\n  const p=await getP(o.channelId,o.user);let sp=false,sc=false;\n  if(baseK>0){let m=knowledgeMult(p)*(1+relicTotal(p,\"knowledge\")/100);if(e?.effect===\"knowledge\")m*=1.25;if(e&&p.blueprints.biome_lens)m*=1.1;if(p.blueprints.archive_terminal)m*=1.15;const gain=Math.max(1,Math.floor(baseK*m));p.knowledge+=gain;p.stats.knowledgeEarned+=gain;sp=true;}\n  if(e&&p.stats.worldEventsSeen===0){p.stats.worldEventsSeen=1;sp=true;}\n  if(e?.effect===\"relics\"&&best>=1e6&&Math.random()<.15+Math.min(.25,relicTotal(p,\"relic_shards\")/100)){p.relicShards+=1;sp=true;}\n  if(e?.effect===\"blueprints\"&&best>=1e6&&Math.random()<.12+Math.min(.25,relicTotal(p,\"blueprint_find\")/100)){p.blueprintFragments+=1;sp=true;}\n  if(b){const base=o.results.reduce((s,r)=>s+hitDmg(r),0),mult=(1+bossResearch(p)/100+relicTotal(p,\"boss_damage\")/100)*(e?.effect===\"boss\"?1.25:1),damage=Math.max(1,Math.floor(base*mult));b.hp=Math.max(0,b.hp-damage);const ent=b.participants[p.userId]??{name:p.displayName,damage:0};ent.name=p.displayName;ent.damage+=damage;b.participants[p.userId]=ent;p.stats.bossDamage+=damage;let marks=Math.max(1,Math.floor(damage/25)*(1+relicTotal(p,\"merchant_marks\")/100));if(e?.effect===\"market\")marks*=1.25;p.merchantMarks+=Math.max(1,Math.floor(marks));sp=sc=true;if(b.hp<=0&&!b.defeated){b.defeated=true;c.stats.bossesDefeated+=1;p.stats.bossKills+=1;p.knowledge+=100;p.blueprintFragments+=Math.max(1,Math.floor(2*(p.unlockedResearch.wall_breaker_1||p.blueprints.forbidden_frame?1.5:1)));p.relicShards+=Math.max(1,Math.floor(5*(p.blueprints.forbidden_frame?1.5:1)*(1+relicTotal(p,\"relic_shards\")/100)));}}\n  await Promise.all([sp?saveP(p):Promise.resolve(),sc?saveC(c):Promise.resolve()]);\n}\n\nexport async function formatMarket(channelId:string,channelName:string,user:NightbotUser|null=null){const [c,p]=await Promise.all([getC(channelId,channelName),getP(channelId,user)]),items=marketItems(p);c.marketDate=today();c.marketItems=items;await saveC(c);return truncate(`🏪 Market | Marks ${amt(p.merchantMarks)} | ${items.map(x=>`${x.id} ${discounted(x.baseCost,discount(p))}`).join(\" | \")} | !market buy <id>`);}\nexport async function buyMarketItem(channelId:string,channelName:string,user:NightbotUser|null,itemId:string){\n  const [c,p]=await Promise.all([getC(channelId,channelName),getP(channelId,user)]),item=marketItems(p).find(x=>x.id===norm(itemId));if(!item)return\"Unknown/locked item. Use !market.\";const cost=discounted(item.baseCost,discount(p));if(p.merchantMarks<cost)return`${item.name} costs ${cost} Marks. You have ${amt(p.merchantMarks)}.`;p.merchantMarks-=cost;let reward=\"\";\n  if(item.id===\"knowledge_note\"){p.knowledge+=25;reward=\"25 Knowledge\";}else if(item.id===\"relic_shards\"){p.relicShards+=5;reward=\"5 Relic Shards\";}else if(item.id===\"blueprint_fragment\"){p.blueprintFragments+=1;reward=\"1 Blueprint Fragment\";}else{const m=workshop(p),materials:Record<string,number>=item.id===\"scrap_pack\"?{scrap:Math.floor(100*m),metal_bits:Math.floor(50*m),mechanical_scrap:Math.floor(10*m)}:item.id===\"circuit_pack\"?{circuit_scrap:Math.floor(50*m),signal_fragment:Math.floor(5*m)}:{refined_alloy:Math.floor(30*m),stabilized_flux:Math.floor(3*m)};await grantCoreMaterials(channelId,user,materials);reward=Object.entries(materials).map(([id,v])=>`${amt(v)} ${id.replace(/_/g,\" \")}`).join(\", \");}\n  c.marketDate=today();c.marketItems=marketItems(p);await Promise.all([saveP(p),saveC(c)]);return`✅ Bought ${item.name} for ${cost} Marks. Received ${reward}.`;\n}\n\nexport async function formatBlueprints(channelId:string,user:NightbotUser|null,raw=\"\"){\n  const p=await getP(channelId,user),parts=raw.trim().split(/\\s+/).filter(Boolean),mode=norm(parts[0]??\"\");\n  if(!mode||mode===\"list\")return truncate(`📘 Blueprints | Fragments ${amt(p.blueprintFragments)} | ${BLUEPRINTS.map(x=>`${p.blueprints[x.id]?\"✅\":\"⬜\"} ${x.id}(${x.cost})`).join(\" | \")} | !blueprints guide`);\n  if(mode===\"guide\"||mode===\"help\")return\"📘 Guide | Earn Fragments from bosses/Blueprint Rain/Market → unlock blueprint_assembly → !blueprints info <id> → !blueprints assemble <id>.\";\n  if(mode===\"assemble\"||mode===\"unlock\"){const x=findBlueprint(parts.slice(1).join(\" \"));if(!x)return\"Unknown blueprint.\";if(p.blueprints[x.id])return`${x.name} already owned. Effect: ${x.effect}`;if(x.research&&!p.unlockedResearch[x.research])return`${x.name} requires research ${x.research}.`;if(x.scanner&&p.scannerLevel<x.scanner)return`${x.name} requires Scanner Lv.${x.scanner}.`;if(x.core){const core=await getCoreState(channelId,user);if(core.coreTier<x.core)return`${x.name} requires Core ${x.core}. Current ${core.coreTier}.`;}if(p.blueprintFragments<x.cost)return`${x.name} needs ${x.cost} Fragments. You have ${amt(p.blueprintFragments)}.`;p.blueprintFragments-=x.cost;p.blueprints[x.id]=true;await saveP(p);return`✅ Assembled ${x.name}! Effect: ${x.effect}`;}\n  if(mode===\"info\"||mode===\"detail\")parts.shift();const x=findBlueprint(parts.join(\" \")||raw);if(!x)return\"Unknown blueprint. Use !blueprints.\";\n  return truncate(`📘 ${x.name} | ${p.blueprints[x.id]?\"Owned ✅\":\"Not owned ⬜\"} | Cost ${x.cost} Fragments${x.core?` | Core ${x.core}+`:\"\"}${x.scanner?` | Scanner ${x.scanner}+`:\"\"} | Effect: ${x.effect} | Sources: ${p.unlockedResearch.blueprint_reading?x.source:\"unlock Blueprint Reading\"} | !blueprints assemble ${x.id}`);\n}\n\nexport async function formatRelics(channelId:string,user:NightbotUser|null,raw=\"\"): Promise<string>{\n  const p=await getP(channelId,user),parts=raw.trim().split(/\\s+/).filter(Boolean),mode=norm(parts[0]??\"\");\n  if(!mode)return truncate(`🧿 Relics | Owned ${p.relics.length}/50 | Equipped ${p.relics.filter(x=>x.equipped).length}/${slots(p)} | Shards ${amt(p.relicShards)} | !relics guide/list/forge/info/equip/upgrade/reroll`);\n  if(mode===\"guide\"||mode===\"help\")return\"🧿 Guide | Earn Shards → !blueprints assemble relic_forge → !relics forge → !relics info 1 → !relics equip 1 → !relics upgrade 1.\";\n  if(mode===\"list\"){const page=clamp(Number(parts[1]||1),1,99),size=4,total=Math.max(1,Math.ceil(p.relics.length/size)),safe=Math.min(page,total),shown=p.relics.slice((safe-1)*size,safe*size);return truncate(`🧿 Relics ${safe}/${total}: ${shown.length?shown.map(r=>`${relicRef(p,r)}.${r.equipped?\"⭐\":\"\"}${r.name} ${r.rarity} L${r.level}`).join(\" | \"):\"None; !relics guide\"}`);}\n  if(mode===\"forge\"){if(!p.blueprints.relic_forge)return\"Forge requires !blueprints assemble relic_forge.\";if(p.relics.length>=50)return\"Relic storage full.\";const d=relicDiscount(p),shards=discounted(15,d),knowledge=discounted(100,d);if(p.relicShards<shards||p.knowledge<knowledge)return`Forge costs ${shards} Shards + ${knowledge} Knowledge. You have ${amt(p.relicShards)} + ${amt(p.knowledge)}.`;p.relicShards-=shards;p.knowledge-=knowledge;const relic=newRelic();p.relics.push(relic);await saveP(p);return`🧿 Forged #${p.relics.length} ${relic.name} [${relic.rarity}] | ${effectText(p,relic)} | !relics equip ${p.relics.length}`;}\n  if(mode===\"info\"||mode===\"detail\"){const r=findRelic(p,parts.slice(1).join(\" \"));if(!r)return\"Relic not found. !relics list\";return truncate(`🧿 #${relicRef(p,r)} ${r.name} | ${r.rarity} Lv.${r.level}/10 | ${r.equipped?\"Equipped ⭐\":\"Unequipped\"} | ${effectText(p,r)} | !relics equip/upgrade/reroll ${relicRef(p,r)}`);}\n  if(mode===\"equip\"){const r=findRelic(p,parts.slice(1).join(\" \"));if(!r)return\"Relic not found.\";if(r.equipped)return`${r.name} already equipped.`;if(p.relics.filter(x=>x.equipped).length>=slots(p))return`All ${slots(p)} slot(s) full. Unequip one or research another slot.`;r.equipped=true;await saveP(p);return`⭐ Equipped ${r.name}! ${effectText(p,r)}`;}\n  if(mode===\"unequip\"){if(norm(parts.slice(1).join(\" \"))===\"all\"){p.relics.forEach(r=>r.equipped=false);await saveP(p);return\"✅ Unequipped all relics.\";}const r=findRelic(p,parts.slice(1).join(\" \"));if(!r)return\"Relic not found.\";r.equipped=false;await saveP(p);return`✅ Unequipped ${r.name}.`;}\n  if(mode===\"upgrade\"){const r=findRelic(p,parts.slice(1).join(\" \"));if(!r)return\"Relic not found.\";if(r.level>=10)return`${r.name} already Lv.10.`;const d=relicDiscount(p),ri=RARITIES.indexOf(r.rarity)+1,shards=discounted(5+r.level*ri*2,d),knowledge=discounted(25+r.level*ri*20,d);if(p.relicShards<shards||p.knowledge<knowledge)return`Upgrade costs ${shards} Shards + ${knowledge} Knowledge.`;p.relicShards-=shards;p.knowledge-=knowledge;r.level+=1;await saveP(p);return`✅ ${r.name} Lv.${r.level}! ${effectText(p,r)}`;}\n  if(mode===\"reroll\")return rerollRelic(channelId,user,parts.slice(1).join(\" \"));\n  const r=findRelic(p,raw);return r?formatRelics(channelId,user,`info ${relicRef(p,r)}`):\"Unknown relic command. Use !relics guide.\";\n}\n\nexport async function rerollRelic(channelId:string,user:NightbotUser|null,raw=\"\"){\n  const p=await getP(channelId,user);if(!p.unlockedResearch.relic_reforger)return\"Rerolls require Relic Reforger research.\";const r=findRelic(p,raw);if(!r)return\"Relic not found.\";\n  const d=relicDiscount(p),ri=RARITIES.indexOf(r.rarity)+1,shards=discounted(20+ri*20,d),knowledge=discounted(200+ri*250,d);if(p.relicShards<shards||p.knowledge<knowledge)return`Reroll costs ${shards} Shards + ${knowledge} Knowledge.`;\n  p.relicShards-=shards;p.knowledge-=knowledge;const old=r.rarity;r.rarity=nextRarity(r.rarity);p.stats.relicRerolls+=1;await saveP(p);return`🧿 ${r.name}: ${old} → ${r.rarity} | ${effectText(p,r)}`;\n}\n", "src/lib/progression-info.ts": "import { truncate } from \"./format\";\n\ninterface GuideEntry {\n  id: string;\n  name: string;\n  aliases?: string[];\n  obtain: string;\n  use: string;\n  command?: string;\n}\n\nconst MATERIALS: GuideEntry[] = [\n  { id:\"scrap\", name:\"Scrap\", obtain:\"Every successful aura roll; Starter Boxes; quests; Activity Market Scrap Packs.\", use:\"Basic components, chassis, frames, and early wall components.\" },\n  { id:\"metal_bits\", name:\"Metal Bits\", aliases:[\"metal\",\"bits\"], obtain:\"Every successful aura roll; Activity Market Scrap Packs.\", use:\"Basic components, chassis, and frames.\" },\n  { id:\"mechanical_scrap\", name:\"Mechanical Scrap\", aliases:[\"mechanical\"], obtain:\"Guaranteed 1 every 5 successful aura rolls; Activity Market Scrap Packs.\", use:\"Early components, chassis, and frames.\" },\n  { id:\"circuit_scrap\", name:\"Circuit Scrap\", aliases:[\"circuit\"], obtain:\"Any 1/450+ aura; Daily Crafting; Starter Boxes; Activity Market Circuit Packs.\", use:\"Electronics and Core 16–49 path-wall components.\" },\n  { id:\"signal_fragment\", name:\"Signal Fragment\", aliases:[\"signal\"], obtain:\"Any 1/10,000+ aura; quests; boxes; Activity Market Circuit Packs.\", use:\"Mid-tier electronics, SHD, and early path walls.\" },\n  { id:\"refined_alloy\", name:\"Refined Alloy\", aliases:[\"refined\"], obtain:\"Any 1/50,000+ aura; quests; Core/Quest Boxes; Activity Market packs.\", use:\"Tier 5+ crafting and Core 16–89 path walls.\" },\n  { id:\"stabilized_flux\", name:\"Stabilized Flux\", aliases:[\"flux\"], obtain:\"Any 1/1,000,000+ aura; weekly quests; Core Boxes; Activity Market advanced packs.\", use:\"Tier 6+ crafting and Core 50–129 path walls.\" },\n  { id:\"chrono_dust\", name:\"Chrono Dust\", aliases:[\"chrono\"], obtain:\"Any 1/5,000,000+ aura.\", use:\"Core 90–129 path-wall components and time recipes.\" },\n  { id:\"quantum_residue\", name:\"Quantum Residue\", aliases:[\"quantum\"], obtain:\"Any 1/10,000,000+ aura; weekly rare quest; Reactor Boxes.\", use:\"Tier 7+ crafting and Core 90–169 path walls.\" },\n  { id:\"void_glass\", name:\"Void Glass\", aliases:[\"void\"], obtain:\"Any 1/25,000,000+ aura.\", use:\"Biome and dimensional crafting.\" },\n  { id:\"stellar_ink\", name:\"Stellar Ink\", aliases:[\"stellar\",\"ink\"], obtain:\"Any 1/75,000,000+ aura.\", use:\"Biome, blueprint, and stellar crafting.\" },\n  { id:\"reality_thread\", name:\"Reality Thread\", aliases:[\"reality\",\"thread\"], obtain:\"Any 1/100,000,000+ aura; weekly rare quest; Reactor Boxes.\", use:\"Tier 8+ crafting and Core 130–219 path walls.\" },\n  { id:\"dimensional_seal\", name:\"Dimensional Seal\", aliases:[\"seal\",\"dimensional\"], obtain:\"Any 1/250,000,000+ aura; Anomaly Boxes.\", use:\"Late path-wall and dimensional recipes.\" },\n  { id:\"anomaly_matter\", name:\"Anomaly Matter\", aliases:[\"anomaly\"], obtain:\"Any 1/500,000,000+ aura; Anomaly Boxes; Dev Boxes.\", use:\"Core 170+ path walls and anomaly crafting.\" },\n  { id:\"singularity_shard\", name:\"Singularity Shard\", aliases:[\"singularity\",\"shard\"], obtain:\"Any 1/1,000,000,000+ aura.\", use:\"Core 170+ wall components and singularity recipes.\" },\n  { id:\"glitched_alloy\", name:\"Glitched Alloy\", aliases:[\"glitched\"], obtain:\"Any 1/1,000,000,000+ aura.\", use:\"Final Core 220–250 path-wall components.\" },\n  { id:\"forbidden_circuit\", name:\"Forbidden Circuit\", aliases:[\"forbidden\"], obtain:\"Any 1/5,000,000,000+ aura; Anomaly Boxes.\", use:\"Only final Core 220–250 wall components and Forbidden recipes.\" },\n  { id:\"thermal_paste\", name:\"Thermal Paste\", aliases:[\"thermal\",\"paste\"], obtain:\"Special event, market, blueprint, or future reward rotations.\", use:\"Optional advanced electronics; not required by early Core walls.\" },\n  { id:\"conductive_gel\", name:\"Conductive Gel\", aliases:[\"conductive\",\"gel\"], obtain:\"Special event, market, blueprint, or future reward rotations.\", use:\"Optional support electronics; not required by early Core walls.\" },\n  { id:\"energy_cell\", name:\"Energy Cell\", aliases:[\"energy\"], obtain:\"Special event, market, blueprint, or future reward rotations.\", use:\"Optional power recipes; not required by early Core walls.\" },\n  { id:\"debug_fragment\", name:\"Debug Fragment\", aliases:[\"debug\"], obtain:\"Developer/admin rewards only.\", use:\"Developer-exclusive recipes.\" },\n];\n\nconst TOKENS: GuideEntry[] = [\n  { id:\"recipe_token\", name:\"Recipe Token\", aliases:[\"recipe\"], obtain:\"Weekly quests, achievements, Core/Anomaly/Reactor Boxes, and events.\", use:\"Consumed automatically by high-tier component, Core, SHD, and Reactor recipes.\", command:\"!core token recipe\" },\n  { id:\"path_token\", name:\"Path Token\", aliases:[\"path\"], obtain:\"Core 15 progression, path story rewards, and Dev Boxes.\", use:\"Consumed automatically when choosing/switching paths and crafting Realignment systems.\", command:\"!core token path\" },\n  { id:\"reactor_token\", name:\"Reactor Token\", aliases:[\"reactor\"], obtain:\"Reactor story quest, Reactor achievement, and Reactor Boxes.\", use:\"Consumed automatically by higher Stardust Reactor upgrades.\", command:\"!core token reactor\" },\n  { id:\"crafting_token\", name:\"Crafting Token\", aliases:[\"crafting\",\"craft\"], obtain:\"Daily Crafting quest and Quest Boxes.\", use:\"Activate a 25% discount on your next successful component craft.\", command:\"!core token use crafting\" },\n  { id:\"quest_token\", name:\"Quest Token\", aliases:[\"quest\"], obtain:\"Daily Rolling, Starter/Quest Boxes, rare quests, and path bonuses.\", use:\"Instantly adds 25% progress to one unfinished daily/weekly Core quest.\", command:\"!core token use quest\" },\n  { id:\"wall_token\", name:\"Wall Token\", aliases:[\"wall\"], obtain:\"Weekly Core quest, Core achievements, Core/Anomaly/Dev Boxes.\", use:\"Consumed automatically by randomized wall Cores and Sub-Cores.\", command:\"!core token wall\" },\n  { id:\"anomaly_token\", name:\"Anomaly Token\", aliases:[\"anomaly\"], obtain:\"Anomaly Boxes and late anomaly progression.\", use:\"Consumed automatically by Core 130+ Anomaly wall components.\", command:\"!core token anomaly\" },\n];\n\nconst BOXES: GuideEntry[] = [\n  { id:\"starter_box\", name:\"Starter Box\", aliases:[\"starter\"], obtain:\"Beginner achievements, SHD story, and early rewards.\", use:\"Scrap, Circuit Scrap, Signal Fragments, and Quest Tokens.\", command:\"!box open starter\" },\n  { id:\"core_box\", name:\"Core Box\", aliases:[\"core\"], obtain:\"Every 10th Core, weekly Core quests, and milestones.\", use:\"Refined Alloy, Stabilized Flux, Recipe Tokens, and possible Wall Tokens.\", command:\"!box open core\" },\n  { id:\"quest_box\", name:\"Quest Box\", aliases:[\"quest\"], obtain:\"Daily Rare Hunt, roll achievements, and quest rewards.\", use:\"Signal Fragments, Refined Alloy, Quest Tokens, and Crafting Tokens.\", command:\"!box open quest\" },\n  { id:\"reactor_box\", name:\"Reactor Box\", aliases:[\"reactor\"], obtain:\"Reactor story, achievement, and reactor rewards.\", use:\"Quantum Residue, Reality Thread, Reactor Tokens, and Recipe Tokens.\", command:\"!box open reactor\" },\n  { id:\"anomaly_box\", name:\"Anomaly Box\", aliases:[\"anomaly\"], obtain:\"Core 100 rewards and late progression.\", use:\"Anomaly Matter, Dimensional Seals, Forbidden Circuits, and Anomaly Tokens.\", command:\"!box open anomaly\" },\n  { id:\"dev_box\", name:\"Dev Box\", aliases:[\"dev\"], obtain:\"Developer/admin rewards only.\", use:\"Debug and late-game materials/tokens.\", command:\"!box open dev\" },\n];\n\nconst COMPONENT_FAMILIES = [\n  \"wire\",\"cable\",\"plate\",\"rod\",\"screw\",\"bolt\",\"coil\",\"resistor\",\"smd_resistor\",\n  \"transistor\",\"smd_transistor\",\"capacitor\",\"smd_capacitor\",\"diode\",\"smd_diode\",\n  \"fuse\",\"relay\",\"sensor\",\"emitter\",\"lens\",\"heat_sink\",\"battery_cell\",\"power_cell\",\n  \"circuit_board\",\"processor\",\"logic_chip\",\"regulator\",\"stabilizer\",\"conduit\",\"matrix\",\n] as const;\n\nconst PATH_LADDERS: Record<string, string[]> = {\n  safe:[\"stability_buffer\",\"stability_lock\",\"quantum_anchor\",\"reality_bastion\",\"singularity_seal\",\"absolute_lock\"],\n  risk:[\"volatile_capacitor\",\"risk_compressor\",\"chaos_engine\",\"rupture_core\",\"singularity_overdrive\",\"cataclysm_drive\"],\n  support:[\"support_relay\",\"support_regulator\",\"logistics_matrix\",\"restoration_hub\",\"quantum_coordinator\",\"celestial_network\"],\n  biome:[\"biome_sensor\",\"biome_lens\",\"climate_resonator\",\"dimensional_ecoscope\",\"worldseed_prism\",\"omnibiome_array\"],\n  precision:[\"targeting_filter\",\"precision_filter\",\"probability_calibrator\",\"reality_sieve\",\"singularity_scope\",\"absolute_predictor\"],\n  token:[\"token_socket\",\"token_amplifier\",\"voucher_encoder\",\"token_reactor\",\"infinite_ledger\",\"sovereign_mint\"],\n  anomaly:[\"instability_buffer\",\"anomaly_compressor\",\"rift_decoder\",\"null_processor\",\"paradox_engine\",\"forbidden_singularity\"],\n};\nconst PATH_RANGES = [\"Core 16–49\",\"Core 50–89\",\"Core 90–129\",\"Core 130–169\",\"Core 170–219\",\"Core 220–250\"];\n\nfunction normalize(input:string|undefined|null){return(input??\"\").toLowerCase().trim().replace(/^!+/,\"\").replace(/[^a-z0-9]+/g,\"_\").replace(/^_+|_+$/g,\"\");}\nfunction titleCase(input:string){return input.split(/[_\\-\\s:]+/g).filter(Boolean).map(x=>x.charAt(0).toUpperCase()+x.slice(1)).join(\" \");}\nfunction findEntry(entries:GuideEntry[],raw:string){const q=normalize(raw);if(!q)return undefined;return entries.find(e=>[e.id,e.name,...(e.aliases??[])].map(normalize).some(v=>v===q||v.replace(/_/g,\"\")===q.replace(/_/g,\"\")));}\nfunction page(raw:string|undefined,total:number){const n=Number(String(raw??\"1\").replace(/,/g,\"\"));return Math.max(1,Math.min(total,Number.isFinite(n)?Math.floor(n):1));}\nfunction entry(e:GuideEntry,icon:string){return truncate(`${icon} ${e.name} | Obtain: ${e.obtain} | Use: ${e.use}${e.command?` | Command: ${e.command}`:\"\"}`,390);}\nfunction list(entries:GuideEntry[],raw:string|undefined,title:string){const size=3,total=Math.max(1,Math.ceil(entries.length/size)),p=page(raw,total),shown=entries.slice((p-1)*size,p*size);return truncate(`${title} ${p}/${total}: ${shown.map(e=>`${e.name} — ${e.obtain}`).join(\" | \")}`,390);}\n\nconst PATH_COMPONENTS:GuideEntry[]=Object.entries(PATH_LADDERS).flatMap(([path,ids])=>ids.map((id,i)=>({id,name:titleCase(id),aliases:[`${path}_${i+1}`],obtain:`Crafted ${titleCase(path)} wall component for ${PATH_RANGES[i]}.`,use:`Required only by ${titleCase(path)} wall Cores/Sub-Cores in ${PATH_RANGES[i]}; one craft makes x2.`,command:`!craft recipe ${id}`})));\n\nexport function formatMaterialGuide(query=\"\",pageRaw=\"1\"){const e=query&&!/^\\d+$/.test(query)?findEntry(MATERIALS,query):undefined;return e?entry(e,\"🧱\"):query&&!/^\\d+$/.test(query)?`Unknown material: ${query}. Try !info obtain <item>.`:list(MATERIALS,/^\\d+$/.test(query)?query:pageRaw,\"🧱 Material Sources\");}\nexport function formatTokenSourceGuide(query=\"\",pageRaw=\"1\"){const e=query&&!/^\\d+$/.test(query)?findEntry(TOKENS,query):undefined;return e?entry(e,\"🎟️\"):query&&!/^\\d+$/.test(query)?`Unknown Core token: ${query}. Try !info token sources.`:list(TOKENS,/^\\d+$/.test(query)?query:pageRaw,\"🎟️ Core Token Guide\");}\nexport function isKnownTokenGuide(query:string){return Boolean(findEntry(TOKENS,query));}\nexport function formatBoxGuide(query=\"\",pageRaw=\"1\"){const e=query&&!/^\\d+$/.test(query)?findEntry(BOXES,query):undefined;return e?entry(e,\"📦\"):query&&!/^\\d+$/.test(query)?`Unknown box: ${query}. Try !info boxes.`:list(BOXES,/^\\d+$/.test(query)?query:pageRaw,\"📦 Box Guide\");}\n\nfunction genericComponent(query:string){const id=normalize(query),match=id.match(/^(.+?)_(\\d+)$/),raw=match?.[1]??id,family=COMPONENT_FAMILIES.find(x=>normalize(x)===normalize(raw)||normalize(titleCase(x))===normalize(raw));if(!family)return null;const tier=Math.max(1,Math.min(10,Number(match?.[2]??1)));return{id:`${family}_${tier}`,tier};}\nexport function formatComponentGuide(query=\"\",pageRaw=\"1\"){\n  if(query&&!/^\\d+$/.test(query)){const path=findEntry(PATH_COMPONENTS,query);if(path)return entry(path,\"🧭\");const c=genericComponent(query);if(!c)return`Unknown component: ${query}. Try !info components or !info paths.`;return truncate(`⚙️ ${titleCase(c.id)} | Craft: !craft recipe ${c.id} | Higher tiers use the previous tier plus rarity materials. ${c.tier<=5?\"Makes x2 per batch.\":c.tier<=7?\"Makes x1 with duplicate chances.\":\"Late tier; may consume Recipe Tokens.\"}`,390);}\n  const entries=COMPONENT_FAMILIES.map(id=>({id,name:titleCase(id),obtain:`Craft !craft recipe ${id}_1; use _2 through _10.`,use:\"Core, SHD, Reactor, and advanced recipes.\"}));\n  return list(entries,/^\\d+$/.test(query)?query:pageRaw,\"⚙️ Component Families\");\n}\nexport function formatPathComponentGuide(path=\"\",_pageRaw=\"1\"){const p=normalize(path);if(p&&PATH_LADDERS[p])return truncate(`🧭 ${titleCase(p)} walls: ${PATH_LADDERS[p].map((id,i)=>`${PATH_RANGES[i]}=${titleCase(id)}`).join(\" | \")} | Each craft makes x2.`,390);return truncate(`🧭 Paths: ${Object.keys(PATH_LADDERS).join(\", \")} | Use !info path <name>.`,390);}\nexport function formatObtainGuide(query=\"\",pageRaw=\"1\"){const q=query.trim();if(!q||/^\\d+$/.test(q))return\"🔎 Obtain | !info material <name> | component <name> | token <name> | box <name> | path <name>\";const m=findEntry(MATERIALS,q);if(m)return entry(m,\"🧱\");const t=findEntry(TOKENS,q);if(t)return entry(t,\"🎟️\");const b=findEntry(BOXES,q);if(b)return entry(b,\"📦\");const p=findEntry(PATH_COMPONENTS,q);if(p)return entry(p,\"🧭\");if(genericComponent(q))return formatComponentGuide(q,pageRaw);return`No obtain guide found for ${q}.`;}\n", "src/lib/sol-info.ts": "import { auras, biomes, potions, events, devEvents, devices } from \"./data\";\nimport { getAllTokenDefinitions, formatTokenDefinitionPage } from \"./inventory\";\nimport { truncate } from \"./format\";\nimport {\n  formatBoxGuide,\n  formatComponentGuide,\n  formatMaterialGuide,\n  formatObtainGuide,\n  formatPathComponentGuide,\n  formatTokenSourceGuide,\n  isKnownTokenGuide,\n} from \"./progression-info\";\n\nconst START = [\n  \"1) !roll earns profile progress, Core materials, Stardust, and Knowledge from 1/10k+ results.\",\n  \"2) !core shows exactly what the next Core needs; !core recipe shows the complete cost.\",\n  \"3) !knowledge explains every Activity currency and recommends research.\",\n  \"4) !research next chooses a useful available upgrade.\",\n  \"5) !scanner tells you what is active and what to do next.\",\n  \"6) Confused by an item? Use !info obtain <name>.\",\n];\nconst CURRENCIES = [\n  \"Stardust: SHD storage; spent on Cores and Reactor.\",\n  \"Knowledge: earned from 1/10k+ rolls; spent with !research.\",\n  \"Merchant Marks: boss-damage currency; spent with !market.\",\n  \"Relic Shards: bosses/Relic Echo/market; spent with !relics.\",\n  \"Blueprint Fragments: bosses/Blueprint Rain/market; !blueprints assemble.\",\n  \"Core Tokens: inspect/use with !core tokens and !core token <name>.\",\n];\nconst ACTIVITY = [\n  \"!knowledge: balances plus recommended research.\",\n  \"!research next / branches / info / unlock.\",\n  \"!scanner: boss, event, Core-wall, and action guidance.\",\n  \"!market: exact offers and rewards.\",\n  \"!blueprints guide / info / assemble.\",\n  \"!relics guide / list / forge / equip / upgrade / reroll.\",\n  \"!boss / !boss beacon / !forecast.\",\n];\nconst RELICS = [\n  \"Earn Shards from bosses, Relic Echo, or !market.\",\n  \"Assemble relic_forge with !blueprints.\",\n  \"Forge: !relics forge; inspect: !relics info 1.\",\n  \"Equip: !relics equip 1; research unlocks slots 2 and 3.\",\n  \"Upgrade level: !relics upgrade 1; rarity: !relics reroll 1.\",\n  \"Effects are real: Knowledge, boss damage, Marks, discounts, fragments, shards, Scanner.\",\n];\nconst RESEARCH = [\n  \"Knowledge comes from the best 1/10k+ aura in a real roll command.\",\n  \"!research next recommends a useful node and exact command.\",\n  \"Every node has an active implemented effect.\",\n  \"Inspect before spending: !research info <id>.\",\n];\nconst BLUEPRINTS = [\n  \"Fragments come from bosses, Blueprint Rain, and Market.\",\n  \"Unlock blueprint_reading then blueprint_assembly.\",\n  \"!blueprints info <id> shows source/effect/cost.\",\n  \"!blueprints assemble <id> permanently activates it.\",\n];\nconst COMMANDS = [\n  \"!info start / currencies / paths / token <name>\",\n  \"!core / recipe / tokens / token use quest|crafting\",\n  \"!knowledge / !research next / !scanner\",\n  \"!relics guide / !blueprints guide / !market\",\n  \"!pquests / !gquests / !lb / !records / !firsts\",\n  \"!replay / !aotd / !botd / !event / !update\",\n];\n\nfunction norm(raw:string|undefined|null){return(raw??\"\").toLowerCase().trim().replace(/^!+/,\"\").replace(/[^a-z0-9]+/g,\"_\").replace(/^_+|_+$/g,\"\");}\nfunction title(raw:string){return raw.split(/[_\\-\\s:]+/g).filter(Boolean).map(x=>x.charAt(0).toUpperCase()+x.slice(1)).join(\" \");}\nfunction rarity(v:number){return`1/${Math.floor(v).toLocaleString(\"en-US\")}`;}\nfunction page(raw:string|undefined,total:number){const n=Number(String(raw??\"1\").replace(/,/g,\"\"));return Math.max(1,Math.min(total,Number.isFinite(n)?Math.floor(n):1));}\nfunction paginate<T>(items:T[],raw:string|undefined,fmt:(x:T)=>string,name:string,size=8){const total=Math.max(1,Math.ceil(items.length/size)),p=page(raw,total),shown=items.slice((p-1)*size,p*size).map(fmt);return truncate(`${name} ${p}/${total}: ${shown.join(\" | \")||\"None\"}`,390);}\nfunction split(parts:string[]){const copy=[...parts];let p=\"\";if(copy.length>1&&/^\\d+$/.test(copy[copy.length-1]))p=copy.pop()??\"\";return{query:copy.join(\" \"),page:p};}\nfunction findAura(q:string){const n=norm(q);return auras.find(x=>norm(x.id)===n||norm(x.name)===n||norm(x.name).replace(/_/g,\"\")===n.replace(/_/g,\"\"));}\nfunction findBiome(q:string){const n=norm(q);return biomes.find(x=>norm(x.id)===n||norm(x.name)===n);}\nfunction findPotion(q:string){const n=norm(q);return potions.find(x=>norm(x.id)===n||norm(x.name)===n||x.aliases.some(a=>norm(a)===n));}\nfunction staticGuide(items:string[],p:string,name:string){return paginate(items,p,x=>x,name,4);}\n\nfunction auraInfo(q:string,p?:string){if(q&&!/^\\d+$/.test(q)){const a=findAura(q);if(!a)return`Unknown aura: ${q}`;const flags=[a.biome?`Biome ${title(a.biome)}`:null,a.event?`Event ${title(a.event)}`:null,a.devBiome?`Dev ${title(a.devBiome)}`:null,a.potion?`Potion ${title(a.potion.id)} ${rarity(a.potion.rarity)}`:null,a.luckImmune?\"Raw luck only\":null,a.unobtainable?\"Unobtainable\":null,a.deleted?\"Deleted\":null].filter(Boolean);return truncate(`✨ ${a.name} | ${rarity(a.rarity)}${flags.length?` | ${flags.join(\" | \")}`:\"\"}`,390);}return paginate([...auras].sort((a,b)=>a.rarity-b.rarity),/^\\d+$/.test(q)?q:p,a=>`${a.name} ${rarity(a.rarity)}`,\"✨ Auras\");}\nfunction biomeInfo(q:string,p?:string){if(q&&!/^\\d+$/.test(q)){const b=findBiome(q);if(!b)return`Unknown biome: ${q}`;const chance=b.spawnPerSecond?`Spawn/sec 1/${Math.round(1/b.spawnPerSecond).toLocaleString(\"en-US\")}`:b.spawnOnChange?`On-change 1/${Math.round(1/b.spawnOnChange).toLocaleString(\"en-US\")}`:b.deviceChance?`Device 1/${b.deviceChance.toLocaleString(\"en-US\")}`:b.manualOnly||b.devOnly?\"Manual/dev only\":\"Normal pool\";return truncate(`🌍 ${b.name} | ${chance} | BT x${b.breakthroughMultiplier}${b.isRareBiome?\" | Rare\":\"\"}`,390);}return paginate(biomes,/^\\d+$/.test(q)?q:p,b=>`${b.name}${b.isRareBiome?\" rare\":\"\"}`,\"🌍 Biomes\");}\nfunction potionInfo(q:string,p?:string){if(q&&!/^\\d+$/.test(q)){const x=findPotion(q);if(!x)return`Unknown potion: ${q}`;return truncate(`🧪 ${x.name} | +${Math.floor(x.luck).toLocaleString(\"en-US\")} luck${x.clearsBuffs?\" | Clears buffs\":\"\"}${x.requiresEvent?` | Event ${title(x.requiresEvent)}`:\"\"}${x.exclusiveAuras?.length?` | ${x.exclusiveAuras.length} exclusive aura(s)`:\"\"}`,390);}return paginate(potions,/^\\d+$/.test(q)?q:p,x=>`${x.name} +${Math.floor(x.luck).toLocaleString(\"en-US\")}`,\"🧪 Potions\");}\nfunction rollTokens(kind:string,p?:string){const mode=norm(kind||\"boosts\"),all=getAllTokenDefinitions(),special=(t:(typeof all)[number])=>Boolean((t.flatLuck??0)>0||(t.rareBiomePercentLuck??0)>0||(t.finalLuckMultiplier??1)>1),list=mode.includes(\"potion\")||mode.includes(\"roll\")?all.filter(t=>t.kind===\"potion\"):mode.includes(\"special\")?all.filter(t=>t.kind===\"percent_luck\"&&special(t)):all.filter(t=>t.kind===\"percent_luck\"&&!special(t));return formatTokenDefinitionPage(list,p,mode.includes(\"potion\")?\"🧪 Roll/Potion Tokens\":mode.includes(\"special\")?\"✨ Special Luck Tokens\":\"🎟️ Luck Boost Tokens\");}\n\nexport function formatSolInfo(rawQuery:string){\n  const parts=rawQuery.trim().split(/\\s+/).filter(Boolean);if(norm(parts[0])===\"sol\")parts.shift();const topic=norm(parts.shift()??\"help\"),{query,page:p}=split(parts),pq=p||query;\n  if(topic===\"help\"||topic===\"info\")return\"📘 Help | !info start | currencies | paths | token <name> | obtain <item> | research | relics | blueprints\";\n  if(topic===\"start\"||topic===\"begin\")return staticGuide(START,pq,\"🚀 Start Guide\");\n  if([\"currency\",\"currencies\",\"money\"].includes(topic))return staticGuide(CURRENCIES,pq,\"💰 Currency Guide\");\n  if(topic===\"commands\"||topic===\"cmds\")return staticGuide(COMMANDS,pq,\"🤖 Commands\");\n  if([\"activity\",\"knowledge\",\"aok\"].includes(topic))return staticGuide(ACTIVITY,pq,\"🧠 Activity Guide\");\n  if(topic===\"research\")return staticGuide(RESEARCH,pq,\"🧠 Research Guide\");\n  if(topic===\"relic\"||topic===\"relics\")return staticGuide(RELICS,pq,\"🧿 Relic Guide\");\n  if(topic===\"blueprint\"||topic===\"blueprints\")return staticGuide(BLUEPRINTS,pq,\"📘 Blueprint Guide\");\n  if(topic===\"aura\"||topic===\"auras\")return auraInfo(query,p);\n  if(topic===\"biome\"||topic===\"biomes\")return biomeInfo(query,p);\n  if(topic===\"potion\"||topic===\"potions\")return potionInfo(query,p);\n  if(topic===\"token\"||topic===\"tokens\"){const first=norm(query.split(/\\s+/)[0]??\"\");if([\"boost\",\"boosts\",\"potion\",\"potions\",\"special\"].includes(first))return rollTokens(first,p);if([\"source\",\"sources\",\"obtain\",\"how\",\"get\"].includes(first))return formatTokenSourceGuide(query.split(/\\s+/).slice(1).join(\" \"),p);if(isKnownTokenGuide(query))return formatTokenSourceGuide(query,p);return\"🎟️ Two token systems | Core tokens: !info token quest | Roll tokens: !info token boosts/potions | Owned Core tokens: !core tokens\";}\n  if(topic===\"boost\"||topic===\"boosts\")return rollTokens(\"boosts\",query||p);\n  if(topic===\"special\")return rollTokens(\"special\",query||p);\n  if(topic===\"path\"||topic===\"paths\")return formatPathComponentGuide(query,p);\n  if(topic===\"material\"||topic===\"materials\")return formatMaterialGuide(query,p);\n  if(topic===\"component\"||topic===\"components\")return formatComponentGuide(query,p);\n  if(topic===\"box\"||topic===\"boxes\")return formatBoxGuide(query,p);\n  if([\"obtain\",\"source\",\"sources\",\"how\",\"get\"].includes(topic))return formatObtainGuide(query,p);\n  if(topic===\"events\"||topic===\"event\")return paginate(events as Array<{name:string}>,pq,e=>e.name,\"🎉 Events\");\n  if(topic===\"dev\"||topic===\"devs\")return paginate(devEvents as Array<{name?:string;id:string}>,pq,e=>e.name??title(e.id),\"🛠️ Dev Biomes\");\n  if(topic===\"device\"||topic===\"devices\")return paginate(devices as Array<{name:string}>,pq,d=>d.name,\"📟 Devices\");\n  if([\"core\",\"cores\",\"shd\",\"reactor\",\"quest\",\"quests\"].includes(topic))return truncate(`📘 ${title(topic)} | Status: !${topic===\"cores\"?\"core\":topic} | Exact source: !info obtain <name> | Token help: !core tokens`,390);\n  return auraInfo([topic,query].filter(Boolean).join(\" \"));\n}\n", "src/pages/activity.tsx": "import Head from \"next/head\";\nimport type { CSSProperties } from \"react\";\n\nconst STEPS = [\n  [\"1. Earn Knowledge\",\"Real rolls whose best result is 1/10,000+ grant Knowledge.\",\"!knowledge\"],\n  [\"2. Buy real research\",\"Every node now states an implemented effect; the bot recommends your next upgrade.\",\"!research next\"],\n  [\"3. Use the Scanner\",\"Scanner levels reveal bosses, events, Core walls, and the best useful action.\",\"!scanner\"],\n  [\"4. Fight bosses\",\"Rolls deal damage. Bosses grant Marks, Shards, Fragments, and Knowledge.\",\"!boss\"],\n  [\"5. Assemble blueprints\",\"Permanent upgrades with exact Fragment costs and effects.\",\"!blueprints guide\"],\n  [\"6. Forge and equip relics\",\"Real effects, levels, rarities, slots, upgrades, and rerolls.\",\"!relics guide\"],\n];\n\nconst CURRENCIES = [\n  [\"Knowledge\",\"Rare-roll research currency\",\"!research next\"],\n  [\"Merchant Marks\",\"Earned from boss damage\",\"!market\"],\n  [\"Relic Shards\",\"Forge/upgrade/reroll relics\",\"!relics guide\"],\n  [\"Blueprint Fragments\",\"Assemble permanent upgrades\",\"!blueprints guide\"],\n];\n\nconst COMMANDS = [\n  [\"Knowledge\",\"!knowledge\"],\n  [\"Research\",\"!research guide / next / branches / info / unlock\"],\n  [\"Scanner\",\"!scanner\"],\n  [\"Boss\",\"!boss / !boss start / !boss beacon\"],\n  [\"World Event\",\"!worldevent\"],\n  [\"Forecast\",\"!forecast\"],\n  [\"Market\",\"!market / !market buy <id>\"],\n  [\"Blueprints\",\"!blueprints guide / info / assemble\"],\n  [\"Relics\",\"!relics guide / list / forge / info / equip / upgrade / reroll\"],\n];\n\nexport default function ActivityPage(){\n  return <><Head><title>Activity of Knowledge Guide</title></Head>\n  <main style={page}><div style={container}>\n    <header style={{marginBottom:28}}>\n      <p style={eyebrow}>SOL&apos;S RNG TWITCH BOT</p>\n      <h1 style={title}>Activity of Knowledge — Clear Guide</h1>\n      <p style={lead}>The loop is now visible: roll → earn Knowledge → research → fight bosses → assemble blueprints → forge relics.</p>\n      <p><a href=\"/dashboard\" style={link}>← Dashboard</a> · <a href=\"/crafting\" style={link}>Crafting Guide</a></p>\n    </header>\n    <section style={grid}>{STEPS.map(([name,text,command])=><article key={name} style={card}><h2 style={{margin:\"0 0 8px\",fontSize:19}}>{name}</h2><p style={muted}>{text}</p><code style={code}>{command}</code></article>)}</section>\n    <section style={section}><h2 style={{marginTop:0}}>Currencies</h2><div style={grid}>{CURRENCIES.map(([name,use,command])=><article key={name} style={mini}><strong>{name}</strong><p style={muted}>{use}</p><code style={code}>{command}</code></article>)}</div></section>\n    <section style={section}><h2 style={{marginTop:0}}>Commands</h2><div style={{display:\"grid\",gap:10}}>{COMMANDS.map(([name,command])=><div key={name} style={row}><strong>{name}</strong><code style={code}>{command}</code></div>)}</div></section>\n    <section style={section}><h2 style={{marginTop:0}}>Relics are real now</h2><p style={muted}>Equipped relics improve Knowledge, boss damage, Merchant Marks, market discounts, Blueprint Fragment chance, Relic Shard rewards, or Scanner strength. Relic Slot research controls how many can be equipped.</p></section>\n    <section style={section}><h2 style={{marginTop:0}}>Research is no longer vague</h2><p style={muted}>Every node describes an active effect. Use <code style={code}>!research next</code> whenever you are unsure.</p></section>\n  </div></main></>;\n}\n\nconst page:CSSProperties={minHeight:\"100vh\",padding:24,color:\"#f5f7ff\",background:\"radial-gradient(circle at top, rgba(79,90,196,.28), transparent 34%), #070914\",fontFamily:\"Inter,system-ui,sans-serif\"};\nconst container:CSSProperties={maxWidth:1180,margin:\"0 auto\"};\nconst eyebrow:CSSProperties={margin:0,color:\"#9aa7ff\",fontWeight:900,letterSpacing:1.2};\nconst title:CSSProperties={margin:\"6px 0\",fontSize:44};\nconst lead:CSSProperties={maxWidth:900,color:\"#c5cce4\",lineHeight:1.6};\nconst link:CSSProperties={color:\"#aab5ff\"};\nconst grid:CSSProperties={display:\"grid\",gridTemplateColumns:\"repeat(auto-fit,minmax(250px,1fr))\",gap:14};\nconst card:CSSProperties={padding:17,border:\"1px solid #2c3769\",borderRadius:16,background:\"rgba(17,21,42,.94)\"};\nconst mini:CSSProperties={padding:14,border:\"1px solid #293461\",borderRadius:13,background:\"#090c19\"};\nconst muted:CSSProperties={color:\"#bec6df\",lineHeight:1.5};\nconst code:CSSProperties={color:\"#b6ffdf\",background:\"#05070e\",padding:\"3px 6px\",borderRadius:6};\nconst section:CSSProperties={marginTop:22,padding:18,border:\"1px solid #26315c\",borderRadius:18,background:\"rgba(14,18,36,.92)\"};\nconst row:CSSProperties={display:\"flex\",flexWrap:\"wrap\",justifyContent:\"space-between\",gap:10,padding:12,border:\"1px solid #28325d\",borderRadius:11,background:\"#080a14\"};\n", "src/pages/api/relics.ts": "import type { NextApiRequest, NextApiResponse } from \"next\";\nimport { parseQuery, text } from \"@/lib/api-helpers\";\nimport { getChannelContext } from \"@/lib/nightbot\";\nimport { formatRelics } from \"@/lib/activity-of-knowledge-system\";\n\nexport default async function handler(req:NextApiRequest,res:NextApiResponse){\n  const {channelId,user}=getChannelContext(req);\n  return text(res,await formatRelics(channelId,user,parseQuery(req)));\n}\n", "src/pages/api/boss.ts": "import type { NextApiRequest, NextApiResponse } from \"next\";\nimport { parseQuery, text } from \"@/lib/api-helpers\";\nimport { getChannelContext } from \"@/lib/nightbot\";\nimport { formatBoss, startBoss, startBossWithBeacon } from \"@/lib/activity-of-knowledge-system\";\n\nexport default async function handler(req:NextApiRequest,res:NextApiResponse){\n  const {channelId,channelLoginName,isMod,user}=getChannelContext(req);\n  const action=parseQuery(req).trim().toLowerCase().split(/\\s+/)[0]??\"\";\n  if(action===\"start\"){\n    if(!isMod)return text(res,\"Only mods/broadcaster can use !boss start. Players with Boss Beacon can use !boss beacon.\");\n    return text(res,await startBoss(channelId,channelLoginName));\n  }\n  if(action===\"beacon\")return text(res,await startBossWithBeacon(channelId,channelLoginName,user));\n  return text(res,await formatBoss(channelId,channelLoginName));\n}\n", "src/pages/api/market.ts": "import type { NextApiRequest, NextApiResponse } from \"next\";\nimport { parseQuery, text } from \"@/lib/api-helpers\";\nimport { getChannelContext } from \"@/lib/nightbot\";\nimport { buyMarketItem, formatMarket } from \"@/lib/activity-of-knowledge-system\";\n\nexport default async function handler(req:NextApiRequest,res:NextApiResponse){\n  const {channelId,channelLoginName,user}=getChannelContext(req);\n  const parts=parseQuery(req).trim().split(/\\s+/).filter(Boolean);\n  if((parts[0]??\"\").toLowerCase()===\"buy\")return text(res,await buyMarketItem(channelId,channelLoginName,user,parts.slice(1).join(\" \")));\n  return text(res,await formatMarket(channelId,channelLoginName,user));\n}\n"};

function fail(message) {
  console.error(`❌ ${message}`);
  process.exit(1);
}
function normalize(text) {
  return text.replace(/\r\n/g, "\n");
}
function backup(file, original) {
  const out = `${file}.bak.${Date.now()}`;
  fs.writeFileSync(out, original);
  console.log(`🧯 Backup: ${out}`);
}
function replaceOnce(source, oldText, newText, label) {
  if (source.includes(newText)) return source;
  if (!source.includes(oldText)) fail(`Could not patch ${label}.`);
  return source.replace(oldText, newText);
}
function writeReplacement(file, content) {
  const full = path.join(process.cwd(), file);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  if (fs.existsSync(full)) {
    const original = fs.readFileSync(full, "utf8");
    if (normalize(original) === normalize(content)) {
      console.log(`✅ Already current: ${file}`);
      return;
    }
    backup(full, original);
  }
  fs.writeFileSync(full, content);
  console.log(`✅ Wrote ${file}`);
}

for (const [file, content] of Object.entries(replacements)) {
  writeReplacement(file, content);
}

const coreFile = "src/lib/core-system.ts";
if (!fs.existsSync(coreFile)) fail(`Missing ${coreFile}.`);
const coreOriginal = fs.readFileSync(coreFile, "utf8");
let core = normalize(coreOriginal);

const anomalyWallBlock = `const WALL_COMPONENT_BY_PATH: Record<CorePath, string> = {
  universal: "stability_lock",
  safe: "stability_lock",
  risk: "anomaly_compressor",
  support: "support_regulator",
  biome: "biome_lens",
  precision: "precision_filter",
  token: "token_amplifier",
  anomaly: "instability_buffer",
};

function getAnomalyWallComponent(coreTier: number): string {
  if (coreTier < 50) return "instability_buffer";
  if (coreTier < 90) return "anomaly_compressor";
  if (coreTier < 130) return "rift_decoder";
  if (coreTier < 170) return "null_processor";
  if (coreTier < 220) return "paradox_engine";
  return "forbidden_singularity";
}

function getWallComponentForPath(
  path: CorePath,
  coreTier: number
): string {
  if (path === "anomaly") {
    return getAnomalyWallComponent(coreTier);
  }

  return WALL_COMPONENT_BY_PATH[path];
}`;

const legacyWallBlock = `const WALL_COMPONENT_BY_PATH: Record<CorePath, string> = {
  universal: "stability_lock",
  safe: "stability_lock",
  risk: "anomaly_compressor",
  support: "support_regulator",
  biome: "biome_lens",
  precision: "precision_filter",
  token: "token_amplifier",
  anomaly: "null_processor",
};`;

const balancedWallBlock = `const PATH_WALL_COMPONENTS: Record<CorePath, readonly string[]> = {
  universal: ["stability_buffer","stability_lock","quantum_anchor","reality_bastion","singularity_seal","absolute_lock"],
  safe: ["stability_buffer","stability_lock","quantum_anchor","reality_bastion","singularity_seal","absolute_lock"],
  risk: ["volatile_capacitor","risk_compressor","chaos_engine","rupture_core","singularity_overdrive","cataclysm_drive"],
  support: ["support_relay","support_regulator","logistics_matrix","restoration_hub","quantum_coordinator","celestial_network"],
  biome: ["biome_sensor","biome_lens","climate_resonator","dimensional_ecoscope","worldseed_prism","omnibiome_array"],
  precision: ["targeting_filter","precision_filter","probability_calibrator","reality_sieve","singularity_scope","absolute_predictor"],
  token: ["token_socket","token_amplifier","voucher_encoder","token_reactor","infinite_ledger","sovereign_mint"],
  anomaly: ["instability_buffer","anomaly_compressor","rift_decoder","null_processor","paradox_engine","forbidden_singularity"],
};

const PATH_WALL_RANGES = [
  "Core 16-49",
  "Core 50-89",
  "Core 90-129",
  "Core 130-169",
  "Core 170-219",
  "Core 220-250",
] as const;

function getWallStageIndex(coreTier: number): number {
  if (coreTier < 50) return 0;
  if (coreTier < 90) return 1;
  if (coreTier < 130) return 2;
  if (coreTier < 170) return 3;
  if (coreTier < 220) return 4;
  return 5;
}

function getWallComponentForPath(
  path: CorePath,
  coreTier: number
): string {
  return PATH_WALL_COMPONENTS[path][getWallStageIndex(coreTier)];
}`;

if (!core.includes("const PATH_WALL_COMPONENTS")) {
  if (core.includes(anomalyWallBlock)) {
    core = core.replace(anomalyWallBlock, balancedWallBlock);
  } else if (core.includes(legacyWallBlock)) {
    core = core.replace(legacyWallBlock, balancedWallBlock);
  } else {
    fail("Could not locate path-wall mapping.");
  }
}

const recipeGenerator = `type WallRecipePath = Exclude<CorePath, "universal">;

const WALL_RECIPE_FAMILIES: Record<
  WallRecipePath,
  readonly [string, string][]
> = {
  safe: [["stabilizer","plate"],["stabilizer","plate"],["matrix","stabilizer"],["regulator","plate"],["matrix","stabilizer"],["matrix","regulator"]],
  risk: [["capacitor","coil"],["processor","conduit"],["processor","coil"],["processor","conduit"],["power_cell","coil"],["processor","power_cell"]],
  support: [["relay","regulator"],["regulator","relay"],["matrix","relay"],["regulator","conduit"],["matrix","regulator"],["relay","matrix"]],
  biome: [["sensor","lens"],["lens","sensor"],["sensor","emitter"],["lens","matrix"],["sensor","matrix"],["lens","emitter"]],
  precision: [["sensor","logic_chip"],["sensor","logic_chip"],["logic_chip","processor"],["sensor","matrix"],["logic_chip","matrix"],["processor","matrix"]],
  token: [["emitter","power_cell"],["emitter","power_cell"],["logic_chip","emitter"],["power_cell","regulator"],["logic_chip","matrix"],["emitter","matrix"]],
  anomaly: [["processor","stabilizer"],["processor","conduit"],["processor","matrix"],["processor","matrix"],["processor","matrix"],["processor","matrix"]],
};

function wallStageMaterials(stage: number): Record<string, number> {
  if (stage === 0) return { circuit_scrap: 60, signal_fragment: 12, refined_alloy: 4 };
  if (stage === 1) return { refined_alloy: 40, stabilized_flux: 8 };
  if (stage === 2) return { stabilized_flux: 35, quantum_residue: 6, chrono_dust: 2 };
  if (stage === 3) return { quantum_residue: 30, reality_thread: 5 };
  if (stage === 4) return { reality_thread: 18, dimensional_seal: 6, anomaly_matter: 2, singularity_shard: 1 };
  return { anomaly_matter: 20, glitched_alloy: 5, forbidden_circuit: 1 };
}

function buildPathWallComponentRecipes(): Record<string, ComponentRecipe> {
  const out: Record<string, ComponentRecipe> = {};
  const paths: WallRecipePath[] = ["safe","risk","support","biome","precision","token","anomaly"];
  const componentTiers = [1, 2, 4, 6, 8, 9];

  for (const path of paths) {
    const ids = PATH_WALL_COMPONENTS[path];

    for (let stage = 0; stage < ids.length; stage++) {
      const id = ids[stage];
      const tier = componentTiers[stage];
      const [primary, secondary] = WALL_RECIPE_FAMILIES[path][stage];
      const components: Record<string, number> = {
        [\`\${primary}_\${tier}\`]: stage >= 4 ? 2 : 1,
        [\`\${secondary}_\${tier}\`]: stage >= 3 ? 2 : 1,
      };

      if (stage > 0) components[ids[stage - 1]] = 1;

      const tokens: Record<string, number> | undefined =
        path === "anomaly" && stage >= 3
          ? { anomaly_token: stage >= 5 ? 2 : 1 }
          : stage >= 4
          ? { recipe_token: 1 }
          : undefined;

      out[id] = {
        id,
        name: titleCase(id),
        outputAmount: 2,
        costs: {
          materials: wallStageMaterials(stage),
          components,
          tokens,
        },
      };
    }
  }

  return out;
}

`;

if (!core.includes("function buildPathWallComponentRecipes")) {
  core = replaceOnce(
    core,
    "function buildComponentRecipes(): Record<string, ComponentRecipe> {",
    `${recipeGenerator}function buildComponentRecipes(): Record<string, ComponentRecipe> {`,
    "wall recipe generator"
  );
}

if (!core.includes("Object.assign(recipes, buildPathWallComponentRecipes());")) {
  core = replaceOnce(
    core,
    `  } satisfies Record<string, ComponentRecipe>);

  return recipes;
}`,
    `  } satisfies Record<string, ComponentRecipe>);

  Object.assign(recipes, buildPathWallComponentRecipes());

  return recipes;
}`,
    "wall recipe override"
  );
}

const discountHelper = `function discountCraftCosts(
  costs: CraftCosts,
  percent: number
): CraftCosts {
  const scale = (value: number) =>
    Math.max(1, Math.floor(value * (1 - percent)));
  const bag = (
    input: Record<string, number> | undefined
  ): Record<string, number> | undefined =>
    input
      ? Object.fromEntries(
          Object.entries(input).map(([id, value]) => [
            id,
            scale(value),
          ])
        )
      : undefined;

  return {
    ...costs,
    stardust: costs.stardust ? scale(costs.stardust) : undefined,
    materials: bag(costs.materials),
    components: bag(costs.components),
    frames: bag(costs.frames),
    tokens: costs.tokens,
  };
}

`;

if (!core.includes("function discountCraftCosts(")) {
  core = replaceOnce(
    core,
    "function hashPick<T>(seed: string, items: T[]): T {",
    `${discountHelper}function hashPick<T>(seed: string, items: T[]): T {`,
    "craft token discount helper"
  );
}

core = replaceOnce(
  core,
  `  const scaledCosts: CraftCosts = {
    stardust: recipe.costs.stardust ? recipe.costs.stardust * batches : undefined,
    materials: scaleBag(recipe.costs.materials, batches),
    components: scaleBag(recipe.costs.components, batches),
    frames: scaleBag(recipe.costs.frames, batches),
    tokens: scaleBag(recipe.costs.tokens, batches),
    coreTierRequired: recipe.costs.coreTierRequired,
    shdLevelRequired: recipe.costs.shdLevelRequired,
    activeRolls: recipe.costs.activeRolls?.map((req) => ({ ...req, amount: req.amount * batches })),
  };

  const missing = getMissingCosts(state, scaledCosts);`,
  `  const baseScaledCosts: CraftCosts = {
    stardust: recipe.costs.stardust
      ? recipe.costs.stardust * batches
      : undefined,
    materials: scaleBag(recipe.costs.materials, batches),
    components: scaleBag(recipe.costs.components, batches),
    frames: scaleBag(recipe.costs.frames, batches),
    tokens: scaleBag(recipe.costs.tokens, batches),
    coreTierRequired: recipe.costs.coreTierRequired,
    shdLevelRequired: recipe.costs.shdLevelRequired,
    activeRolls: recipe.costs.activeRolls?.map((req) => ({
      ...req,
      amount: req.amount * batches,
    })),
  };

  const craftingTokenActive =
    state.unlocks.crafting_token_discount_ready === true;
  const scaledCosts = craftingTokenActive
    ? discountCraftCosts(baseScaledCosts, 0.25)
    : baseScaledCosts;

  const missing = getMissingCosts(state, scaledCosts);`,
  "craft token cost application"
);

core = replaceOnce(
  core,
  `  consumeCosts(state, scaledCosts);

  const globalRolls = await getGlobalRolls();`,
  `  consumeCosts(state, scaledCosts);

  if (craftingTokenActive) {
    delete state.unlocks.crafting_token_discount_ready;
  }

  const globalRolls = await getGlobalRolls();`,
  "craft token consumption"
);

core = replaceOnce(
  core,
  `  const bonusText = bonusBatches > 0 ? \` + \${formatAmount(bonusBatches)} duplicate batch(es)\` : "";
  const chanceText = doubleChance > 0 ? \` | Double chance \${(doubleChance * 100).toFixed(1)}%\` : "";
  return truncate(\`✅ Crafted \${recipe.name}: \${formatAmount(batches)} batch(es) x\${formatAmount(baseOutputPerBatch)}\${bonusText} = \${formatAmount(outputAmount)} total. Used: \${formatUsedCosts(scaledCosts)}.\${chanceText}\`);`,
  `  const bonusText =
    bonusBatches > 0
      ? \` + \${formatAmount(bonusBatches)} duplicate batch(es)\`
      : "";
  const chanceText =
    doubleChance > 0
      ? \` | Double chance \${(doubleChance * 100).toFixed(1)}%\`
      : "";
  const discountText = craftingTokenActive
    ? " | Crafting Token: -25% costs"
    : "";

  return truncate(
    \`✅ Crafted \${recipe.name}: \${formatAmount(
      batches
    )} batch(es) x\${formatAmount(
      baseOutputPerBatch
    )}\${bonusText} = \${formatAmount(
      outputAmount
    )} total. Used: \${formatUsedCosts(
      scaledCosts
    )}.\${chanceText}\${discountText}\`
  );`,
  "craft response"
);

const tokenFunctions = `const CORE_TOKEN_HELP: Record<
  string,
  { name: string; automatic: boolean; use: string; command: string }
> = {
  recipe_token: { name: "Recipe Token", automatic: true, use: "High-tier component, Core, SHD, and Reactor recipes consume it.", command: "!core token recipe" },
  path_token: { name: "Path Token", automatic: true, use: "Path choosing/switching and Realignment consume it.", command: "!core token path" },
  reactor_token: { name: "Reactor Token", automatic: true, use: "Higher Reactor upgrades consume it.", command: "!core token reactor" },
  crafting_token: { name: "Crafting Token", automatic: false, use: "Activates -25% cost on your next successful component craft.", command: "!core token use crafting" },
  quest_token: { name: "Quest Token", automatic: false, use: "Adds 25% progress to one unfinished daily/weekly Core quest.", command: "!core token use quest" },
  wall_token: { name: "Wall Token", automatic: true, use: "Random wall Cores and Sub-Cores consume it.", command: "!core token wall" },
  anomaly_token: { name: "Anomaly Token", automatic: true, use: "Late Anomaly wall components consume it.", command: "!core token anomaly" },
};

function normalizeCoreTokenId(raw: string): string {
  const id = raw.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const aliases: Record<string, string> = {
    recipe: "recipe_token",
    path: "path_token",
    reactor: "reactor_token",
    crafting: "crafting_token",
    craft: "crafting_token",
    quest: "quest_token",
    wall: "wall_token",
    anomaly: "anomaly_token",
  };
  return aliases[id] ?? id;
}

export async function formatCoreTokenGuide(
  channelId: string,
  user: NightbotUser | null,
  raw = ""
): Promise<string> {
  const state = await touchCoreState(channelId, user);
  const id = normalizeCoreTokenId(raw);

  if (id && CORE_TOKEN_HELP[id]) {
    const guide = CORE_TOKEN_HELP[id];
    return truncate(
      \`🎟️ \${guide.name} x\${formatAmount(
        state.tokens[id] ?? 0
      )} | \${guide.automatic ? "AUTOMATIC" : "MANUAL"} | Use: \${
        guide.use
      } | Command: \${guide.command}\`
    );
  }

  return truncate(
    \`🎟️ Core Tokens: \${Object.entries(CORE_TOKEN_HELP)
      .map(
        ([tokenId, guide]) =>
          \`\${guide.name} x\${formatAmount(
            state.tokens[tokenId] ?? 0
          )} [\${guide.automatic ? "AUTO" : "USE"}]\`
      )
      .join(" | ")} | Details: !core token <name>\`
  );
}

export async function useCoreToken(
  channelId: string,
  user: NightbotUser | null,
  raw = ""
): Promise<string> {
  const parts = raw.trim().split(/\\s+/).filter(Boolean);
  const id = normalizeCoreTokenId(parts[0] ?? "");
  const state = await touchCoreState(channelId, user);

  if (id === "crafting_token") {
    if (state.unlocks.crafting_token_discount_ready) {
      return "A Crafting Token is already active. Your next successful component craft has -25% costs.";
    }
    if ((state.tokens.crafting_token ?? 0) < 1) {
      return "No Crafting Token. Obtain one from Daily Crafting or Quest Boxes.";
    }
    removeFromBag(state.tokens, "crafting_token", 1);
    state.unlocks.crafting_token_discount_ready = true;
    await saveCoreState(state);
    return "🛠️ Crafting Token activated: next successful component craft costs 25% less. Missing-material attempts do not consume it.";
  }

  if (id === "quest_token") {
    if ((state.tokens.quest_token ?? 0) < 1) {
      return "No Quest Token. Obtain one from Daily Rolling, quests, or boxes.";
    }

    const requested =
      parts[1]?.toLowerCase() === "weekly"
        ? "weekly"
        : parts[1]?.toLowerCase() === "daily"
        ? "daily"
        : null;

    const quest = getActiveQuests(state)
      .filter(
        (item) =>
          (item.kind === "daily" || item.kind === "weekly") &&
          !["core", "shd", "stardust"].includes(item.type) &&
          (!requested || item.kind === requested) &&
          !state.questClaimed[item.id] &&
          getQuestProgressValue(state, item) < item.target
      )
      .sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === "daily" ? -1 : 1;
        return (
          getQuestProgressValue(state, b) / b.target -
          getQuestProgressValue(state, a) / a.target
        );
      })[0];

    if (!quest) {
      return requested
        ? \`No unfinished \${requested} Core quest can use it.\`
        : "No unfinished daily/weekly Core quest can use it.";
    }

    const current = getQuestProgressValue(state, quest);
    const next = Math.min(
      quest.target,
      current + Math.max(1, Math.ceil(quest.target * 0.25))
    );

    state.questProgress[quest.id] = next;
    removeFromBag(state.tokens, "quest_token", 1);
    await saveCoreState(state);

    return \`📜 Quest Token: \${quest.title} \${formatAmount(
      current
    )} → \${formatAmount(next)}/\${formatAmount(
      quest.target
    )}\${next >= quest.target ? " | Ready to claim!" : ""}\`;
  }

  const guide = CORE_TOKEN_HELP[id];
  if (guide) return \`\${guide.name} is automatic: \${guide.use}\`;

  return "Manual uses: !core token use quest [daily/weekly] or !core token use crafting.";
}

`;

if (!core.includes("const CORE_TOKEN_HELP")) {
  core = replaceOnce(
    core,
    "export async function formatTokensStatus(",
    `${tokenFunctions}export async function formatTokensStatus(`,
    "token guide"
  );
}

core = replaceOnce(
  core,
  `  return formatPagedItems("🎟️ Core Tokens/Boxes", items, rawPage, 7);`,
  `  const active =
    state.unlocks.crafting_token_discount_ready
      ? " | Crafting discount ACTIVE"
      : "";

  return truncate(
    \`\${formatPagedItems(
      "🎟️ Core Tokens/Boxes",
      items,
      rawPage,
      7
    )}\${active} | Explain/use: !core tokens or !core token <name>\`
  );`,
  "token status"
);

const activityBridge = `export async function grantCoreMaterials(
  channelId: string,
  user: NightbotUser | null,
  materials: Record<string, number>
): Promise<void> {
  const state = await touchCoreState(channelId, user);

  for (const [id, value] of Object.entries(materials)) {
    addToBag(state.materials, id, value);
    state.stats.materialsCollected += Math.max(0, Math.floor(value));
  }

  await saveCoreState(state);
}

export async function getCoreGuideSnapshot(
  channelId: string,
  user: NightbotUser | null
): Promise<{
  currentTier: number;
  nextTier: number;
  path: string;
  isWall: boolean;
  wallComponent: string;
  stageRange: string;
}> {
  const state = await touchCoreState(channelId, user);
  const nextTier = Math.min(TOTAL_CORES, state.coreTier + 1);
  const path = normalizePathForTier(state, nextTier);
  const stage = getWallStageIndex(nextTier);

  return {
    currentTier: state.coreTier,
    nextTier,
    path: titleCase(path),
    isWall: isWallCore(state, nextTier),
    wallComponent: componentName(
      getWallComponentForPath(path, nextTier)
    ),
    stageRange: PATH_WALL_RANGES[stage],
  };
}

`;

if (!core.includes("export async function grantCoreMaterials")) {
  core = replaceOnce(
    core,
    "export async function getViewerCoreLuck(",
    `${activityBridge}export async function getViewerCoreLuck(`,
    "Activity bridge"
  );
}

if (normalize(coreOriginal) !== core) {
  backup(coreFile, coreOriginal);
  fs.writeFileSync(coreFile, core);
  console.log("✅ Rebalanced every path and added real token uses.");
}

const apiFile = "src/pages/api/core.ts";
const apiOriginal = fs.readFileSync(apiFile, "utf8");
let api = normalize(apiOriginal);

api = replaceOnce(
  api,
  `  formatCoreRecipe,
  formatCoreStatus,
  setCoreFocus,`,
  `  formatCoreRecipe,
  formatCoreStatus,
  formatCoreTokenGuide,
  setCoreFocus,`,
  "core token import"
);
api = replaceOnce(
  api,
  `  switchCorePath,
} from "@/lib/core-system";`,
  `  switchCorePath,
  useCoreToken,
} from "@/lib/core-system";`,
  "core token use import"
);
api = replaceOnce(
  api,
  `  if (action === "switch") return text(res, await switchCorePath(channelId, user, args[1] ?? ""));

  return text(res, await formatCoreStatus(channelId, user));`,
  `  if (action === "switch") {
    return text(
      res,
      await switchCorePath(channelId, user, args[1] ?? "")
    );
  }

  if (action === "tokens") {
    return text(
      res,
      await formatCoreTokenGuide(
        channelId,
        user,
        args.slice(1).join(" ")
      )
    );
  }

  if (action === "token") {
    if ((args[1] ?? "").toLowerCase() === "use") {
      return text(
        res,
        await useCoreToken(
          channelId,
          user,
          args.slice(2).join(" ")
        )
      );
    }

    return text(
      res,
      await formatCoreTokenGuide(
        channelId,
        user,
        args.slice(1).join(" ")
      )
    );
  }

  return text(res, await formatCoreStatus(channelId, user));`,
  "core token routes"
);

if (normalize(apiOriginal) !== api) {
  backup(apiFile, apiOriginal);
  fs.writeFileSync(apiFile, api);
  console.log("✅ Added !core token routes.");
}

for (const updateFile of ["src/lib/update-notes.ts", "src/lib/social-system.ts"]) {
  if (!fs.existsSync(updateFile)) continue;
  const original = fs.readFileSync(updateFile, "utf8");
  let text = normalize(original);

  if (
    text.includes("const UPDATE_NOTES = [") &&
    !text.includes("Progression clarity overhaul:")
  ) {
    text = text.replace(
      "const UPDATE_NOTES = [",
      `const UPDATE_NOTES = [
  "Progression clarity overhaul: all Core paths now have six balanced wall stages; Core tokens have exact uses; Research, Blueprints, Relics, Scanner, Market, !info, and the Activity website were rebuilt around real effects and next-step guidance.",`
    );
    backup(updateFile, original);
    fs.writeFileSync(updateFile, text);
  }
}

console.log("");
console.log("✅ Progression Clarity Overhaul installed.");
console.log("Next: npm run typecheck && npm run build");

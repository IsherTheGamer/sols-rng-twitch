# Sol's RNG Twitch Replica

A 1:1-style Sol's RNG rolling system for Twitch, powered by **Nightbot** commands and a **Vercel** API with **Upstash Redis** state.

## Features

- `!roll` with biome breakthrough, biome-locked auras, and 261+ auras (expandable via `data/auras.json`)
- Biome simulation (normal, rare, event, dev pools) with chat announcements on change + 120s status
- Potions with luck tiers and per-viewer cooldowns
- Strange Controller & Biome Randomizer (global cooldowns)
- Mod commands: force biome, events, dev biomes, force roll

## Quick start

### 1. Clone & deploy

```bash
git clone <your-repo>
cd sols-rng-twitch
npm install
```

Connect the repo to [Vercel](https://vercel.com) and deploy.

### 2. Upstash Redis

1. Create a database at [Upstash](https://upstash.com)
2. Add to Vercel environment variables:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

### 3. Nightbot OAuth (for biome chat messages)

1. Authorize at [Nightbot](https://nightbot.tv/) → Settings → Integrations
2. Add `NIGHTBOT_TOKEN` to Vercel env

### 4. Other env vars

| Variable | Description |
|----------|-------------|
| `CRON_SECRET` | Secret for `/api/biome-tick` (cron + optional timer) |
| `DEFAULT_CHANNEL_ID` | Twitch channel ID for cron biome ticks |

### 5. Nightbot commands

Copy commands from [`nightbot/commands.md`](nightbot/commands.md), replace `YOUR_APP` with your Vercel URL.

## Updating game data

Edit JSON files in `data/`:

- `auras.json` — regenerate with `npm run scrape-wiki` after editing `scripts/scrape-wiki.ts`
- `biomes.json` — spawn rates, durations, messages
- `potions.json` — luck values and cooldown tiers
- `events.json` / `dev-events.json` — events and dev biomes

## Wiki source of truth

Rates follow the [Sol's RNG Wiki](https://sol-rng.fandom.com/wiki/Sol%27s_RNG_Wiki). Notable wiki values:

- Glitched: 1/30,000 per biome change
- Dreamspace: 1/3,500,000 per second (normal biome only)
- Cyberspace: 1/5,000 on Strange Controller / Biome Randomizer
- Singularity: 1/100 when Starfall spawns

## Local development

```bash
npm run dev
# API at http://localhost:3000/api/roll
```

Without Redis, state is ephemeral (in-memory default per request).

## Architecture

- **Nightbot** `$(urlfetch)` calls API with `Nightbot-User` / `Nightbot-Channel` headers
- **Vercel Cron** hits `/api/biome-tick` every minute to simulate biome rolls and send chat messages
- **Luck**: Fixed 1x for `!roll`; potions apply their luck × 1.2 if a dev event is active

## License

MIT — fan project, not affiliated with Sol's Studio.

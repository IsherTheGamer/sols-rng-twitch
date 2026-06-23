# Nightbot Commands

Replace `YOUR_APP` with your Vercel deployment URL (no trailing slash).

```
!commands add !roll $(urlfetch https://YOUR_APP.vercel.app/api/roll?query=$(querystring))
!commands add !rollop -ul=moderator $(urlfetch https://YOUR_APP.vercel.app/api/rollop?query=$(querystring))
!commands add !pop $(urlfetch https://YOUR_APP.vercel.app/api/pop?query=$(querystring))
!commands add !popop -ul=moderator $(urlfetch https://YOUR_APP.vercel.app/api/popop?query=$(querystring))
!commands add !biome $(urlfetch https://YOUR_APP.vercel.app/api/biome)
!commands add !changebiome -ul=moderator $(urlfetch https://YOUR_APP.vercel.app/api/biome?action=change&query=$(querystring))
!commands add !event -ul=moderator $(urlfetch https://YOUR_APP.vercel.app/api/event?query=$(querystring))
!commands add !dev -ul=moderator $(urlfetch https://YOUR_APP.vercel.app/api/dev?query=$(querystring))
!commands add !device $(urlfetch https://YOUR_APP.vercel.app/api/device?query=$(querystring))
!commands add !solinfo $(urlfetch https://YOUR_APP.vercel.app/api/solinfo)
```

## Optional backup timer (if Vercel Cron is unavailable)

Create a Nightbot timer every 2 minutes:

```
$(urlfetch https://YOUR_APP.vercel.app/api/biome-tick?token=YOUR_CRON_SECRET)
```

## Command summary

| Command | Access | Description |
|---------|--------|-------------|
| `!roll` | Everyone | Roll aura (10s per-viewer cooldown) |
| `!roll 5` | Mod+ | Roll 20 times, show 5 rarest |
| `!pop Heavenly Potion` | Everyone | Pop potion (cooldown by potion tier) |
| `!popop Oblivion 3` | Mod+ | Pop up to 5 potions |
| `!biome` | Everyone | Current biome + remaining time |
| `!changebiome rainy` | Mod+ | Force biome |
| `!event summer 2025` | Mod+ | Toggle event |
| `!dev abnormality` | Mod+ | Start dev biome (1 hour) |
| `!device strange controller` | Everyone | Use device (global cooldown) |
| `!rollop chromatic:genesis` | Mod+ | Force roll aura |
| `!solinfo` | Everyone | Command list |

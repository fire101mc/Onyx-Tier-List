# ONYX Discord Results Sync

ONYX now imports tier-test results from:

https://tierlist-bot.vercel.app/api/onyx-tiers

## Flow

1. The Discord bot runs `/results` and publishes the new results to its API.
2. ONYX requests that API when `/api/onyx/players` is loaded.
3. ONYX keeps the newest result for each player + gamemode.
4. Results are stored in the existing PostgreSQL `onyx_store`.
5. The website displays the imported tier and ONYX points.
6. An open website automatically refreshes every 30 seconds.

## Gamemode mapping

- `sword` -> `sword`
- `smp` -> `smp`
- `uhc` -> `uhc`
- `axe_pvp` -> `axe`
- `netherite_pot` -> `nethop`
- `diamond_pot` -> `pot`
- `crystal_pvp` / `crystal` -> `vanilla` (matching the current ONYX Crystal -> Vanilla project decision)
- `vanilla` -> `vanilla`
- `mace` -> `mace`

## Tier points

LT5 1, HT5 2, LT4 3, HT4 4, LT3 6, HT3 10, LT2 20, HT2 30, LT1 45, HT1 60.

The `resultId` is used to prevent duplicate history imports.

## Manual refresh endpoint

The server also exposes:

POST `/api/onyx/sync-discord`

It requires the existing ONYX ingest token or an authenticated admin session.

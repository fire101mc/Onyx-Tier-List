# ONYX Discord Results Sync — FIXED

The ONYX server automatically polls:

https://tierlist-bot.vercel.app/api/onyx-tiers

every 15 seconds and immediately once when the server starts.

When the Discord bot's `/results` command causes a new result to appear in
that API, ONYX imports it automatically.

The website also refreshes its displayed data periodically.

## Important behavior

- Newest result per Discord user + gamemode becomes the active tier.
- `resultId` prevents duplicate history entries.
- `rankEarned` such as `High Tier 1` becomes `HT1`.
- Points are authoritative:
  LT5=1, HT5=2, LT4=3, HT4=4, LT3=6, HT3=10,
  LT2=20, HT2=30, LT1=45, HT1=60.
- Discord IDs/usernames, tester, region, previous rank and timestamp are stored.
- Crystal PvP and Vanilla are kept as SEPARATE gamemodes.
- Netherite Pot -> NethOP.
- Diamond Pot -> Pot.
- Axe PvP -> Axe.
- UHC -> UHC.
- Sword -> Sword.
- SMP -> SMP.

## Testing

After deploying, open:

GET /api/onyx/sync-discord

It should return JSON showing `ok`, `count`, `changed`, and `persisted`.

The source should be:
https://tierlist-bot.vercel.app/api/onyx-tiers

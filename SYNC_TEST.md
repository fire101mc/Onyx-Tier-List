# Quick sync test

1. Deploy/restart ONYX.
2. Check the server log for:
   [ONYX] Discord results sync: ... latest player/gamemode results checked
3. Open /api/onyx/sync-discord in the browser.
4. Check /api/onyx/players.
5. Run Discord /results and wait for the next poll (up to 15 seconds).
6. Refresh /api/onyx/players or the website.

If `/api/onyx/sync-discord` reports `ok:false`, the `error` field identifies the failure.

# OnyxPvPBridge 1.1.4

Companion plugin for OnyxPvP 1.1.3.

Features:
- `/elo set <player> <mode> <amount>` for admins with `onyxpvp.admin`.
- Queue aliases: `nethop` -> `nethpot`, `pot` -> `diapot`.
- Sends match ELO/tier changes to the ONYX website API.
- Shows large VICTORY/DEFEAT titles after ranked matches.

Install this JAR **alongside** OnyxPvP 1.1.3; do not remove OnyxPvP.

Configure `config.yml` with the Render backend URL and the same `ONYX_INGEST_TOKEN` used by the backend.

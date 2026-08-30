# Railway Runtime Boundaries

The current production service remains in `combined` mode by default, preserving its existing web and Promotion worker behavior.

## Future split rollout

Perform the split atomically to avoid duplicate job processing:

1. Existing web service: set `MARK8BOT_RUNTIME_ROLE=web`; keep the existing build/start commands.
2. Add `telegram-promotion-worker` from this repository and `main`; use the same build command and `npm run start:promotion-worker`.
3. Verify Promotion jobs on the worker before considering the split complete.

The Promotion worker uses the existing Promotion environment variable names and database contracts. Copy only the variables already required by the current production service; do not introduce MARK credentials.

## MARK foundation

Create `mark-intelligence-worker` only when the owner wants the foundation deployed:

- Repository: `gamersinghji056-lang/telegram-promo-hub`
- Branch: `main`
- Build command: no build required for the foundation
- Start command: `npm run start:mark-worker`
- Healthcheck: `/health`
- Required variable: `MARK8BOT_RUNTIME_ROLE=mark-intelligence-worker`

This process exposes health only. It has no bot token, AI integration, message handling, or product behavior.

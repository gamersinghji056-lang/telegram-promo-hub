# Railway Runtime Boundaries

The current production service remains in `combined` mode by default, preserving existing web, Promotion bot webhook/API, campaign jobs, Telegram jobs and TRON payment monitoring until the split is performed atomically.

## Target service layout

Use the same repository and `main` branch for each service.

| Service | Start command | Runtime role | Responsibility |
| --- | --- | --- | --- |
| web | `npm run start:web` | `web` | Public website, Promotion Mini App, MARK Coming Soon app, admin, API routes. No background loops. |
| telegram-worker | `npm run start:telegram-worker` | `telegram-worker` | Telegram session/background jobs: group discovery, audience discovery, bulk join, Add Users and Growth Intelligence collection. |
| blockchain-worker | `npm run start:blockchain-worker` | `blockchain-worker` | Existing USDT/TRC20 invoice expiry and payment monitoring. |
| order-worker | `npm run start:order-worker` | `order-worker` | Existing campaign/queued operational job processing. |
| promotion-bot | `npm run start:promotion-bot` | `promotion-bot` | Promotion bot webhook/API runtime if Telegram webhook traffic is routed to a dedicated service. No background loops. |
| mark-ai | `npm run start:mark-worker` | `mark-ai` | MARK foundation health endpoint only. No AI, no Telegram bot, no message handling. |

## Safe rollout

Do not run `combined` and split worker services at the same time for the same queues.

1. Deploy and verify the new service definitions.
2. Move public/web traffic to `web` and set `MARK8BOT_RUNTIME_ROLE=web` on the existing web service.
3. Start exactly one owner for each background responsibility: `telegram-worker`, `blockchain-worker`, and `order-worker`.
4. Keep `promotion-bot` separate only if the Telegram webhook is deliberately routed there; otherwise webhook handling can remain on `web`.
5. Start `mark-ai` only as a health-only foundation until MARK AI is explicitly implemented.

## Environment variable names

Copy only the existing variables required by each current responsibility. Do not invent MARK credentials and do not use Promotion Telegram credentials for MARK.

- `web`: existing website, Supabase, Telegram webhook/API, bot, public URL and auth variables.
- `telegram-worker`: existing Supabase, Telegram session encryption and worker limit variables.
- `blockchain-worker`: existing Supabase and TRON/USDT billing monitor variables.
- `order-worker`: existing Supabase, Telegram bot/session and campaign worker variables.
- `promotion-bot`: existing Supabase, Telegram bot token, webhook secret/public URL variables if webhook traffic is moved here.
- `mark-ai`: `MARK8BOT_RUNTIME_ROLE=mark-ai` plus Railway-provided `PORT`.

`start:promotion-worker` remains available as a compatibility command for the older all-in-one Promotion worker role.

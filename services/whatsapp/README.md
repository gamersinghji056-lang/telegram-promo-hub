# WhatsApp Web Service

This is the isolated React + TypeScript + Vite foundation for the WhatsApp web service.

- Minimal page: `MARK WhatsApp \u2014 Service Ready`
- Health route: `GET /health` returns `{ status: "ok", service: "whatsapp-web", timestamp }`
- No Telegram integration, authentication, or Supabase logic yet.

## Local scripts

- `npm run dev` - Vite development server
- `npm run build` - Build production bundle
- `npm run preview` - Vite preview server
- `npm run start` - Start command suitable for deployment (uses `PORT` when set)

## Environment

Copy `.env.example` when configuring deployment/runtime environment.

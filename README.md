# Power4 Ooredoo Internet Activation (React + Express)

A web application ported from the original Python/Telegram Ooredoo bot (v1.5.22 Unlimited Mode) to a modern React + Express architecture.

## Features Ported
- **Multi-Number Management**: Save, switch, and manage multiple Ooredoo Algeria (`05XXXXXXXX`) phone numbers with masked display formatting.
- **Smart Auto-Activation**: Numbers previously authenticated and saved automatically activate the 1 GB internet bundle or redeem Power Snake gamification rewards with a single click.
- **SMS OTP Verification**: Multi-step handshake with Ooredoo BFF (`/users/status`, `/userInfo`, `/checkpoint/token`, and `/openid-connect/token`), 6-digit code input, and a 40-second cooldown protection.
- **Bundle & Reward Activation**: Triggers Ooredoo BFF bundle purchase (`DATA_1000_KTM` 1GB / 3 days validity) and checks `/gamification/power-snake` rewards.
- **Live Activations History**: Real-time log of recent internet activations with timestamps, masked numbers, and status.
- **System & Proxy Configuration**: Residential proxy management (`host:port:user:pass`) and diagnostic system configuration viewer.

## Architecture
- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Lucide icons, Cairo Arabic typography.
- **Backend**: Node.js / Express proxying Ooredoo BFF mobile-android endpoints with request signing, integrity tokens, and JSON file persistence (`data/ooredoo_users.json` and `data/ooredoo_activations.json`).
- **Dev Server**: Vite integrated directly with Express on port 3000.
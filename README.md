This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Authentication

The app uses **passwordless login** via WhatsApp one-time codes. A user
enters their phone number on `/login`, we look them up in the `Watchman`
or `Volunteer` tables, and send a 6-digit code to their WhatsApp. Admin
privileges are granted by phone number via the `ADMIN_PHONES` env var.

### How WhatsApp messages are sent

Messages are sent via **[Baileys](https://github.com/WhiskeySockets/Baileys)**,
a headless WhatsApp Web client. There's **no Twilio, no Meta Business
verification, no per-message cost** — the app acts as a linked device on
a WhatsApp account you own (ideally a dedicated spare number, not your
personal one).

You pair it once by scanning a QR code; Baileys then stays connected as
long as the app is running. Pairing credentials are stored in a volume
so they survive redeploys.

### Required environment variables

| Variable                  | Purpose                                                           |
|---------------------------|-------------------------------------------------------------------|
| `DATABASE_URL`            | Postgres connection string.                                       |
| `ADMIN_PHONES`            | Comma-separated admin phones in E.164 (e.g. `+50588886666,+50577771111`). |
| `PHONE_DEFAULT_COUNTRY`   | Optional. ISO country used when users type a local number. Default `NI`. |
| `WA_AUTH_DIR`             | Optional. Directory where the WhatsApp session is persisted. Defaults to `./wa-auth` in dev, `/app/wa-auth` in the Docker image. |
| `WA_SETUP_TOKEN`          | Long random string that lets you reach `/admin/whatsapp-setup?token=…` *before* anyone can log in (bootstrap). Generate with `openssl rand -hex 24`. |
| `SESSION_SECRET`          | Secret used to sign the `ci_session` cookie. Generate with `openssl rand -hex 32`. |
| `REMINDER_TZ`             | Optional. IANA timezone the daily reminder job runs in. Default `America/Managua`. |

If the WhatsApp socket isn't connected at the time an OTP is requested,
the code is printed to the server console as a fallback — handy for
local dev when you don't want to pair a real phone.

### First-time setup (local dev)

1. `npm install`
2. Apply migrations and generate the Prisma client:
   ```bash
   npx prisma migrate deploy   # or `prisma migrate dev` in development
   npx prisma generate
   ```
3. Add at least one `Watchman` or `Volunteer` row with a phone number
   that matches an entry in `ADMIN_PHONES`.
4. Start the dev server: `npm run dev`
5. (Optional) Skip pairing: just visit `/login`, enter the admin phone,
   and copy the 6-digit code from the terminal into the form.

### First-time setup (Coolify production)

1. Push the repo and create a new Application in Coolify pointing at it.
2. In **Environment Variables**, set at minimum:
   - `DATABASE_URL` (your Postgres URL)
   - `ADMIN_PHONES` (comma-separated, E.164)
   - `WA_SETUP_TOKEN` (`openssl rand -hex 24`)
3. In **Storages → Add persistent volume**:
   - **Name**: `wa-auth`
   - **Mount path**: `/app/wa-auth`
   (Without this, every redeploy forces a new QR scan.)
4. Deploy. Once the container is healthy, pair WhatsApp:
   1. Open `https://<your-domain>/admin/whatsapp-setup?token=<WA_SETUP_TOKEN>`
   2. On the phone you want to use as the sender, open WhatsApp →
      **Settings → Linked Devices → Link a Device** → scan the QR.
   3. The page flips to **Connected** within a few seconds.
5. **Create the first admin** at
   `https://<your-domain>/admin/bootstrap?token=<WA_SETUP_TOKEN>`.
   Enter your name and the phone number you put in `ADMIN_PHONES`. The
   page locks itself permanently after the first user is created — no
   need to touch Prisma Studio in prod.
6. Log in at `/login` with that phone. You'll receive the 6-digit code
   via WhatsApp.
7. (Optional) Once logged in, unset `WA_SETUP_TOKEN` in Coolify to
   close the bootstrap hatch entirely.

### Choosing the sender phone

- **Use a dedicated phone number**, not your personal WhatsApp. If the
  number ever gets flagged by Meta, you lose only that number.
- The number must be registered on WhatsApp on a real phone first
  (WhatsApp requires an initial install). After that the phone only
  needs to come online occasionally (roughly once every 2 weeks) for the
  linked device to keep working.
- Keep message volume modest (this app already caps itself at ~1 code
  per phone per minute, so this isn't a concern in practice).

### Operational notes

- If the socket disconnects, it auto-reconnects after 3 seconds.
- If WhatsApp reports **logged out** (the operator tapped "Unlink" on
  the phone, or Meta invalidated the session), the stored creds become
  unusable. Visit `/admin/whatsapp-setup` → **Unlink and re-pair** and
  scan again.
- Baileys keeps a persistent WebSocket — **do not deploy this app on
  serverless** (Vercel/Netlify/Cloudflare Workers). Coolify / Fly.io /
  Railway / a plain VPS all work.

## Daily WhatsApp reminders

The app runs a cron job at **08:00** local time (controlled by
`REMINDER_TZ`, default `America/Managua`) that sends:

- **Night watchmen**: a reminder if they have a shift today.
- **Volunteers**: a welcome message on their arrival day, and a
  checkout reminder on their departure day.
- **Admins** (everyone in `ADMIN_PHONES`): a daily digest listing
  today's arrivals, departures, and watchman shifts.

Every send is written to the `ReminderLog` table with a unique index on
`(kind, recipientPhone, referenceId)` — so re-running the job the same
day is a safe no-op.

### Language per recipient

Each `Watchman` and `Volunteer` row has a `language` column (`EN` or
`ES`, nullable). On first login, the user sees a one-time prompt asking
them to choose; the choice is saved and used for all their reminder
message templates. Admins pick up their own preference from the
matching `Watchman`/`Volunteer` row (if one exists); otherwise they get
English.

### Scheduling

The cron is kicked off from `instrumentation.ts` on server boot. There's
nothing to configure at the OS level — as long as the Next.js process is
running, the job will fire.

### Manual trigger

Two options:

1. **UI button** — sign in as admin, open `/admin/whatsapp-setup`. When
   WhatsApp is connected you'll see a **Run reminders now** button that
   returns a `{sent, skipped, errors}` summary.
2. **curl** — `POST /api/admin/run-reminders` with your admin session
   cookie attached. Same response shape.

Both are idempotent within the same calendar day (in `REMINDER_TZ`).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

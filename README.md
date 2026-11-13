# SIDC Internal IT Portal

The in-house IT portal for Shadi International Dental Center. It replaces the Excel sheets for IT assets, employees, and joiner/leaver requests, and keeps a full audit trail.

**Phase 1 (this version):** sign-in and roles, portal user management, HR requests to IT (with the formal email kept as the official record), assets with owner history, employees and their IT accounts, Excel/CSV import, and the audit log.

## Who can do what

| Role | Access |
|---|---|
| **IT Admin** | Everything, including adding and removing portal users, branches, and deleting records added by mistake |
| **IT Staff** | Assets, employees, accounts, imports, and working on HR requests |
| **HR** | Raise *new joiner*, *leaver*, *asset allocation* and *asset return* requests, follow them, comment, and withdraw before IT starts. HR can't see assets, employees or the audit log. |
| **Read-only** | View assets, employees, requests and the audit log (management or auditors) |

The full matrix is in `src/lib/permissions.ts`.

## How HR requests work (the audit trail)

1. HR signs in and submits a request.
2. The portal **stores the complete email first** and then sends it to the IT mailbox, with the HR requester (and the HR team mailbox) in copy. The stored copy is the official record. A database trigger stops anyone from changing or deleting it.
3. IT sees the request in **HR requests**, takes it, and can talk to HR in the conversation.
4. IT closes the request with a summary, and the portal sends HR a formal confirmation email, which is stored the same way.
5. Every step is written to the **audit log**: who, what, when, and the old and new values. The log is append-only and enforced in the database, so even a database admin can't UPDATE or DELETE entries.

## Sign-in (no passwords)

The clinic uses Roundcube webmail, so there's no Microsoft or Google single sign-on to use. Sign-in works like this:

1. Enter your clinic email. The portal emails you a 6-digit code (it expires after 10 minutes, with 5 attempts and a rate limit).
2. Enter the code from your **authenticator app** (Microsoft Authenticator, Google Authenticator, etc.). On first sign-in you scan a QR code to set it up.

Only emails an IT Admin has added can sign in. Removing a user signs them out immediately. If someone loses their phone, an Admin can **Reset 2-step** for them. The portal stores no passwords at all, and it refuses to save notes on IT accounts that mention passwords.

## Testing on Supabase

1. Create a Supabase project. Pick the region closest to the UAE, and check data-residency rules before you add real staff data.
2. In **Project Settings → Data API**, turn the Data API **off**. The portal doesn't use it. As a safety net, a migration also enables row-level security and revokes the `anon` and `authenticated` roles on every table.
3. In **Connect → ORMs → Prisma**, copy the two connection strings into `.env` (see `.env.example`):
   - `DATABASE_URL`: the transaction pooler on port 6543, with `?pgbouncer=true&connection_limit=1`
   - `DIRECT_URL`: the session pooler or direct connection on port 5432
4. Run:
   ```bash
   cp .env.example .env          # then fill it in
   npm install
   npx prisma migrate deploy     # creates tables + audit protections
   SEED_ADMIN_EMAIL=you@yourclinic.ae SEED_ADMIN_NAME="Your Name" \
   SEED_BRANCHES="Head Office:HO,Khalifa City:KC" npm run db:seed
   npm run dev                   # http://localhost:3000
   ```
   Add `SEED_DEMO=true` to the seed command to also create a demo IT Staff user (`it.staff@<your domain>`), a demo HR user (`hr@<your domain>`) and three demo employees.
5. **Email while testing:** set `EMAIL_TRANSPORT=log` and sign-in codes and request emails are printed in the terminal instead of being sent. To send real email, set the Roundcube mailbox's SMTP details (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`). Your hosting provider's Roundcube settings page lists them.

## Go-live on the clinic's own server

The app uses only standard PostgreSQL, so moving off Supabase is just a change of connection strings.

```bash
cp .env.example .env    # fill in APP_URL, APP_SECRET, SMTP_*, mailboxes
POSTGRES_PASSWORD='a-long-random-password' docker compose up -d --build   # applies migrations on start
```

Create the first IT Admin once, from any machine with the repo checked out and `DATABASE_URL`/`DIRECT_URL` pointing at the server's database: `SEED_ADMIN_EMAIL=… npm run db:seed`.

- Put a reverse proxy with HTTPS (Caddy, nginx or IIS) in front of port 3000, and only allow access from the clinic network or VPN.
- **Backups:** run `pg_dump` daily to a separate location, and test a restore.
- `APP_SECRET` encrypts the authenticator secrets. Keep it safe, and keep it the same across restarts.

## Moving the Excel data in

Use **Import from Excel**. Import **employees first**, then **assets**, so assets can be linked to their owners by Employee ID (or by exact name). Common column names are recognised automatically (for example *S/N*, *Device Type*, *Emp ID*, *Assigned To*, *DOJ*), and dates can be dd/mm/yyyy, yyyy-mm-dd or Excel dates. You get a preview showing every problem row before anything is saved, and existing records are never overwritten.

## Development

```bash
npm test          # unit tests (TOTP, permissions, import parsing, CSV)
npm run lint      # type-check
npm run build
```

Stack: Next.js 15 (App Router, server actions), PostgreSQL, Prisma 6, Tailwind CSS 4. No third-party asset or ticketing tools.

## Roadmap

- **Phase 2:** guided joiner and leaver workflows (pick accounts and assets on the request itself), PDF copy of each confirmation, record locking after sending, and asset attachments (invoice, photo)
- **Phase 3:** knowledge base, dashboard charts, reports
- **Phase 4:** tickets, licences, software inventory, vendor contracts

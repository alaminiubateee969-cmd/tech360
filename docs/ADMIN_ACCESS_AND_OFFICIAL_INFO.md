# Super Admin & Admin login + Official Info (company pad)

## Logins (one door, two roles)

- **Console:** `/#/admin` (e.g. https://tech360.space-z.ai/#/admin)
- **Client portal:** `/#/portal`
- Sign in with your console email + password. The **role on your account**
  decides access — it is never chosen on the login screen.

| Role | Access |
|---|---|
| `SUPER_ADMIN` | Full control: Team & roles, Settings, feature/payment switches, AI workforce, command center, final approvals, official documents, audit logs |
| `ADMIN` | Operations: clients, projects, Content Studio, Software Factory, reports, media & feeds. Cannot change roles, governance switches, or gateway credentials |
| `MANAGER` / `STAFF` | Limited console views per the server-side role gates |

Security: forced password change on first login, optional TOTP 2FA,
lockout after 5 failed attempts, HttpOnly session cookies, CSRF on
mutations, every login audit-logged.

## First-boot accounts (seed)

Set in the server environment **before** `npm run db:seed`, then remove
the passwords from the environment:

```bash
# Super Admin (required in production)
ADMIN_EMAIL=
ADMIN_PASSWORD=          # >= 12 chars in production

# Admin / operations account (optional second login)
STAFF_ADMIN_EMAIL=
STAFF_ADMIN_PASSWORD=    # >= 12 chars in production
```

More accounts anytime: **Super Admin → Team → Create user** (role
`SUPER_ADMIN` / `ADMIN` / `MANAGER` / `STAFF`; a one-time temporary
password is shown once, rotation forced on first login).

> Passwords are never committed, never printed on official documents,
> and never shared in PDFs or chat. This document intentionally
> contains no credentials.

## Official info — on the official pad

Owner-issued pad: `public/brand/TECH360_Official_A4_Letterhead.pdf`
(also served at `/official/TECH360_Official_A4_Letterhead.pdf`).
Facts extracted from it (verbatim) plus platform contacts live in
`OFFICIAL_INFO` (`src/lib/constants.ts`):

| Field | On the pad | Platform in use |
|---|---|---|
| Legal name | TECH360 LLC — Missouri LLC LC014737249 · EIN 98-1940053 | same |
| Address | 117 S Lexington St Ste 100, Harrisonville, MO 64701, USA | same |
| Phone | +1 (347) 433 1200 | +1 (816) 380-8660 |
| Website | www.tech360.com | bdtech360.com · tech360.space-z.ai |
| Email | info@tech360.com | info@bdtech360.com |
| WhatsApp | — | +880 1327-100297 |
| Tagline | CONNECT · INNOVATE · GROW / INNOVATE·AUTOMATE·TRANSFORM·SECURE | Web \| Cloud \| AI \| Data \| Tech |
| Services | Digital Solutions · Website Design · SEO Optimization · Tech Integration · Global Connectivity · Cloud Services | + CRM, portals, dashboards, WhatsApp/n8n automation, AI agents |

Shareable outputs:

1. **Official Info Sheet (print/PDF):** `/api/official-info`
2. **Official Info PDF:** `/official/TECH360-Official-Info.pdf`
   (regenerate: `pip install pymupdf && python3 scripts/generate-official-info-pdf.py`)
3. **Official Letterhead PDF:** `/official/TECH360_Official_A4_Letterhead.pdf`

The same info appears on the Super Admin & Admin login screen
(pad header + ADDRESS/PHONE/WEBSITE/EMAIL footer), in the console
under **System → Official Info**, and in the public site footer.

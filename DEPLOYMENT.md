# TECH360 deployment

## Supported production path: Hostinger Node.js Web App

This repository deploys through Hostinger's Node.js Web App Git integration. It does **not** require a VPS, SSH deployment, PM2, rsync, scp, or a reverse proxy managed by this repository.

```text
GitHub main
  -> Hostinger Node.js Web App
  -> Node.js 22
  -> npm ci
  -> npm run hostinger:build
  -> npm run start
```

Configure the app in hPanel with:

| Setting | Value |
|---|---|
| Application type | Node.js Web App |
| Repository | `alaminiubateee969-cmd/tech360` |
| Branch | `main` |
| Node.js | `22` |
| Install | `npm ci` |
| Build | `npm run hostinger:build` |
| Start | `npm run start` |
| Database | Hostinger MySQL |
| Domains | `bdtech360.com`, `www.bdtech360.com` |

Use the actual application directory shown by Hostinger; this repository does not guess it. Put production variables in Hostinger's Environment Variables panel. Never commit `.env`.

See:

- `docs/HOSTINGER_DEPLOYMENT.md` for the Hostinger-specific operational checklist.
- `docs/HOSTINGER_DEPLOYMENT_MATRIX.md` for the machine-verified audit and blockers.
- `docs/HOSTINGER_ENVIRONMENT_VARIABLES.md` for the variable manifest.

## Retired paths

The former SSH/PM2 helper at `scripts/deploy-hostinger.sh` is intentionally fail-fast. The `deployment/` directory contains historical Google Cloud material and is not part of Hostinger production. Do not use either path for the Hostinger application.

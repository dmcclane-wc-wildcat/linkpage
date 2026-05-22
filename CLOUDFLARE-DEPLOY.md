# Cloudflare Pages deploy checklist

Use these **exact** settings when connecting your GitHub repo. Most deploy failures come from wrong build settings or a missing D1 database ID.

## Before you connect GitHub

### 1. Create the D1 database and update `wrangler.toml`

On your PC, in the project folder:

```powershell
npx wrangler d1 create it-links-db
```

Copy the `database_id` from the output (a long UUID). Open `wrangler.toml` and replace:

```toml
database_id = "REPLACE_AFTER_CREATE"
```

with your real ID, for example:

```toml
database_id = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
```

Then run migrations on production:

```powershell
npm run db:migrate:remote
```

Commit and push `wrangler.toml`:

```powershell
git add wrangler.toml
git commit -m "Add D1 database ID for Cloudflare"
git push
```

**If `database_id` is still `REPLACE_AFTER_CREATE`, the Cloudflare build or deploy will fail.**

---

## Cloudflare Pages project settings

In **Workers & Pages** → your project → **Settings** → **Build**:

| Setting | Value |
|--------|--------|
| **Production branch** | `main` |
| **Root directory** | `/` (leave empty or `.` — **not** `frontend`) |
| **Build command** | `npm run build` |
| **Build output directory** | `frontend/dist` |
| **Node.js version** | `20` (or enable in Environment variables: `NODE_VERSION` = `20`) |

Do **not** use `npm run dev`. Use **`npm run build`** only.

---

## D1 database binding (required)

1. **Workers & Pages** → your project → **Settings** → **Functions**
2. Under **D1 database bindings**, add:
   - **Variable name:** `DB`
   - **D1 database:** `it-links-db`

This must match `binding = "DB"` in `wrangler.toml`.

---

## Secrets (required for login)

**Settings** → **Environment variables** → **Production** (and Preview if you use it):

| Name | Type | Notes |
|------|------|--------|
| `PASSPHRASE` | Secret | Team passphrase to open the site |
| `SESSION_SECRET` | Secret | Long random string, e.g. 32+ characters |

Generate a session secret (PowerShell):

```powershell
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object { [char]$_ })
```

Without these, the site may build but login/API will fail.

---

## Fix: `npm ci` / lock file out of sync

If the build log shows `Missing: it-links-frontend` or `package.json and package-lock.json are in sync`:

1. Pull the latest code (stale `package-lock.json` was removed from the repo).
2. In Cloudflare → **Build** → set build command to: `npm run build`
3. Commit and push, then **Retry deployment**.

Optionally, on your PC run `npm install` once and commit the new `package-lock.json` for faster installs (not required).

---

## Retry deploy

After fixing settings and pushing `wrangler.toml`:

1. **Deployments** → **Retry deployment** on the failed build, or
2. Push any small commit to trigger a new build

---

## Common error messages

| Error | Fix |
|-------|-----|
| `npm ci` / lock file out of sync / `Missing: it-links-frontend` | Delete old `package-lock.json` from the repo (or run `npm install` locally and commit the new lock file). Cloudflare auto-runs `npm install` before your build command |
| `Could not resolve "react"` / `vite: command not found` | Ensure `workspaces` includes `frontend` in root `package.json`; build command: `npm run build` |
| `pages_build_output_dir` / config ignored | Ensure `wrangler.toml` has `pages_build_output_dir = "frontend/dist"` (committed to Git) |
| `REPLACE_AFTER_CREATE` / invalid database | Set real `database_id` in `wrangler.toml` and push |
| Build succeeds, blank page or 404 | Build output directory must be `frontend/dist`, root directory must be repo root |
| Login fails after deploy | Add `PASSPHRASE` and `SESSION_SECRET` secrets; bind D1 as `DB` |
| Add link returns 500 / Internal Server Error | Run `npm run db:migrate:remote` on your PC; confirm D1 binding `DB` → `it-links-db`; open `https://YOUR-SITE.pages.dev/api/health` — should return `{"ok":true}` |
| Functions not running | Root directory must not be `frontend`; `functions/` folder must be at repo root |

---

## If it still fails

Open the failed deployment → **View build log** → copy the **last 20–30 lines** of the log. That shows whether the failure is:

- **Installing dependencies** (npm)
- **Building** (vite / typescript)
- **Deploying** (Cloudflare / wrangler / D1)

Share that snippet to troubleshoot the exact step.

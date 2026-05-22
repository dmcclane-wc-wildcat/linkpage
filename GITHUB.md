# Push to GitHub (quick steps)

Run these in PowerShell from this folder (`Website of Links`).

## 1. Install dependencies (first time only)

```powershell
npm install
```

This installs the root workspace and `frontend` together. Optional: commit the generated `package-lock.json` for faster Cloudflare builds.

## 2. Create the GitHub repo

1. Go to https://github.com/new
2. Name it e.g. `it-links-dashboard`
3. Leave it **empty** (no README, no .gitignore)
4. Create repository

## 3. Push this project

Replace `YOUR_USERNAME` with your GitHub username:

```powershell
git init
git add .
git commit -m "Initial IT links dashboard"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/it-links-dashboard.git
git push -u origin main
```

If Git asks you to sign in, use GitHub CLI (`gh auth login`) or a [personal access token](https://github.com/settings/tokens) as the password.

## 4. Next: Cloudflare

Follow the **Deploy to Cloudflare Pages** section in [README.md](./README.md).

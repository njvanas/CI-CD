# Commands to Commit and Push Changes

Run these commands in your terminal (PowerShell or Git Bash):

## Step 1: Check Current Status
```powershell
cd "c:\Users\NicolaasJohannesvanA\OneDrive - Delorentz & Partners B.V\Documents\TEMP-CICD"
git status
```

## Step 2: Commit All Changes
```powershell
git commit -m "Make repository fork-ready: Add dynamic repo detection and comprehensive setup guide"
```

## Step 3: Push to GitHub
```powershell
git push origin master
```

---

## Alternative: If you want to exclude helper files

If you want to exclude `SYNC-COMMANDS.md` and `push-to-github.ps1` from the commit:

```powershell
# Unstage specific files
git reset HEAD SYNC-COMMANDS.md
git reset HEAD push-to-github.ps1

# Then commit
git commit -m "Make repository fork-ready: Add dynamic repo detection and comprehensive setup guide"

# Push
git push origin master
```

---

## What This Commit Includes

✅ **Dynamic Repository Detection**: Website automatically detects your GitHub username and repo name
✅ **Updated README.md**: Generic instructions that work for anyone
✅ **New SETUP.md**: Comprehensive fork setup guide
✅ **Updated index.html**: Dynamic links that work for any fork
✅ **Updated script.js**: Auto-detects repository URLs from GitHub Pages

After pushing, anyone who forks this repository will be able to:
- Deploy to their own GitHub Pages automatically
- See their own repository links (not yours)
- Follow simple setup instructions

---

## After Pushing

1. **Enable GitHub Pages** (if not done yet):
   - Go to: https://github.com/njvanas/TEMP-CI-CD/settings/pages
   - Under "Source", select **GitHub Actions**
   - Click **Save**

2. **Test the Fork-Ready Features**:
   - Fork the repository to a test account
   - Enable Pages in the fork
   - Verify that links automatically point to the fork's repository

3. **Your Site**:
   - https://njvanas.github.io/TEMP-CI-CD/

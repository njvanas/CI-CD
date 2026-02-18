# Commands to Sync with GitHub

Run these commands in your terminal (PowerShell or Git Bash):

```powershell
cd "c:\Users\NicolaasJohannesvanA\OneDrive - Delorentz & Partners B.V\Documents\TEMP-CICD"

# Check current status
git status

# Push to GitHub (choose one method):

# Method 1: SSH (if you have SSH keys set up)
git push origin master

# Method 2: HTTPS (if SSH doesn't work)
git remote set-url origin https://github.com/njvanas/TEMP-CI-CD.git
git push origin master
```

## After pushing:

1. **Enable GitHub Pages** (if not done yet):
   - Go to: https://github.com/njvanas/TEMP-CI-CD/settings/pages
   - Under "Source", select **GitHub Actions**
   - Click **Save**

2. **Check the workflow**:
   - Go to: https://github.com/njvanas/TEMP-CI-CD/actions
   - The workflow should run automatically

3. **Your site will be live at**:
   - https://njvanas.github.io/TEMP-CI-CD/

## Current commits ready to push:
- Initial commit: GitHub Pages CI/CD setup
- Fix: Add enablement parameter to Pages setup and update README with troubleshooting

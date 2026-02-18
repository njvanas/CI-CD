# Commands to Fix Git Lock and Push

Run these commands **one at a time** in PowerShell:

## Step 1: Navigate to Repository
```powershell
cd "c:\Users\NicolaasJohannesvanA\OneDrive - Delorentz & Partners B.V\Documents\TEMP-CICD"
```

## Step 2: Remove the Lock File
```powershell
Remove-Item -Path ".git\index.lock" -Force
```

**OR if that doesn't work, try:**
```powershell
del .git\index.lock
```

## Step 3: Verify Lock File is Gone
```powershell
Test-Path .git\index.lock
```
(This should return `False` if the lock file is removed)

## Step 4: Check Git Status
```powershell
git status
```

## Step 5: Commit the Changes
```powershell
git commit -m "Make repository fork-ready: Add dynamic repo detection and comprehensive setup guide"
```

## Step 6: Push to GitHub
```powershell
git push origin master
```

---

## Alternative: If Lock File Persists

If you still get the lock file error, try closing:
- Any Git GUI applications (GitHub Desktop, SourceTree, etc.)
- VS Code/Cursor if it has Git operations running
- Any terminal windows with Git commands

Then try Step 2 again.

---

## Quick One-Liner (if lock file is removed)

If the lock file is already gone, you can run:
```powershell
cd "c:\Users\NicolaasJohannesvanA\OneDrive - Delorentz & Partners B.V\Documents\TEMP-CICD" && git commit -m "Make repository fork-ready: Add dynamic repo detection and comprehensive setup guide" && git push origin master
```

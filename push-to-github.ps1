# PowerShell script to push to GitHub
# Run this after creating the repository at https://github.com/new

cd "c:\Users\NicolaasJohannesvanA\OneDrive - Delorentz & Partners B.V\Documents\TEMP-CICD"

# Add remote (replace if you used a different repo name)
git remote add origin https://github.com/njvanas/TEMP-CICD.git

# Push to GitHub
git push -u origin master

Write-Host "`n✅ Code pushed successfully!" -ForegroundColor Green
Write-Host "`nNext steps:" -ForegroundColor Yellow
Write-Host "1. Go to: https://github.com/njvanas/TEMP-CICD/settings/pages" -ForegroundColor Cyan
Write-Host "2. Under 'Source', select 'GitHub Actions'" -ForegroundColor Cyan
Write-Host "3. Your site will be live at: https://njvanas.github.io/TEMP-CICD/" -ForegroundColor Cyan

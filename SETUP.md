# Setup Guide for Forking

This repository is designed to work automatically when forked to your own GitHub account. Follow these simple steps:

## 🚀 Quick Setup (3 Steps)

### Step 1: Fork the Repository
1. Click the **Fork** button at the top right of this repository
2. Choose where to fork it (your personal account or organization)
3. Wait for the fork to complete

### Step 2: Enable GitHub Pages
1. Go to your forked repository: `https://github.com/YOUR_USERNAME/TEMP-CI-CD`
2. Click **Settings** (in the repository menu)
3. Scroll down to **Pages** (in the left sidebar)
4. Under "Source", select **GitHub Actions**
5. Click **Save**

### Step 3: Wait for Deployment
1. Go to the **Actions** tab in your repository
2. You should see a workflow run automatically (or trigger it manually)
3. Once complete, your site will be live at:
   ```
   https://YOUR_USERNAME.github.io/TEMP-CI-CD/
   ```

## ✨ What Happens Automatically

- **Repository Detection**: The website automatically detects your GitHub username and repository name from the GitHub Pages URL
- **Links Update**: All GitHub links (repository, actions, etc.) automatically point to your fork
- **No Configuration**: No need to edit any files or change any URLs

## 🎨 Customization

After forking, you can customize:

- **Content**: Edit `index.html` to change the website content
- **Styling**: Modify `styles.css` to change colors, fonts, and layout
- **Functionality**: Update `script.js` to add new features
- **Branding**: Change the logo, title, and footer text

Every time you push changes, GitHub Actions will automatically deploy the updated site!

## 🔧 Troubleshooting

### Workflow Fails with "Pages site failed" Error
- Make sure you've enabled GitHub Pages in Settings → Pages
- Select "GitHub Actions" as the source
- Re-run the workflow from the Actions tab

### Links Don't Work
- The website detects your repository from the GitHub Pages URL
- If you're testing locally, links will show placeholders
- Once deployed to GitHub Pages, links will work automatically

### Site Not Updating
- Check the Actions tab to see if the workflow ran successfully
- Make sure you pushed to the `main` or `master` branch
- Wait 1-2 minutes for deployment to complete

## 📝 Notes

- **Public Repository Required**: GitHub Pages is free only for public repositories
- **Branch Name**: The workflow works with both `main` and `master` branches
- **Deployment Time**: Usually takes 1-2 minutes after pushing

---

**Ready to deploy? Fork this repository and follow the 3 steps above!** 🎉

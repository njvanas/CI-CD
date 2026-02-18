# GitHub Pages CI/CD Demo

A modern website template with automated CI/CD deployment to GitHub Pages using GitHub Actions. **Fork this repository to deploy your own version!**

## 🚀 Features

- **Automated Deployment**: Every push to `main` branch automatically deploys to GitHub Pages
- **Modern UI**: Clean, responsive design with smooth animations
- **CI/CD Pipeline**: GitHub Actions workflow handles the entire deployment process
- **Zero Configuration**: Works out of the box after initial setup
- **Fork-Ready**: Automatically detects your repository and works with any GitHub username

## 📋 Prerequisites

- A GitHub account
- Git installed on your local machine

## 🛠️ Quick Start (Fork Method - Recommended)

### Option 1: Fork This Repository

1. Click the **Fork** button at the top of this repository
2. Your fork will be created at `https://github.com/YOUR_USERNAME/TEMP-CI-CD`
3. Go to **Settings** → **Pages** in your forked repository
4. Under "Source", select **GitHub Actions**
5. Click **Save**
6. Push any change (or wait for the workflow to run automatically)
7. Your site will be live at: `https://YOUR_USERNAME.github.io/TEMP-CI-CD/`

## 🛠️ Setup Instructions (Manual Method)

### 1. Create a GitHub Repository

1. Go to [github.com/new](https://github.com/new)
2. Name your repository (e.g., `my-website`)
3. Choose **Public** (required for free GitHub Pages)
4. **Do NOT** initialize with README, .gitignore, or license
5. Click "Create repository"

### 2. Clone or Download This Repository

```bash
# Clone this repository
git clone https://github.com/YOUR_USERNAME/TEMP-CI-CD.git
cd TEMP-CI-CD

# Or download and extract the ZIP file, then:
cd TEMP-CI-CD
git init
```

### 3. Push to Your GitHub Repository

```bash
# Add your GitHub repository as remote (replace YOUR_USERNAME and YOUR_REPO)
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit: GitHub Pages CI/CD setup"

# Push to GitHub
git branch -M main
git push -u origin main
```

### 4. Enable GitHub Pages

**IMPORTANT**: You must enable GitHub Pages BEFORE the workflow runs:

1. Go to your repository on GitHub: `https://github.com/YOUR_USERNAME/YOUR_REPO_NAME`
2. Click **Settings** → **Pages** (in the left sidebar)
3. Under "Source", select **GitHub Actions**
4. Click **Save**
5. The workflow will automatically run and deploy your site

**If you see an error**: "Get Pages site failed" or "Not Found", it means Pages hasn't been enabled yet. Follow steps 1-4 above first, then re-run the workflow.

### 5. Access Your Website

After the workflow completes (usually takes 1-2 minutes), your site will be available at:
```
https://YOUR_USERNAME.github.io/YOUR_REPO_NAME/
```

**Note**: The website automatically detects your repository URL, so all links will work correctly for your fork!

## 🔄 How CI/CD Works

1. **Push to main branch** → Triggers GitHub Actions workflow
2. **Workflow runs** → Checks out code, prepares deployment
3. **Deploys to GitHub Pages** → Your site is live automatically

The workflow file (`.github/workflows/deploy.yml`) handles everything automatically.

## 📁 Project Structure

```
.
├── index.html          # Main HTML file
├── styles.css          # Stylesheet
├── script.js           # JavaScript functionality
├── .github/
│   └── workflows/
│       └── deploy.yml  # CI/CD workflow (works automatically!)
├── .gitignore          # Git ignore rules
├── README.md           # This file
└── SETUP.md            # Detailed setup guide for forking
```

**See [SETUP.md](SETUP.md) for detailed fork instructions.**

## 🎨 Customization

- Edit `index.html` to change content
- Modify `styles.css` to update styling
- Add functionality in `script.js`
- Push changes → Automatic deployment!

## 📝 Notes

- GitHub Pages is free for public repositories
- Deployment typically takes 1-2 minutes after push
- You can manually trigger deployment via Actions tab → "Deploy to GitHub Pages" → "Run workflow"

## 🔄 Forking This Repository

This repository is designed to work automatically when forked:

- **Repository links** are automatically detected from your GitHub Pages URL
- **Workflow links** point to your repository's Actions tab
- **No configuration needed** - just fork, enable Pages, and deploy!

## 🔗 Resources

- [GitHub Pages Documentation](https://docs.github.com/en/pages)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [How to Fork a Repository](https://docs.github.com/en/get-started/quickstart/fork-a-repo)

## 📄 License

This project is open source and available for personal and commercial use.

---

**Happy Deploying! 🎉**

# GitHub Pages CI/CD Demo

A modern website template with automated CI/CD deployment to GitHub Pages using GitHub Actions.

## 🚀 Features

- **Automated Deployment**: Every push to `main` branch automatically deploys to GitHub Pages
- **Modern UI**: Clean, responsive design with smooth animations
- **CI/CD Pipeline**: GitHub Actions workflow handles the entire deployment process
- **Zero Configuration**: Works out of the box after initial setup

## 📋 Prerequisites

- A GitHub account
- Git installed on your local machine
- A GitHub repository (create one at [github.com/new](https://github.com/new))

## 🛠️ Setup Instructions

### 1. Create a GitHub Repository

1. Go to [github.com/new](https://github.com/new)
2. Name your repository (e.g., `my-website`)
3. Choose **Public** (required for free GitHub Pages)
4. **Do NOT** initialize with README, .gitignore, or license
5. Click "Create repository"

### 2. Initialize Git and Push to GitHub

```bash
# Initialize git repository
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit: GitHub Pages CI/CD setup"

# Add your GitHub repository as remote (replace YOUR_USERNAME and YOUR_REPO)
git remote add origin https://github.com/njvanas/YOUR_REPO_NAME.git

# Push to GitHub
git branch -M main
git push -u origin main
```

### 3. Enable GitHub Pages

1. Go to your repository on GitHub
2. Click **Settings** → **Pages**
3. Under "Source", select **GitHub Actions**
4. The workflow will automatically run and deploy your site

### 4. Access Your Website

After the workflow completes (usually takes 1-2 minutes), your site will be available at:
```
https://njvanas.github.io/YOUR_REPO_NAME/
```

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
│       └── deploy.yml  # CI/CD workflow
├── .gitignore          # Git ignore rules
└── README.md           # This file
```

## 🎨 Customization

- Edit `index.html` to change content
- Modify `styles.css` to update styling
- Add functionality in `script.js`
- Push changes → Automatic deployment!

## 📝 Notes

- GitHub Pages is free for public repositories
- Deployment typically takes 1-2 minutes after push
- You can manually trigger deployment via Actions tab → "Deploy to GitHub Pages" → "Run workflow"

## 🔗 Resources

- [GitHub Pages Documentation](https://docs.github.com/en/pages)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Your GitHub Profile](https://github.com/njvanas)

## 📄 License

This project is open source and available for personal and commercial use.

---

**Happy Deploying! 🎉**

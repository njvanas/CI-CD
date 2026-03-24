// Simple interactive functionality
function showMessage() {
    const messageEl = document.getElementById('message');
    const messages = [
        '🚀 CI/CD is working!',
        '✨ GitHub Actions deployed this!',
        '🎉 Your site is live!',
        '⚡ Automated deployment successful!'
    ];
    
    const randomMessage = messages[Math.floor(Math.random() * messages.length)];
    messageEl.textContent = randomMessage;
    messageEl.classList.remove('hidden');
    
    // Smooth scroll to message
    messageEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Smooth scrolling for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({ behavior: 'smooth' });
        }
    });
});

// Add animation on scroll
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// Observe sections for animation
document.querySelectorAll('section').forEach(section => {
    section.style.opacity = '0';
    section.style.transform = 'translateY(20px)';
    section.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    observer.observe(section);
});

// CI/CD Pipeline Animation
function animatePipeline() {
    const steps = document.querySelectorAll('.pipeline-step');
    let delay = 0;
    
    steps.forEach((step, index) => {
        setTimeout(() => {
            step.style.opacity = '0';
            step.style.transform = 'scale(0.8)';
            step.style.transition = 'all 0.5s ease';
            
            setTimeout(() => {
                step.style.opacity = '1';
                step.style.transform = 'scale(1)';
                
                // Add completion effect
                if (index === steps.length - 1) {
                    step.style.borderColor = '#22c55e';
                    step.style.boxShadow = '0 0 20px rgba(34, 197, 94, 0.25)';
                }
            }, 100);
        }, delay);
        
        delay += 800;
    });
}

// Animate pipeline on page load
window.addEventListener('load', () => {
    setTimeout(animatePipeline, 500);
});

// Update deployment time
function updateDeploymentTime() {
    const deployTimeEl = document.getElementById('deploy-time');
    if (deployTimeEl) {
        const times = ['~1 minute', '~2 minutes', '~3 minutes'];
        let currentIndex = 0;
        
        setInterval(() => {
            deployTimeEl.textContent = times[currentIndex];
            currentIndex = (currentIndex + 1) % times.length;
        }, 3000);
    }
}

updateDeploymentTime();

// Simulate pipeline status updates
function simulatePipelineStatus() {
    const statusElements = document.querySelectorAll('.step-status');
    const statuses = [
        { class: 'active', text: 'Running' },
        { class: 'active', text: 'Processing' },
        { class: 'success', text: 'Completed' }
    ];
    
    statusElements.forEach((el, index) => {
        if (index < statusElements.length - 1) {
            // Keep first 3 steps as active
            el.className = 'step-status active';
        } else {
            // Last step is success
            el.className = 'step-status success';
        }
    });
}

// Run simulation on load
setTimeout(simulatePipelineStatus, 2000);

// Step information for modal popups
const stepInfo = {
    1: {
        icon: '📝',
        title: '1. Code Commit',
        description: 'This is where your CI/CD journey begins! When you push code to your GitHub repository, it triggers the entire deployment pipeline.',
        details: [
            'Developer writes code locally',
            'Code is committed to Git',
            'Changes are pushed to GitHub repository',
            'GitHub detects the push event'
        ],
        result: 'The push event triggers GitHub Actions workflow automatically'
    },
    2: {
        icon: '🔍',
        title: '2. GitHub Actions',
        description: 'GitHub Actions is the automation engine that runs your CI/CD workflow. It detects the push and starts the deployment process.',
        details: [
            'GitHub Actions detects the push event',
            'Workflow file (.github/workflows/deploy.yml) is read',
            'Virtual machine (runner) is provisioned',
            'Workflow steps begin execution'
        ],
        result: 'Workflow is now running and ready to process your code'
    },
    3: {
        icon: '🔨',
        title: '3. Build & Test',
        description: 'Your code is validated, tested, and prepared for deployment. This ensures everything works correctly before going live.',
        details: [
            'Code is checked out from repository',
            'Dependencies are installed (if any)',
            'Code is validated and tested',
            'Artifacts are prepared for deployment'
        ],
        result: 'Code is validated and ready to be deployed to GitHub Pages'
    },
    4: {
        icon: '🚀',
        title: '4. Deploy',
        description: 'The final step! Your website is deployed to GitHub Pages and becomes live on the internet for everyone to see.',
        details: [
            'Prepared artifacts are uploaded',
            'GitHub Pages is configured',
            'Website files are deployed to CDN',
            'DNS and routing are updated'
        ],
        result: 'Your website is now live and accessible to the world!'
    }
};

// Modal functionality
const modal = document.getElementById('step-modal');
const modalTitle = document.getElementById('modal-title');
const modalIcon = document.getElementById('modal-icon');
const modalDescription = document.getElementById('modal-description');
const modalDetailsList = document.getElementById('modal-details-list');
const modalResult = document.getElementById('modal-result');
const modalClose = document.querySelector('.modal-close');

function showModal(stepNumber) {
    const info = stepInfo[stepNumber];
    if (!info) return;
    
    modalIcon.textContent = info.icon;
    modalTitle.textContent = info.title;
    modalDescription.textContent = info.description;
    modalResult.textContent = info.result;
    
    // Clear and populate details list
    modalDetailsList.innerHTML = '';
    info.details.forEach(detail => {
        const li = document.createElement('li');
        li.textContent = detail;
        modalDetailsList.appendChild(li);
    });
    
    // Show modal with animation
    modal.classList.add('show');
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
}

function hideModal() {
    modal.classList.remove('show');
    document.body.style.overflow = ''; // Restore scrolling
}

// Close modal when clicking X
if (modalClose) {
    modalClose.addEventListener('click', hideModal);
}

// Close modal when clicking outside
modal.addEventListener('click', (e) => {
    if (e.target === modal) {
        hideModal();
    }
});

// Close modal with Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('show')) {
        hideModal();
    }
});

// Add click interaction to pipeline steps
document.querySelectorAll('.pipeline-step').forEach((step) => {
    const stepNumber = parseInt(step.getAttribute('data-step'));
    
    step.addEventListener('click', () => {
        showModal(stepNumber);
    });
    
    step.style.cursor = 'pointer';
    
    // Add hover effect
    step.addEventListener('mouseenter', () => {
        step.style.transform = 'translateY(-8px) scale(1.02)';
    });
    
    step.addEventListener('mouseleave', () => {
        step.style.transform = 'translateY(-5px) scale(1)';
    });
});

/** Canonical repo for this demo (matches origin when forked). */
const DEFAULT_REPO = { owner: 'njvanas', name: 'CI-CD' };

function defaultRepoUrl() {
    const { owner, name } = DEFAULT_REPO;
    return `https://github.com/${owner}/${name}`;
}

// Set GitHub and Actions URLs from Pages URL when possible; always point to the repo, not the live site
function detectRepository() {
    const workflowLink = document.getElementById('workflow-link');
    const footerRepoLink = document.getElementById('footer-repo-link');

    let repoUrl = defaultRepoUrl();
    const hostname = window.location.hostname;
    const pathname = window.location.pathname;

    if (hostname.includes('github.io')) {
        const parts = hostname.split('.');
        if (parts.length >= 2) {
            const username = parts[0];
            const pathParts = pathname.split('/').filter(Boolean);
            const repoName = pathParts.length > 0 ? pathParts[0] : DEFAULT_REPO.name;
            repoUrl = `https://github.com/${username}/${repoName}`;
        }
    }

    const actionsUrl = `${repoUrl}/actions`;

    if (workflowLink) {
        workflowLink.href = actionsUrl;
    }
    if (footerRepoLink) {
        footerRepoLink.href = repoUrl;
    }
}

// Run on page load
detectRepository();

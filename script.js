function tryItConfig() {
    return window.__TRY_IT_CONFIG__ || null;
}

function formatDeployStamp(iso) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    const formatted = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'UTC',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    }).format(date);
    return `${formatted} UTC`;
}

function syncHeaderHeight() {
    const header = document.getElementById('site-header');
    if (!header) return;
    document.documentElement.style.setProperty('--header-h', `${header.offsetHeight}px`);
}

async function fetchDeployInfo() {
    const res = await fetch(`pages-deploy.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return res.json();
}

function renderDeployStamp(info) {
    const stamp = document.getElementById('header-deploy-stamp');
    const timeEl = document.getElementById('header-deploy-time');
    if (!stamp || !timeEl || !info?.deployedAt) return false;
    const label = formatDeployStamp(info.deployedAt);
    if (!label) return false;
    timeEl.dateTime = info.deployedAt;
    timeEl.textContent = label;
    stamp.hidden = false;
    syncHeaderHeight();
    return true;
}

async function waitForNewDeploy(previousIso) {
    const deadline = Date.now() + 180000;
    while (Date.now() < deadline) {
        const info = await fetchDeployInfo();
        if (info?.deployedAt && info.deployedAt !== previousIso) {
            renderDeployStamp(info);
            return info;
        }
        await new Promise((r) => setTimeout(r, 4000));
    }
    return null;
}

async function onTryItClick(button) {
    const config = tryItConfig();
    if (!config?.enabled || !config?.proxyUrl) return;

    const previous = await fetchDeployInfo();
    const previousIso = previous?.deployedAt || '';
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');

    try {
        const res = await fetch(`${config.proxyUrl}/api/deploy`, {
            method: 'POST',
            headers: { Accept: 'application/json' }
        });
        if (!res.ok) return;
        await waitForNewDeploy(previousIso);
    } catch {
        /* keep the current stamp */
    } finally {
        button.disabled = false;
        button.setAttribute('aria-busy', 'false');
    }
}

function initTryIt() {
    const button = document.getElementById('try-it-btn');
    if (!button) return;
    button.addEventListener('click', () => {
        if (button.disabled) return;
        onTryItClick(button);
    });
}

async function initDeployStamp() {
    try {
        const info = await fetchDeployInfo();
        renderDeployStamp(info);
    } catch {
        /* local / first build without stamp */
    }
    syncHeaderHeight();
}

(function initHeaderScroll() {
    const header = document.getElementById('site-header');
    if (!header) return;
    const onScroll = () => {
        header.classList.toggle('site-header--scrolled', window.scrollY > 50);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('load', onScroll);
    window.addEventListener('hashchange', onScroll);
})();

document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', function (e) {
        const href = this.getAttribute('href');
        if (href === '#' || href === '#top') return;
        const target = document.querySelector(href);
        if (!target) return;
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth' });
    });
});

const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

document.querySelectorAll('section').forEach((section) => {
    section.style.opacity = '0';
    section.style.transform = 'translateY(20px)';
    section.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    observer.observe(section);
});

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
                if (index === steps.length - 1) {
                    step.style.borderColor = '#22c55e';
                    step.style.boxShadow = '0 0 20px rgba(34, 197, 94, 0.25)';
                }
            }, 100);
        }, delay);
        delay += 800;
    });
}

window.addEventListener('load', () => {
    setTimeout(animatePipeline, 500);
});

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

const modal = document.getElementById('step-modal');
const modalTitle = document.getElementById('modal-title');
const modalIcon = document.getElementById('modal-icon');
const modalDescription = document.getElementById('modal-description');
const modalDetailsList = document.getElementById('modal-details-list');
const modalResult = document.getElementById('modal-result');
const modalClose = document.querySelector('#step-modal .modal-close');

function showModal(stepNumber) {
    const info = stepInfo[stepNumber];
    if (!info || !modal) return;
    modalIcon.textContent = info.icon;
    modalTitle.textContent = info.title;
    modalDescription.textContent = info.description;
    modalResult.textContent = info.result;
    modalDetailsList.innerHTML = '';
    info.details.forEach((detail) => {
        const li = document.createElement('li');
        li.textContent = detail;
        modalDetailsList.appendChild(li);
    });
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
}

function hideModal() {
    if (!modal) return;
    modal.classList.remove('show');
    document.body.style.overflow = '';
}

if (modalClose) modalClose.addEventListener('click', hideModal);
modal?.addEventListener('click', (e) => {
    if (e.target === modal) hideModal();
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal?.classList.contains('show')) hideModal();
});

document.querySelectorAll('.pipeline-step').forEach((step) => {
    const stepNumber = parseInt(step.getAttribute('data-step'), 10);
    step.addEventListener('click', () => showModal(stepNumber));
    step.style.cursor = 'pointer';
    step.addEventListener('mouseenter', () => {
        step.style.transform = 'translateY(-8px) scale(1.02)';
    });
    step.addEventListener('mouseleave', () => {
        step.style.transform = 'translateY(-5px) scale(1)';
    });
});

const DEFAULT_REPO = { owner: 'njvanas', name: 'CI-CD' };

function detectRepository() {
    const workflowLink = document.getElementById('workflow-link');
    const footerRepoLink = document.getElementById('footer-repo-link');
    const navGithubLink = document.getElementById('nav-github-link');
    let repoUrl = `https://github.com/${DEFAULT_REPO.owner}/${DEFAULT_REPO.name}`;
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
    if (workflowLink) workflowLink.href = `${repoUrl}/actions`;
    if (footerRepoLink) footerRepoLink.href = repoUrl;
    if (navGithubLink) navGithubLink.href = repoUrl;
}

detectRepository();
initTryIt();
initDeployStamp();
window.addEventListener('resize', syncHeaderHeight);

(function setFooterYear() {
    const y = document.getElementById('footer-year');
    if (y) y.textContent = String(new Date().getFullYear());
})();

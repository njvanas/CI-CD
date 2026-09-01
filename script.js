const TRY_IT_COOLDOWN_MS = 5 * 60 * 1000;
const TRY_IT_MAX_PER_DAY = 5;
const TRY_IT_LS_KEY = 'try-it-rate';

function tryItConfig() {
    return window.__TRY_IT_CONFIG__ || null;
}

function utcDay(date = new Date()) {
    return date.toISOString().slice(0, 10);
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

function formatDuration(seconds) {
    const total = Math.max(1, Math.ceil(Number(seconds) || 0));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
}

function syncHeaderHeight() {
    const header = document.getElementById('site-header');
    if (!header) return;
    document.documentElement.style.setProperty('--header-h', `${header.offsetHeight}px`);
}

function showSiteMessage(text, variant = '') {
    const messageEl = document.getElementById('message');
    if (!messageEl) return;
    messageEl.textContent = text;
    messageEl.classList.remove('hidden', 'is-pending', 'is-success', 'is-error');
    if (variant) messageEl.classList.add(variant);
    messageEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function hideSiteMessage() {
    const messageEl = document.getElementById('message');
    if (!messageEl) return;
    messageEl.classList.add('hidden');
    messageEl.classList.remove('is-pending', 'is-success', 'is-error');
}

function readLocalRate() {
    try {
        return JSON.parse(localStorage.getItem(TRY_IT_LS_KEY) || 'null') || null;
    } catch {
        return null;
    }
}

function writeLocalRate(data) {
    try {
        localStorage.setItem(TRY_IT_LS_KEY, JSON.stringify(data));
    } catch {
        /* ignore quota / private mode */
    }
}

function localRateDecision(now = new Date()) {
    const stored = readLocalRate();
    if (!stored) return { allowed: true, remainingToday: TRY_IT_MAX_PER_DAY };
    const day = utcDay(now);
    const count = stored.day === day ? Number(stored.count) || 0 : 0;
    if (count >= TRY_IT_MAX_PER_DAY) {
        const tomorrow = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
        return {
            allowed: false,
            reason: 'daily_limit',
            retryAfterSeconds: Math.max(1, Math.ceil((tomorrow - now.getTime()) / 1000)),
            remainingToday: 0
        };
    }
    if (stored.lastAt) {
        const elapsed = now.getTime() - Date.parse(stored.lastAt);
        if (Number.isFinite(elapsed) && elapsed < TRY_IT_COOLDOWN_MS) {
            return {
                allowed: false,
                reason: 'cooldown',
                retryAfterSeconds: Math.max(1, Math.ceil((TRY_IT_COOLDOWN_MS - elapsed) / 1000)),
                remainingToday: TRY_IT_MAX_PER_DAY - count
            };
        }
    }
    return { allowed: true, remainingToday: TRY_IT_MAX_PER_DAY - count };
}

function rememberLocalSuccess(now = new Date()) {
    const day = utcDay(now);
    const stored = readLocalRate();
    const count = stored && stored.day === day ? Number(stored.count) || 0 : 0;
    writeLocalRate({ day, count: count + 1, lastAt: now.toISOString() });
}

function rateLimitMessage(reason, retryAfterSeconds, remainingToday) {
    if (reason === 'cooldown') {
        return `Please wait ${formatDuration(retryAfterSeconds)} before triggering another deploy from this network.`;
    }
    if (reason === 'daily_limit') {
        return `This network has used all 5 Try it deploys for today. Try again in ${formatDuration(retryAfterSeconds)}.`;
    }
    if (reason === 'busy') {
        return `A deploy is already running. Try again in about ${formatDuration(retryAfterSeconds || 30)}.`;
    }
    if (reason === 'global_limit') {
        return `Try it has reached today's safety cap. Please come back in ${formatDuration(retryAfterSeconds)}.`;
    }
    if (reason === 'invalid_key') {
        return 'Could not verify this visitor for rate limiting. Refresh the page and try again.';
    }
    if (remainingToday != null) {
        return `Deploy was not started (${reason}). ${remainingToday} Try it ${remainingToday === 1 ? 'use' : 'uses'} left today.`;
    }
    return 'Deploy was not started. Please try again later.';
}

function parseResultStepName(name) {
    const m = String(name || '').match(/^try-it-result\s+(\w+)(?:\s+(\d+))?(?:\s+(\d+))?$/);
    if (!m) return null;
    return {
        reason: m[1],
        retryAfterSeconds: m[2] ? Number(m[2]) : 0,
        remainingToday: m[3] != null ? Number(m[3]) : undefined
    };
}

async function sha256Hex(text) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function lookupVisitorIp() {
    const controllers = [];
    const fetchText = async (url) => {
        const ctrl = new AbortController();
        controllers.push(ctrl);
        const timer = setTimeout(() => ctrl.abort(), 5000);
        try {
            const res = await fetch(url, { signal: ctrl.signal });
            if (!res.ok) throw new Error(String(res.status));
            return await res.text();
        } finally {
            clearTimeout(timer);
        }
    };

    const readers = [
        async () => JSON.parse(await fetchText('https://api.ipify.org?format=json')).ip,
        async () => JSON.parse(await fetchText('https://api64.ipify.org?format=json')).ip,
        async () => {
            const text = await fetchText('https://cloudflare.com/cdn-cgi/trace');
            const match = text.match(/^ip=(.+)$/m);
            if (!match) throw new Error('no ip');
            return match[1];
        }
    ];

    for (const read of readers) {
        try {
            const ip = String(await read() || '').trim();
            if (ip) return ip;
        } catch {
            /* try next */
        }
    }
    throw new Error('Could not determine your IP address');
}

function githubHeaders(token) {
    return {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28'
    };
}

async function githubFetch(path, token, options = {}) {
    const res = await fetch(`https://api.github.com${path}`, {
        ...options,
        headers: {
            ...githubHeaders(token),
            ...(options.body ? { 'Content-Type': 'application/json' } : {}),
            ...(options.headers || {})
        }
    });
    const text = await res.text();
    let json = null;
    try {
        json = text ? JSON.parse(text) : null;
    } catch {
        json = null;
    }
    return { ok: res.ok, status: res.status, json, text };
}

function newRequestId() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return `tryit-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function dispatchTryIt(config, requestId, visitorKey) {
    const path = `/repos/${config.owner}/${config.repo}/actions/workflows/${config.workflow}/dispatches`;
    const body = JSON.stringify({
        ref: config.ref || 'master',
        inputs: {
            request_id: requestId,
            visitor_key: visitorKey
        }
    });
    const result = await githubFetch(path, config.token, { method: 'POST', body });
    if (result.status === 204 || result.status === 200) {
        return result.json && result.json.workflow_run_id
            ? { runId: result.json.workflow_run_id }
            : { runId: null };
    }
    if (result.status === 401 || result.status === 403) {
        throw new Error('Try it is not authorized to start a deploy. The dispatch token may be missing or expired.');
    }
    if (result.status === 422) {
        throw new Error('GitHub rejected the deploy request. The Try it workflow may not exist on this branch yet.');
    }
    throw new Error(result.json?.message || `GitHub returned ${result.status}`);
}

async function findTryItRun(config, requestId) {
    const path = `/repos/${config.owner}/${config.repo}/actions/workflows/${config.workflow}/runs?event=workflow_dispatch&per_page=20`;
    const needle = `try-it ${requestId}`;
    const deadline = Date.now() + 45000;
    while (Date.now() < deadline) {
        const { ok, json } = await githubFetch(path, config.token);
        if (ok) {
            const match = (json.workflow_runs || []).find((run) => {
                const title = `${run.name || ''} ${run.display_title || ''}`;
                return title.includes(needle) || title.includes(requestId);
            });
            if (match) return match;
        }
        await new Promise((r) => setTimeout(r, 2000));
    }
    throw new Error('Started a deploy request, but could not find the GitHub Actions run.');
}

async function waitForGateResult(config, run) {
    const deadline = Date.now() + 180000;
    let latest = run;
    while (Date.now() < deadline) {
        const runRes = await githubFetch(
            `/repos/${config.owner}/${config.repo}/actions/runs/${latest.id}`,
            config.token
        );
        if (runRes.ok) latest = runRes.json;

        const jobsRes = await githubFetch(
            `/repos/${config.owner}/${config.repo}/actions/runs/${latest.id}/jobs`,
            config.token
        );
        const jobs = jobsRes.json?.jobs || [];
        const gateJob = jobs.find((job) => (job.name || '').toLowerCase().includes('gate'));
        const deployJob = jobs.find((job) => {
            const name = (job.name || '').toLowerCase();
            return name.includes('deploy') && !name.includes('gate');
        });

        if (gateJob) {
            const resultStep = (gateJob.steps || [])
                .map((step) => parseResultStepName(step.name))
                .find(Boolean);
            const gateDone = gateJob.status === 'completed';
            if (gateDone && resultStep) {
                return { run: latest, jobs, resultStep, deployJob, gateJob };
            }
            if (gateDone && gateJob.conclusion === 'failure') {
                throw new Error('The rate-limit check failed. See the Actions tab for details.');
            }
        }

        if (latest.status === 'completed' && !deployJob) {
            return {
                run: latest,
                jobs,
                resultStep: { reason: 'busy', retryAfterSeconds: 30 },
                deployJob,
                gateJob
            };
        }

        await new Promise((r) => setTimeout(r, 3000));
    }
    throw new Error('Timed out waiting for the Try it workflow to start.');
}

async function fetchDeployInfo() {
    const res = await fetch(`deploy-info.json?t=${Date.now()}`, { cache: 'no-store' });
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
    stamp.title = info.runUrl ? `Workflow run ${info.runId || ''}`.trim() : 'Last GitHub Pages deploy';
    syncHeaderHeight();
    return true;
}

async function waitForDeployJob(config, runId) {
    const deadline = Date.now() + 180000;
    while (Date.now() < deadline) {
        const jobsRes = await githubFetch(
            `/repos/${config.owner}/${config.repo}/actions/runs/${runId}/jobs`,
            config.token
        );
        const jobs = jobsRes.json?.jobs || [];
        const deployJobs = jobs.filter((job) => {
            const name = (job.name || '').toLowerCase();
            return name.includes('deploy') && !name.includes('gate');
        });
        if (deployJobs.length) {
            const unfinished = deployJobs.some((job) => job.status !== 'completed');
            if (!unfinished) {
                const failed = deployJobs.find((job) => job.conclusion !== 'success');
                if (failed) {
                    throw new Error('The GitHub Pages deploy job did not succeed. Check the Actions tab.');
                }
                return;
            }
        }
        await new Promise((r) => setTimeout(r, 4000));
    }
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

function setTryItBusy(button, busy, label) {
    if (!button) return;
    button.disabled = busy;
    button.setAttribute('aria-busy', busy ? 'true' : 'false');
    button.textContent = label;
}

async function onTryItClick(button) {
    const config = tryItConfig();
    if (!config?.enabled || !config.token) {
        showSiteMessage(
            'Try it is not armed yet. Add a TRY_IT_DISPATCH_TOKEN Actions secret (see README) and redeploy.',
            'is-error'
        );
        return;
    }

    const local = localRateDecision();
    if (!local.allowed) {
        showSiteMessage(
            rateLimitMessage(local.reason, local.retryAfterSeconds, local.remainingToday),
            'is-error'
        );
        return;
    }

    const previous = await fetchDeployInfo();
    const previousIso = previous?.deployedAt || '';
    setTryItBusy(button, true, 'Starting…');
    showSiteMessage('Checking rate limits and starting a GitHub Pages deploy…', 'is-pending');

    try {
        const ip = await lookupVisitorIp();
        const visitorKey = await sha256Hex(`${ip}|${config.owner}/${config.repo}`);
        const requestId = newRequestId();
        await dispatchTryIt(config, requestId, visitorKey);
        showSiteMessage('Request accepted. Waiting for the Actions gate…', 'is-pending');

        const run = await findTryItRun(config, requestId);
        setTryItBusy(button, true, 'Deploying…');
        const gate = await waitForGateResult(config, run);
        const reason = gate.resultStep?.reason || 'unknown';

        if (reason !== 'accepted') {
            showSiteMessage(
                rateLimitMessage(
                    reason,
                    gate.resultStep.retryAfterSeconds,
                    gate.resultStep.remainingToday
                ),
                'is-error'
            );
            setTryItBusy(button, false, 'Try it');
            return;
        }

        rememberLocalSuccess();
        showSiteMessage(
            'Deploy started. GitHub Pages usually takes 1–2 minutes. The header timestamp will update when it is live.',
            'is-pending'
        );

        if (gate.deployJob || gate.run) {
            await waitForDeployJob(config, gate.run.id);
        }

        const updated = await waitForNewDeploy(previousIso);
        if (updated) {
            showSiteMessage(
                `Live on GitHub Pages. Header now shows ${formatDeployStamp(updated.deployedAt)}.`,
                'is-success'
            );
        } else {
            showSiteMessage(
                'Deploy was triggered. If the header stamp has not changed yet, wait a moment and refresh.',
                'is-pending'
            );
        }
    } catch (err) {
        showSiteMessage(err.message || 'Could not start a deploy.', 'is-error');
    } finally {
        applyTryItAvailability(button);
    }
}

function initTryIt() {
    const button = document.getElementById('try-it-btn');
    if (!button) return;
    applyTryItAvailability(button, { announce: true });
    button.addEventListener('click', () => {
        if (button.disabled) return;
        onTryItClick(button);
    });
}

function applyTryItAvailability(button, { announce = false } = {}) {
    if (!button) return localRateDecision();
    const blocked = localRateDecision();
    if (!blocked.allowed) {
        setTryItBusy(button, true, 'Try it');
        button.title = rateLimitMessage(blocked.reason, blocked.retryAfterSeconds, blocked.remainingToday);
        if (announce) {
            showSiteMessage(
                rateLimitMessage(blocked.reason, blocked.retryAfterSeconds, blocked.remainingToday),
                'is-error'
            );
        }
        if (blocked.reason === 'cooldown') {
            const waitMs = Math.min(TRY_IT_COOLDOWN_MS + 1000, blocked.retryAfterSeconds * 1000);
            window.setTimeout(() => applyTryItAvailability(button), waitMs);
        }
        return blocked;
    }
    button.removeAttribute('title');
    setTryItBusy(button, false, 'Try it');
    return blocked;
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

initTryIt();
initDeployStamp();
window.addEventListener('resize', syncHeaderHeight);

// Fixed header: match portfolio (opaque bar + shadow after scroll)
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

// Smooth scrolling for in-page navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        const href = this.getAttribute('href');
        if (href === '#' || href === '#top') return;
        const target = document.querySelector(href);
        if (!target) return;
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth' });
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
    const navGithubLink = document.getElementById('nav-github-link');

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
    if (navGithubLink) {
        navGithubLink.href = repoUrl;
    }
}

// Run on page load
detectRepository();

(function setFooterYear() {
    const y = document.getElementById('footer-year');
    if (y) y.textContent = String(new Date().getFullYear());
})();

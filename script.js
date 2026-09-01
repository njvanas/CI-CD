const SESSION_KEY = 'try-it-session';

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
    if (remainingToday != null) {
        return `Deploy was not started (${reason}). ${remainingToday} Try it ${remainingToday === 1 ? 'use' : 'uses'} left today.`;
    }
    return 'Deploy was not started. Please try again later.';
}

function readSession() {
    try {
        const raw = sessionStorage.getItem(SESSION_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed?.token || !parsed?.exp) return null;
        if (parsed.exp <= Math.floor(Date.now() / 1000)) {
            sessionStorage.removeItem(SESSION_KEY);
            return null;
        }
        return parsed;
    } catch {
        return null;
    }
}

function writeSession(token, expiresIn) {
    const exp = Math.floor(Date.now() / 1000) + Number(expiresIn || 1800);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ token, exp }));
}

function clearSession() {
    sessionStorage.removeItem(SESSION_KEY);
}

async function proxyFetch(path, { method = 'GET', token, body } = {}) {
    const config = tryItConfig();
    if (!config?.proxyUrl) throw new Error('Try it proxy is not configured.');
    const headers = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;

    let res;
    try {
        res = await fetch(`${config.proxyUrl}${path}`, {
            method,
            headers,
            body: body !== undefined ? JSON.stringify(body) : undefined
        });
    } catch {
        throw new Error('Could not reach the Try it proxy. Check your connection or proxy URL.');
    }

    const text = await res.text();
    let data = null;
    try {
        data = text ? JSON.parse(text) : null;
    } catch {
        data = null;
    }
    return { ok: res.ok, status: res.status, data, text };
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
    stamp.title = info.runUrl ? `Workflow run ${info.runId || ''}`.trim() : 'Last GitHub Pages deploy';
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

function setTryItBusy(button, busy, label) {
    if (!button) return;
    button.disabled = busy;
    button.setAttribute('aria-busy', busy ? 'true' : 'false');
    button.textContent = label;
}

const authModal = document.getElementById('try-it-auth-modal');
const authForm = document.getElementById('try-it-auth-form');
const authPassword = document.getElementById('try-it-password');
const authError = document.getElementById('try-it-auth-error');
const authClose = document.getElementById('try-it-auth-close');
const authCancel = document.getElementById('try-it-auth-cancel');

function showAuthError(message) {
    if (!authError) return;
    authError.textContent = message;
    authError.classList.remove('hidden');
}

function hideAuthError() {
    if (!authError) return;
    authError.textContent = '';
    authError.classList.add('hidden');
}

function showAuthModal() {
    if (!authModal) return Promise.reject(new Error('Auth modal missing'));
    hideAuthError();
    if (authPassword) authPassword.value = '';
    authModal.classList.add('show');
    authModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    window.setTimeout(() => authPassword?.focus(), 50);
    return new Promise((resolve, reject) => {
        authModal.__resolve = resolve;
        authModal.__reject = reject;
    });
}

function hideAuthModal() {
    if (!authModal) return;
    authModal.classList.remove('show');
    authModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
}

function finishAuthModal(result) {
    if (!authModal) return;
    const resolve = authModal.__resolve;
    const reject = authModal.__reject;
    authModal.__resolve = null;
    authModal.__reject = null;
    hideAuthModal();
    if (result instanceof Error) reject?.(result);
    else resolve?.(result);
}

async function authenticateWithPassword(password) {
    const result = await proxyFetch('/api/auth', {
        method: 'POST',
        body: { password }
    });
    if (result.status === 429) {
        throw new Error(result.data?.message || 'Too many login attempts. Try again later.');
    }
    if (result.status === 401) {
        throw new Error('Invalid password.');
    }
    if (!result.ok || !result.data?.token) {
        throw new Error(result.data?.message || 'Could not sign in.');
    }
    writeSession(result.data.token, result.data.expiresIn);
    return result.data.token;
}

async function ensureSessionToken() {
    const existing = readSession();
    if (existing?.token) return existing.token;
    await showAuthModal();
    return readSession()?.token || null;
}

if (authForm) {
    authForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        hideAuthError();
        const submitBtn = authForm.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.disabled = true;
        try {
            const token = await authenticateWithPassword(authPassword?.value || '');
            finishAuthModal(token);
        } catch (err) {
            showAuthError(err.message || 'Sign-in failed.');
        } finally {
            if (submitBtn) submitBtn.disabled = false;
        }
    });
}

authClose?.addEventListener('click', () => finishAuthModal(new Error('cancelled')));
authCancel?.addEventListener('click', () => finishAuthModal(new Error('cancelled')));
authModal?.addEventListener('click', (event) => {
    if (event.target === authModal) finishAuthModal(new Error('cancelled'));
});
document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && authModal?.classList.contains('show')) {
        finishAuthModal(new Error('cancelled'));
    }
});

async function pollDeployStatus(token, requestId) {
    const deadline = Date.now() + 180000;
    while (Date.now() < deadline) {
        const result = await proxyFetch(`/api/deploy/${encodeURIComponent(requestId)}/status`, { token });
        if (result.status === 401) {
            clearSession();
            throw new Error('Session expired. Click Try it again and re-enter the password.');
        }
        if (!result.ok || !result.data) {
            await new Promise((r) => setTimeout(r, 3000));
            continue;
        }
        const data = result.data;
        if (data.phase === 'rejected') {
            return data;
        }
        if (data.phase === 'deploying' || data.reason === 'accepted') {
            return data;
        }
        if (data.runStatus === 'completed' && data.runConclusion === 'failure') {
            throw new Error('The deploy workflow did not succeed. Check GitHub Actions.');
        }
        await new Promise((r) => setTimeout(r, 3000));
    }
    throw new Error('Timed out waiting for the deploy workflow.');
}

async function onTryItClick(button) {
    const config = tryItConfig();
    if (!config?.enabled || !config?.proxyUrl) {
        showSiteMessage(
            'Try it is not configured yet. Deploy the password-protected proxy and set the TRY_IT_PROXY_URL repository variable (see WORKER.md).',
            'is-error'
        );
        return;
    }

    const previous = await fetchDeployInfo();
    const previousIso = previous?.deployedAt || '';

    try {
        setTryItBusy(button, true, 'Unlocking…');
        const token = await ensureSessionToken();
        if (!token) return;

        setTryItBusy(button, true, 'Starting…');
        showSiteMessage('Checking rate limits and starting a GitHub Pages deploy…', 'is-pending');

        const deployRes = await proxyFetch('/api/deploy', { method: 'POST', token });
        if (deployRes.status === 401) {
            clearSession();
            throw new Error('Session expired. Click Try it again and re-enter the password.');
        }
        if (deployRes.status === 429 && deployRes.data?.allowed === false) {
            showSiteMessage(
                rateLimitMessage(
                    deployRes.data.reason,
                    deployRes.data.retryAfterSeconds,
                    deployRes.data.remainingToday
                ),
                'is-error'
            );
            return;
        }
        if (!deployRes.ok || !deployRes.data?.allowed) {
            throw new Error(deployRes.data?.message || deployRes.data?.detail || 'Could not start a deploy.');
        }

        setTryItBusy(button, true, 'Deploying…');
        showSiteMessage('Request accepted. Waiting for GitHub Actions…', 'is-pending');

        const status = await pollDeployStatus(token, deployRes.data.requestId);
        if (status.phase === 'rejected' && status.reason !== 'accepted') {
            showSiteMessage(
                rateLimitMessage(status.reason, status.retryAfterSeconds, status.remainingToday),
                'is-error'
            );
            return;
        }

        showSiteMessage(
            'Deploy started. GitHub Pages usually takes 1–2 minutes. The header timestamp will update when it is live.',
            'is-pending'
        );

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
        if (err.message !== 'cancelled') {
            showSiteMessage(err.message || 'Could not start a deploy.', 'is-error');
        }
    } finally {
        setTryItBusy(button, false, 'Try it');
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

initTryIt();
initDeployStamp();
window.addEventListener('resize', syncHeaderHeight);

// Fixed header: match portfolio (opaque bar + shadow after scroll)
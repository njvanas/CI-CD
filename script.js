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

async function proxyFetch(path, { method = 'GET', body } = {}) {
    const config = tryItConfig();
    if (!config?.proxyUrl) throw new Error('Try it proxy is not configured.');
    const headers = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';

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

async function pollDeployStatus(requestId) {
    const deadline = Date.now() + 180000;
    while (Date.now() < deadline) {
        const result = await proxyFetch(`/api/deploy/${encodeURIComponent(requestId)}/status`);
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
            'Try it is not configured yet. Deploy the proxy and set the TRY_IT_PROXY_URL repository variable (see WORKER.md).',
            'is-error'
        );
        return;
    }

    const previous = await fetchDeployInfo();
    const previousIso = previous?.deployedAt || '';

    try {
        setTryItBusy(button, true, 'Starting…');
        showSiteMessage('Checking rate limits and starting a GitHub Pages deploy…', 'is-pending');

        const deployRes = await proxyFetch('/api/deploy', { method: 'POST' });
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

        const status = await pollDeployStatus(deployRes.data.requestId);
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
        showSiteMessage(err.message || 'Could not start a deploy.', 'is-error');
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

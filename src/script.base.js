// Live deployment status (replaces decorative-only pipeline animation on the public site)

const PIPELINE_STEPS = [
  { id: 1, keys: ["commit", "push", "checkout"] },
  { id: 2, keys: ["workflow", "actions", "github actions"] },
  { id: 3, keys: ["build", "npm"] },
  { id: 4, keys: ["deploy", "pi", "rsync", "sync"] }
];

function setStepStatus(stepId, state, label) {
  const el = document.getElementById(`step-status-${stepId}`);
  if (!el) return;
  el.className = `step-status ${state}`;
  el.innerHTML = `<span class="status-dot"></span><span>${label}</span>`;
}

function resetPipeline() {
  for (let i = 1; i <= 4; i += 1) {
    setStepStatus(i, "pending", "Waiting");
  }
}

function mapJobToStep(jobName) {
  const name = (jobName || "").toLowerCase();
  for (const step of PIPELINE_STEPS) {
    if (step.keys.some((k) => name.includes(k))) {
      return step.id;
    }
  }
  return null;
}

function applyDeploySnapshot(snapshot) {
  const statusEl = document.getElementById("deploy-status");
  const timeEl = document.getElementById("deploy-time");
  const logWrap = document.getElementById("deploy-log");
  const logBody = document.getElementById("deploy-log-body");
  const logMeta = document.getElementById("deploy-log-meta");

  if (!snapshot) {
    resetPipeline();
    if (statusEl) statusEl.textContent = "Idle";
    if (timeEl) timeEl.textContent = "—";
    return;
  }

  if (timeEl) {
    timeEl.textContent = snapshot.updatedAt
      ? new Date(snapshot.updatedAt).toLocaleString()
      : "—";
  }

  if (statusEl) {
    statusEl.textContent = snapshot.conclusion === "success"
      ? "Live"
      : snapshot.status === "in_progress"
        ? "Deploying…"
        : snapshot.conclusion === "failure"
          ? "Failed"
          : snapshot.status || "Idle";
  }

  resetPipeline();
  const jobs = snapshot.jobs || [];
  jobs.forEach((job) => {
    const stepId = mapJobToStep(job.name) || mapJobToStep(job.steps?.[0]?.name);
    if (!stepId) return;
    if (job.status === "completed" && job.conclusion === "success") {
      setStepStatus(stepId, "success", "Done");
    } else if (job.status === "in_progress" || job.status === "queued") {
      setStepStatus(stepId, "active", job.status === "queued" ? "Queued" : "Running");
    } else if (job.conclusion === "failure" || job.conclusion === "cancelled") {
      setStepStatus(stepId, "error", "Failed");
    }
  });

  if (snapshot.phase === "pushing") {
    setStepStatus(1, "active", "Pushing");
  }
  if (snapshot.phase === "done" && snapshot.conclusion === "success") {
    for (let i = 1; i <= 4; i += 1) setStepStatus(i, "success", "Done");
  }

  if (logWrap && logBody) {
    const lines = snapshot.logLines || [];
    if (lines.length) {
      logWrap.classList.remove("hidden");
      logBody.textContent = lines.join("\n");
      if (logMeta) {
        logMeta.textContent = snapshot.runUrl ? "Linked run" : "";
      }
    } else if (snapshot.status === "idle") {
      logWrap.classList.add("hidden");
    }
  }
}

async function fetchDeployStatus() {
  try {
    const res = await fetch("/api/deploy/status");
    if (!res.ok) return;
    const data = await res.json();
    applyDeploySnapshot(data);
  } catch {
    /* API unavailable when viewing static GitHub Pages copy */
  }
}

function connectDeployStream() {
  if (typeof EventSource === "undefined") return;
  const source = new EventSource("/api/deploy/stream");
  source.onmessage = (event) => {
    try {
      applyDeploySnapshot(JSON.parse(event.data));
    } catch {
      /* ignore malformed events */
    }
  };
  source.onerror = () => {
    source.close();
    window.setTimeout(connectDeployStream, 5000);
  };
}

// Modal + scroll behavior from original demo
const stepInfo = {
  1: {
    icon: "📝",
    title: "1. Commit & push",
    description: "The editor writes content/site.json and pushes a commit to GitHub — that push is what triggers CI.",
    details: [
      "You change text or theme in the admin panel",
      "The Pi API commits content/site.json",
      "Git push reaches github.com/njvanas/CI-CD",
      "GitHub fires the deploy workflow"
    ],
    result: "A new workflow run appears in GitHub Actions"
  },
  2: {
    icon: "⚙️",
    title: "2. GitHub Actions",
    description: "GitHub provisions a runner (cloud or your Pi) and executes the workflow YAML.",
    details: [
      "Workflow file: .github/workflows/deploy-pi.yml",
      "Runner checks out the repo at the new commit",
      "Steps run in order with logs you can inspect",
      "Status feeds back to this page in real time"
    ],
    result: "The pipeline job is running"
  },
  3: {
    icon: "🔨",
    title: "3. Build",
    description: "Node runs npm run build — site.json becomes HTML/CSS in dist/.",
    details: [
      "scripts/build.mjs reads content/site.json",
      "Templates render index.html and themed CSS",
      "Static assets copy into dist/",
      "Build must pass before deploy"
    ],
    result: "dist/ is ready to serve"
  },
  4: {
    icon: "🚀",
    title: "4. Deploy to Pi",
    description: "Built files sync to the homelab web root and go live behind Traefik + Cloudflare Tunnel.",
    details: [
      "Self-hosted runner copies dist/ to www/",
      "nginx serves the updated site on the Pi",
      "Traefik routes cicd.dolfieshome.org",
      "Cloudflare Tunnel exposes it securely"
    ],
    result: "Your changes are live on the public URL"
  }
};

const modal = document.getElementById("step-modal");
const modalTitle = document.getElementById("modal-title");
const modalIcon = document.getElementById("modal-icon");
const modalDescription = document.getElementById("modal-description");
const modalDetailsList = document.getElementById("modal-details-list");
const modalResult = document.getElementById("modal-result");
const modalClose = document.querySelector(".modal-close");

function showModal(stepNumber) {
  const info = stepInfo[stepNumber];
  if (!info || !modal) return;
  modalIcon.textContent = info.icon;
  modalTitle.textContent = info.title;
  modalDescription.textContent = info.description;
  modalResult.textContent = info.result;
  modalDetailsList.innerHTML = "";
  info.details.forEach((detail) => {
    const li = document.createElement("li");
    li.textContent = detail;
    modalDetailsList.appendChild(li);
  });
  modal.classList.add("show");
  document.body.style.overflow = "hidden";
}

function hideModal() {
  if (!modal) return;
  modal.classList.remove("show");
  document.body.style.overflow = "";
}

if (modalClose) modalClose.addEventListener("click", hideModal);
if (modal) {
  modal.addEventListener("click", (e) => {
    if (e.target === modal) hideModal();
  });
}
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && modal?.classList.contains("show")) hideModal();
});

document.querySelectorAll(".pipeline-step").forEach((step) => {
  const stepNumber = parseInt(step.getAttribute("data-step"), 10);
  step.addEventListener("click", () => showModal(stepNumber));
  step.style.cursor = "pointer";
});

(function initHeaderScroll() {
  const header = document.getElementById("site-header");
  if (!header) return;
  const onScroll = () => {
    header.classList.toggle("site-header--scrolled", window.scrollY > 50);
  };
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
})();

document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener("click", (e) => {
    const href = anchor.getAttribute("href");
    if (!href || href === "#") return;
    const target = document.querySelector(href);
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: "smooth" });
  });
});

(function setFooterYear() {
  const y = document.getElementById("footer-year");
  if (y) y.textContent = String(new Date().getFullYear());
})();

window.addEventListener("load", () => {
  fetchDeployStatus();
  connectDeployStream();
  window.setInterval(fetchDeployStatus, 15000);
});

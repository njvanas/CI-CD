const form = document.getElementById("editor-form");
const previewFrame = document.getElementById("preview-frame");
const previewStatus = document.getElementById("preview-status");
const deployBtn = document.getElementById("btn-deploy");
const previewBtn = document.getElementById("btn-preview");
const pipelineLog = document.getElementById("pipeline-log");
const actionsLink = document.getElementById("actions-link");
const pipelineSummary = document.getElementById("pipeline-summary");

let siteContent = null;
let previewTimer = null;
let deploySource = null;

function setNested(obj, path, value) {
  const parts = path.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const key = parts[i];
    if (!(key in cur) || typeof cur[key] !== "object") cur[key] = /^\d+$/.test(parts[i + 1]) ? [] : {};
    cur = cur[key];
  }
  cur[parts[parts.length - 1]] = value;
}

function getNested(obj, path) {
  return path.split(".").reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
}

function readFormIntoContent() {
  const next = structuredClone(siteContent);
  for (const el of form.elements) {
    if (!el.name) continue;
    setNested(next, el.name, el.value);
  }
  return next;
}

function fillForm(content) {
  for (const el of form.elements) {
    if (!el.name) continue;
    const value = getNested(content, el.name);
    if (value != null) el.value = value;
  }
}

async function loadContent() {
  const res = await fetch("/api/content");
  if (!res.ok) throw new Error("Failed to load content");
  siteContent = await res.json();
  fillForm(siteContent);
  const repo = siteContent.repo ?? { owner: "njvanas", name: "CI-CD" };
  actionsLink.href = `https://github.com/${repo.owner}/${repo.name}/actions`;
}

async function refreshPreview() {
  const content = readFormIntoContent();
  previewStatus.textContent = "Building preview…";
  try {
    const res = await fetch("/api/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(content)
    });
    if (!res.ok) throw new Error(await res.text());
    previewFrame.src = `/api/preview/?t=${Date.now()}`;
    previewStatus.textContent = "Preview updated";
  } catch (err) {
    previewStatus.textContent = "Preview failed";
    pipelineLog.textContent = String(err.message || err);
  }
}

function schedulePreview() {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(refreshPreview, 450);
}

function setPhase(name, state, text) {
  const item = document.querySelector(`.pipeline-timeline li[data-phase="${name}"]`);
  const label = document.getElementById(`phase-${name}`);
  if (item) {
    item.classList.remove("active", "done", "error");
    if (state) item.classList.add(state);
  }
  if (label) label.textContent = text;
}

function resetPipelineUi() {
  ["push", "workflow", "build", "deploy", "live"].forEach((phase) => {
    setPhase(phase, "", "Waiting");
  });
  pipelineLog.textContent = "";
}

function applyDeploySnapshot(snapshot) {
  if (!snapshot) return;
  if (snapshot.logLines?.length) {
    pipelineLog.textContent = snapshot.logLines.join("\n");
  }
  if (snapshot.runUrl) actionsLink.href = snapshot.runUrl;

  if (snapshot.phase === "pushing") {
    setPhase("push", "active", "Committing and pushing…");
    pipelineSummary.textContent = "Pushing your changes to GitHub…";
  }
  if (snapshot.phase === "watching" || snapshot.status === "in_progress") {
    setPhase("push", "done", "Commit on GitHub");
    setPhase("workflow", "active", snapshot.status === "queued" ? "Queued" : "Running");
    pipelineSummary.textContent = "GitHub Actions is building and deploying…";
  }

  const jobs = snapshot.jobs ?? [];
  for (const job of jobs) {
    const name = job.name.toLowerCase();
    const state = job.status === "completed"
      ? job.conclusion === "success" ? "done" : "error"
      : job.status === "in_progress" ? "active" : "";
    const text = job.status === "completed"
      ? job.conclusion === "success" ? "Completed" : job.conclusion
      : job.status;

    if (name.includes("build")) setPhase("build", state, text);
    if (name.includes("deploy")) setPhase("deploy", state, text);
    if (state === "active" || state === "done") setPhase("workflow", "done", "Workflow running");
  }

  if (snapshot.conclusion === "success") {
    ["push", "workflow", "build", "deploy"].forEach((p) => setPhase(p, "done", "Completed"));
    setPhase("live", "done", "Site updated — open live tab");
    pipelineSummary.textContent = "Deployment finished. Your changes are live.";
    previewFrame.src = `/?t=${Date.now()}`;
    deployBtn.disabled = false;
    if (deploySource) {
      deploySource.close();
      deploySource = null;
    }
  }

  if (snapshot.conclusion === "failure") {
    setPhase("deploy", "error", "Failed — see log");
    pipelineSummary.textContent = "Deployment failed. Check the log and GitHub Actions.";
    deployBtn.disabled = false;
  }
}

function watchDeployStream() {
  if (deploySource) deploySource.close();
  deploySource = new EventSource("/api/deploy/stream");
  deploySource.onmessage = (event) => {
    try {
      applyDeploySnapshot(JSON.parse(event.data));
    } catch {
      /* ignore */
    }
  };
}

async function deployChanges() {
  const content = readFormIntoContent();
  resetPipelineUi();
  deployBtn.disabled = true;
  pipelineSummary.textContent = "Starting deployment…";
  setPhase("push", "active", "Saving and pushing…");

  try {
    const res = await fetch("/api/deploy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Deploy failed");
    watchDeployStream();
    applyDeploySnapshot(data);
  } catch (err) {
    setPhase("push", "error", String(err.message || err));
    pipelineSummary.textContent = "Could not start deployment.";
    deployBtn.disabled = false;
  }
}

form.addEventListener("input", schedulePreview);
deployBtn.addEventListener("click", deployChanges);
previewBtn.addEventListener("click", refreshPreview);

loadContent()
  .then(refreshPreview)
  .catch((err) => {
    pipelineLog.textContent = String(err.message || err);
  });

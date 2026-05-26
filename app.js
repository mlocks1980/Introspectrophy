const state = {
  view: "home",
  authMode: "login",
  clientId: getClientId(),
  account: null,
  profile: null,
  questions: [],
  readings: [],
  journals: [],
  dashboard: null,
  library: [],
  toast: "",
  calibration: {
    step: 0,
    name: "",
    ageRange: "",
    intentions: [],
    answers: {},
    notes: "",
  },
};

const app = document.querySelector("#app");

const intentions = [
  "Understand recurring patterns in my life",
  "Stop seeking external approval",
  "Make decisions without overthinking",
  "Be more honest with myself",
  "Improve close relationships",
  "Find clearer direction",
];

const ageRanges = ["Under 18", "18-24", "25-34", "35-44", "45-54", "55+"];
const navItems = [
  ["home", "Overview"],
  ["calibrate", "Calibrate"],
  ["reading", "Reading"],
  ["protocols", "Protocols"],
  ["journal", "Journal"],
  ["library", "Library"],
  ["dashboard", "Dashboard"],
];

const api = {
  async request(path, options = {}) {
    const response = await fetch(path, {
      credentials: "same-origin",
      ...options,
      headers: {
        "content-type": "application/json",
        "x-client-id": state.clientId,
        ...(options.headers || {}),
      },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Request failed.");
    return data;
  },
  get(path) {
    return this.request(path);
  },
  post(path, body = {}) {
    return this.request(path, { method: "POST", body: JSON.stringify(body) });
  },
  put(path, body = {}) {
    return this.request(path, { method: "PUT", body: JSON.stringify(body) });
  },
  delete(path) {
    return this.request(path, { method: "DELETE" });
  },
};

function getClientId() {
  const existing = localStorage.getItem("introspectrophy.clientId");
  if (existing) return existing;
  const created = crypto.randomUUID().replaceAll("-", "");
  localStorage.setItem("introspectrophy.clientId", created);
  return created;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function pageTitle() {
  return {
    home: "Overview",
    calibrate: "Calibrate",
    reading: "Reading",
    protocols: "Protocols",
    journal: "Journal",
    library: "Library",
    dashboard: "Dashboard",
  }[state.view];
}

async function boot() {
  const [questions, me, dashboard, library] = await Promise.all([
    api.get("/api/questions"),
    api.get("/api/me"),
    api.get("/api/dashboard"),
    api.get("/api/library"),
  ]);
  state.questions = questions.questions;
  state.account = me.account;
  state.profile = me.profile;
  state.readings = me.readings;
  state.journals = me.journals;
  state.dashboard = dashboard;
  state.library = library.items;
  render();
}

async function refresh() {
  const [me, dashboard] = await Promise.all([api.get("/api/me"), api.get("/api/dashboard")]);
  state.account = me.account;
  state.profile = me.profile;
  state.readings = me.readings;
  state.journals = me.journals;
  state.dashboard = dashboard;
}

function render() {
  app.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar">
        <button class="brand-button" data-view="home" aria-label="Open overview">
          <span class="brand-mark">I</span>
          <span><strong>Introspectrophy</strong><small>Fulcrum Guide</small></span>
        </button>
        <nav class="nav">
          ${navItems.map(([view, label]) => `<button class="${state.view === view ? "active" : ""}" data-view="${view}">${label}</button>`).join("")}
        </nav>
        <div class="account-card">
          <span class="status-dot"></span>
          <div>
            <strong>${state.account ? "Account synced" : "Private session"}</strong>
            <small>${state.account ? escapeHtml(state.account.email) : "Create an account to keep data across devices."}</small>
          </div>
        </div>
      </aside>
      <div class="workspace">
        <header class="topbar">
          <div>
            <p class="eyebrow">The Fulcrum</p>
            <h1>${pageTitle()}</h1>
          </div>
          <div class="top-actions">
            ${state.account ? `<button class="ghost compact" data-logout>Log out</button>` : `<button class="ghost compact" data-open-auth>Sign in</button>`}
            <button class="primary compact" data-view="calibrate">New reading</button>
          </div>
        </header>
        ${state.toast ? `<div class="toast">${escapeHtml(state.toast)}</div>` : ""}
        <main>${route()}</main>
      </div>
    </div>
    ${renderAuthDialog()}
  `;
}

function route() {
  if (state.view === "calibrate") return renderCalibration();
  if (state.view === "reading") return renderReading();
  if (state.view === "protocols") return renderProtocols();
  if (state.view === "journal") return renderJournal();
  if (state.view === "library") return renderLibrary();
  if (state.view === "dashboard") return renderDashboard();
  return renderHome();
}

function renderHome() {
  const latest = state.dashboard?.latest;
  const inward = latest?.inwardScore ?? 58;
  const outward = latest?.outwardScore ?? 72;
  const tilt = latest?.tilt ?? outward - inward;

  return `
    <section class="overview-grid">
      <article class="hero-panel">
        <div class="hero-copy">
          <p class="eyebrow">Self-perception instrument</p>
          <h2>Measure the balance between inner signal and outer pull.</h2>
          <p class="lede">A calm calibration flow for spotting behavioral drift, naming distortions, and returning to a steadier center over time.</p>
          <div class="action-row">
            <button class="primary" data-view="calibrate">Begin calibration</button>
            <button class="ghost" data-view="reading">Review latest reading</button>
          </div>
        </div>
        <div class="instrument-card">
          <div class="instrument-top">
            <div><span>Inward</span><strong>${inward}</strong></div>
            <div><span>Outward</span><strong>${outward}</strong></div>
          </div>
          <div class="fulcrum" style="--tilt:${Math.max(-10, Math.min(10, tilt / 2))}deg">
            <span></span><i></i><span></span>
          </div>
          <p>${latest ? `${latest.direction} pull detected in your latest reading.` : "No saved reading yet. The demo beam shows the instrument state."}</p>
        </div>
      </article>
      <article class="panel">
        <div class="section-title"><p class="eyebrow">Today</p><h3>Current state</h3></div>
        <div class="stat-grid">
          ${stat("Readings", state.dashboard?.totalReadings || 0)}
          ${stat("Journals", state.dashboard?.totalJournals || 0)}
          ${stat("Protocols", state.dashboard?.protocolsCompleted || 0)}
          ${stat("Avg tilt", state.dashboard?.averageTilt || 0)}
        </div>
      </article>
      <article class="panel">
        <div class="section-title"><p class="eyebrow">Method</p><h3>What the app measures</h3></div>
        <div class="feature-list">
          ${feature("Identity", "Who you are without the performance.")}
          ${feature("Perception", "How you see versus what is.")}
          ${feature("Behavior", "Why familiar patterns keep repeating.")}
          ${feature("Direction", "Where attention and action are pointed.")}
        </div>
      </article>
    </section>
  `;
}

function stat(label, value) {
  return `<div class="stat"><span>${label}</span><strong>${value}</strong></div>`;
}

function feature(title, body) {
  return `<div class="feature"><strong>${title}</strong><span>${body}</span></div>`;
}

function renderCalibration() {
  const step = state.calibration.step;
  const content =
    step === 0 ? onboardingName() :
    step === 1 ? onboardingIntentions() :
    step >= 2 && step <= 5 ? questionBatch((step - 2) * 5, step * 5 - 5, ["Identity", "Perception", "Behavior", "Direction"][step - 2]) :
    finalNotes();

  return `
    <section class="flow-layout">
      <aside class="flow-aside">
        <p class="eyebrow">Calibration</p>
        <h2>${step < 2 ? "Set the baseline" : step < 6 ? "Answer honestly" : "Generate reading"}</h2>
        <p>Move through the instrument without trying to optimize the result. The reading is most useful when it captures the actual weather.</p>
        <div class="step-list">
          ${["Profile", "Intent", "Identity", "Perception", "Behavior", "Direction", "Context"].map((label, index) => `<span class="${index === step ? "active" : index < step ? "done" : ""}">${label}</span>`).join("")}
        </div>
      </aside>
      <div class="flow-card">
        <div class="progress"><span style="--value:${Math.round((step / 6) * 100)}%"></span></div>
        ${content}
      </div>
    </section>
  `;
}

function onboardingName() {
  return `
    <p class="eyebrow">Step 1 of 7</p>
    <h2>Before we measure, who are we measuring?</h2>
    <p class="subtle">This helps address the reading back to you. Account sync is optional.</p>
    <div class="field">
      <label for="name">First name</label>
      <input id="name" value="${escapeHtml(state.calibration.name || state.profile?.name || "")}" autocomplete="given-name" />
    </div>
    <div class="field">
      <label>Age range</label>
      <div class="choice-grid">
        ${ageRanges.map((age) => `<button class="choice ${isSelected(age, state.calibration.ageRange || state.profile?.ageRange)}" data-age="${age}">${age}</button>`).join("")}
      </div>
    </div>
    ${flowActions(false)}
  `;
}

function onboardingIntentions() {
  return `
    <p class="eyebrow">Step 2 of 7</p>
    <h2>What are you here for?</h2>
    <p class="subtle">Pick anything that resonates. The instrument will keep this with your saved profile.</p>
    <div class="choice-grid large">
      ${intentions.map((item) => `<button class="choice ${state.calibration.intentions.includes(item) ? "selected" : ""}" data-intention="${escapeHtml(item)}">${item}</button>`).join("")}
    </div>
    ${flowActions(true)}
  `;
}

function questionBatch(start, _end, title) {
  const questions = state.questions.slice(start, start + 5);
  return `
    <p class="eyebrow">${title} axis</p>
    <h2>${title}</h2>
    <div class="question-stack">
      ${questions.map((question) => `
        <article class="question-card">
          <h3>${escapeHtml(question.text)}</h3>
          <div class="scale-labels"><span>Disagree</span><span>Neutral</span><span>Agree</span></div>
          <div class="scale">
            ${[1, 2, 3, 4, 5].map((value) => `<button class="${state.calibration.answers[question.id] === value ? "selected" : ""}" data-answer="${question.id}" data-value="${value}">${value}</button>`).join("")}
          </div>
        </article>
      `).join("")}
    </div>
    ${flowActions(true)}
  `;
}

function finalNotes() {
  return `
    <p class="eyebrow">Final step</p>
    <h2>What should this reading remember?</h2>
    <p class="subtle">Optional context helps future you understand what was happening around the measurement.</p>
    <textarea id="notes" placeholder="What is happening in your life right now?">${escapeHtml(state.calibration.notes)}</textarea>
    <div class="flow-actions">
      <button class="ghost" data-back>Back</button>
      <button class="primary" data-submit-reading>Generate reading</button>
    </div>
  `;
}

function flowActions(back) {
  return `<div class="flow-actions">${back ? `<button class="ghost" data-back>Back</button>` : ""}<button class="primary" data-next>Continue</button></div>`;
}

function isSelected(a, b) {
  return a === b ? "selected" : "";
}

function renderReading() {
  const reading = state.dashboard?.latest || state.readings[0];
  if (!reading) return emptyState("No reading yet", "Run a calibration and the full reading will appear here.", "Begin calibration", "calibrate");

  return `
    <section class="content-stack">
      <div class="section-header">
        <div>
          <p class="eyebrow">Latest reading</p>
          <h2>${capitalize(reading.direction)} pull ${Math.abs(reading.tilt)}</h2>
        </div>
        <button class="ghost" data-export>Export data</button>
      </div>
      <article class="reading-hero">
        ${stat("Inward", reading.inwardScore)}
        ${stat("Outward", reading.outwardScore)}
        ${stat("Tilt", reading.tilt)}
        ${stat("Magnitude", reading.magnitude)}
      </article>
      <div class="axis-grid">
        ${Object.entries(reading.axisScores).map(([axis, values]) => `
          <article class="panel">
            <div class="section-title"><p class="eyebrow">${axis}</p><h3>${values.outward - values.inward > 0 ? "Outward leaning" : "Inward leaning"}</h3></div>
            ${bar("Inward", values.inward, "teal")}
            ${bar("Outward", values.outward, "blue")}
          </article>
        `).join("")}
      </div>
      <div class="card-grid">
        ${reading.distortions.map((item) => `<article class="panel"><p class="eyebrow">Observed distortion</p><h3>${item.name}</h3><p>${item.detail}</p></article>`).join("")}
      </div>
    </section>
  `;
}

function bar(label, value, tone = "") {
  return `<div class="bar ${tone}"><div><span>${label}</span><strong>${value}</strong></div><i><span style="--value:${value}%"></span></i></div>`;
}

function renderProtocols() {
  const recommended = state.dashboard?.latest?.protocol;
  const protocols = [recommended, ...fallbackProtocols()].filter(Boolean).filter((item, index, list) => list.findIndex((x) => x.id === item.id) === index);
  return `
    <section class="content-stack">
      <div class="section-header">
        <div><p class="eyebrow">Return protocols</p><h2>Small practices for recalibration</h2></div>
      </div>
      <div class="card-grid">
        ${protocols.map((protocol, index) => `
          <article class="panel protocol ${index === 0 && recommended ? "recommended" : ""}">
            <div class="section-title"><p class="eyebrow">${protocol.duration}</p><h3>${protocol.title}</h3></div>
            <p>${protocol.focus}</p>
            <ol>${protocol.steps.map((step) => `<li>${step}</li>`).join("")}</ol>
            <textarea data-protocol-note="${protocol.id}" placeholder="Capture what shifted."></textarea>
            <button class="primary" data-complete-protocol="${protocol.id}">Mark complete</button>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function fallbackProtocols() {
  return [
    {
      id: "return-to-center",
      title: "Return to Center",
      duration: "7 minutes",
      focus: "Reset after an approval spiral.",
      steps: ["Name the external signal.", "Separate fact from story.", "Choose one honest action."],
    },
    {
      id: "identity-audit",
      title: "Identity Audit",
      duration: "12 minutes",
      focus: "Distinguish self from performance.",
      steps: ["List current roles.", "Circle the expensive one.", "Write what remains without reward."],
    },
    {
      id: "decision-fulcrum",
      title: "Decision Fulcrum",
      duration: "10 minutes",
      focus: "Move without overcorrecting.",
      steps: ["Name the decision.", "Weigh inward and outward evidence.", "Pick a reversible action."],
    },
  ];
}

function renderJournal() {
  return `
    <section class="journal-layout">
      <article class="panel">
        <p class="eyebrow">Reflection</p>
        <h2>Observed without judgment</h2>
        <div class="field"><label for="journalPrompt">Prompt</label><input id="journalPrompt" value="What pulled me away from center today?" /></div>
        <div class="field"><label for="journalBody">Entry</label><textarea id="journalBody" placeholder="Write the pattern as plainly as possible."></textarea></div>
        <button class="primary" data-save-journal>Save entry</button>
      </article>
      <div class="entry-list">
        ${state.journals.length ? state.journals.map((entry) => `
          <article class="panel entry">
            <span>${new Date(entry.createdAt).toLocaleString()}</span>
            <h3>${escapeHtml(entry.prompt)}</h3>
            <p>${escapeHtml(entry.body)}</p>
          </article>
        `).join("") : emptyMini("No journal entries yet.")}
      </div>
    </section>
  `;
}

function renderLibrary() {
  return `
    <section class="content-stack">
      <div class="section-header">
        <div><p class="eyebrow">Library</p><h2>Reference material for the instrument</h2></div>
      </div>
      <div class="card-grid">
        ${state.library.map((item) => `
          <article class="panel library-item">
            <p class="eyebrow">${item.category} - ${item.minutes} min</p>
            <h3>${item.title}</h3>
            <p>${item.summary}</p>
            <button class="ghost" data-save-library="${item.id}">Save to practice</button>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function renderDashboard() {
  const trend = state.dashboard?.trend || [];
  return `
    <section class="content-stack">
      <div class="section-header">
        <div><p class="eyebrow">Dashboard</p><h2>Longitudinal clarity</h2></div>
        <button class="ghost danger" data-delete-account>Delete my data</button>
      </div>
      <div class="dashboard-grid">
        <article class="panel wide">
          <div class="section-title"><p class="eyebrow">Trend</p><h3>Recent calibration tilt</h3></div>
          <div class="trend">
            ${trend.length ? trend.map((point) => `<div style="--height:${Math.max(10, Math.abs(point.tilt) * 5 + 14)}%"><span>${point.tilt}</span></div>`).join("") : `<p class="subtle">Complete a reading to start the trend.</p>`}
          </div>
        </article>
        <article class="panel">
          <div class="section-title"><p class="eyebrow">Account</p><h3>${state.account ? "Synced" : "Local"}</h3></div>
          <p>${state.account ? `Signed in as ${escapeHtml(state.account.email)}.` : "Your work is saved on this server under a private browser key. Sign in to keep it across devices."}</p>
          ${state.account ? `<button class="ghost" data-logout>Log out</button>` : `<button class="primary" data-open-auth>Create account</button>`}
        </article>
      </div>
      <div class="stat-grid">
        ${stat("Readings", state.dashboard?.totalReadings || 0)}
        ${stat("Journal entries", state.dashboard?.totalJournals || 0)}
        ${stat("Protocols complete", state.dashboard?.protocolsCompleted || 0)}
        ${stat("Average tilt", state.dashboard?.averageTilt || 0)}
      </div>
    </section>
  `;
}

function emptyState(title, body, label, view) {
  return `<section class="empty-state"><h2>${title}</h2><p>${body}</p><button class="primary" data-view="${view}">${label}</button></section>`;
}

function emptyMini(body) {
  return `<article class="panel"><p class="subtle">${body}</p></article>`;
}

function renderAuthDialog() {
  return `
    <div class="modal hidden" data-auth-modal>
      <form class="auth-card" data-auth-form>
        <button class="modal-close" type="button" data-close-auth aria-label="Close">x</button>
        <p class="eyebrow">${state.authMode === "login" ? "Welcome back" : "Create account"}</p>
        <h2>${state.authMode === "login" ? "Sign in to sync your readings." : "Keep your calibration history."}</h2>
        <div class="field"><label for="email">Email</label><input id="email" type="email" autocomplete="email" required /></div>
        <div class="field"><label for="password">Password</label><input id="password" type="password" autocomplete="${state.authMode === "login" ? "current-password" : "new-password"}" required /></div>
        <button class="primary" type="submit">${state.authMode === "login" ? "Sign in" : "Create account"}</button>
        <button class="link-button" type="button" data-toggle-auth>${state.authMode === "login" ? "Need an account?" : "Already have an account?"}</button>
      </form>
    </div>
  `;
}

function capitalize(value) {
  return String(value || "").charAt(0).toUpperCase() + String(value || "").slice(1);
}

function flash(message) {
  state.toast = message;
  render();
  setTimeout(() => {
    state.toast = "";
    render();
  }, 2400);
}

app.addEventListener("click", async (event) => {
  const target = event.target.closest("button");
  if (!target) return;

  if (target.dataset.view) {
    state.view = target.dataset.view;
    render();
    return;
  }

  if (target.dataset.openAuth !== undefined) {
    render();
    document.querySelector("[data-auth-modal]")?.classList.remove("hidden");
    return;
  }

  if (target.dataset.closeAuth !== undefined) {
    document.querySelector("[data-auth-modal]")?.classList.add("hidden");
    return;
  }

  if (target.dataset.toggleAuth !== undefined) {
    state.authMode = state.authMode === "login" ? "register" : "login";
    render();
    document.querySelector("[data-auth-modal]")?.classList.remove("hidden");
    return;
  }

  if (target.dataset.logout !== undefined) {
    await api.post("/api/auth/logout");
    await refresh();
    flash("Signed out.");
    return;
  }

  if (target.dataset.age) {
    state.calibration.name = document.querySelector("#name")?.value || state.calibration.name;
    state.calibration.ageRange = target.dataset.age;
    document.querySelectorAll("[data-age]").forEach((button) => button.classList.toggle("selected", button.dataset.age === state.calibration.ageRange));
    return;
  }

  if (target.dataset.intention) {
    const selected = new Set(state.calibration.intentions);
    selected.has(target.dataset.intention) ? selected.delete(target.dataset.intention) : selected.add(target.dataset.intention);
    state.calibration.intentions = [...selected];
    target.classList.toggle("selected");
    return;
  }

  if (target.dataset.answer) {
    state.calibration.answers[target.dataset.answer] = Number(target.dataset.value);
    target.parentElement.querySelectorAll("button").forEach((button) => button.classList.toggle("selected", button === target));
    return;
  }

  if (target.dataset.back !== undefined) {
    state.calibration.step = Math.max(0, state.calibration.step - 1);
    render();
    return;
  }

  if (target.dataset.next !== undefined) {
    await nextCalibrationStep();
    return;
  }

  if (target.dataset.submitReading !== undefined) {
    await submitReading();
    return;
  }

  if (target.dataset.saveJournal !== undefined) {
    await saveJournal();
    return;
  }

  if (target.dataset.completeProtocol) {
    const id = target.dataset.completeProtocol;
    const note = document.querySelector(`[data-protocol-note="${id}"]`)?.value || "";
    await api.post("/api/protocol-completions", { protocolId: id, note });
    await refresh();
    state.view = "dashboard";
    flash("Protocol saved.");
    return;
  }

  if (target.dataset.saveLibrary) {
    await api.post("/api/library-state", { itemId: target.dataset.saveLibrary, status: "saved" });
    flash("Saved to your practice library.");
    return;
  }

  if (target.dataset.export !== undefined) {
    const data = await api.get("/api/export");
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `introspectrophy-export-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
    return;
  }

  if (target.dataset.deleteAccount !== undefined) {
    if (!confirm("Delete all account, reading, journal, and protocol data?")) return;
    await api.delete("/api/me");
    localStorage.removeItem("introspectrophy.clientId");
    location.reload();
  }
});

app.addEventListener("input", (event) => {
  if (event.target?.id === "name") state.calibration.name = event.target.value;
  if (event.target?.id === "notes") state.calibration.notes = event.target.value;
});

app.addEventListener("submit", async (event) => {
  if (!event.target.matches("[data-auth-form]")) return;
  event.preventDefault();
  const email = document.querySelector("#email").value;
  const password = document.querySelector("#password").value;
  await api.post(state.authMode === "login" ? "/api/auth/login" : "/api/auth/register", { email, password });
  await refresh();
  document.querySelector("[data-auth-modal]")?.classList.add("hidden");
  flash(state.authMode === "login" ? "Signed in." : "Account created.");
});

async function nextCalibrationStep() {
  if (state.calibration.step === 0) {
    state.calibration.name = document.querySelector("#name")?.value.trim() || "";
    if (!state.calibration.name || !(state.calibration.ageRange || state.profile?.ageRange)) {
      flash("Add a name and age range to continue.");
      return;
    }
    await api.put("/api/me", {
      name: state.calibration.name,
      ageRange: state.calibration.ageRange || state.profile?.ageRange,
      intentions: state.calibration.intentions,
    });
  }

  if (state.calibration.step === 1) {
    await api.put("/api/me", {
      name: state.calibration.name || state.profile?.name,
      ageRange: state.calibration.ageRange || state.profile?.ageRange,
      intentions: state.calibration.intentions,
    });
  }

  if (state.calibration.step >= 2 && state.calibration.step <= 5) {
    const start = (state.calibration.step - 2) * 5;
    const required = state.questions.slice(start, start + 5);
    if (!required.every((question) => state.calibration.answers[question.id])) {
      flash("Answer each prompt to continue.");
      return;
    }
  }

  state.calibration.step = Math.min(6, state.calibration.step + 1);
  render();
}

async function submitReading() {
  state.calibration.notes = document.querySelector("#notes")?.value || "";
  const { reading } = await api.post("/api/readings", {
    answers: state.calibration.answers,
    notes: state.calibration.notes,
  });
  state.readings.unshift(reading);
  await refresh();
  state.calibration = { step: 0, name: "", ageRange: "", intentions: [], answers: {}, notes: "" };
  state.view = "reading";
  render();
}

async function saveJournal() {
  const prompt = document.querySelector("#journalPrompt")?.value || "";
  const body = document.querySelector("#journalBody")?.value || "";
  if (!body.trim()) {
    flash("Write an entry before saving.");
    return;
  }
  await api.post("/api/journals", { prompt, body });
  await refresh();
  flash("Journal entry saved.");
}

boot().catch((error) => {
  app.innerHTML = `<main class="fatal"><h1>App failed to load</h1><p>${escapeHtml(error.message)}</p></main>`;
});

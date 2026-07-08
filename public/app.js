const startupViews = ["dashboard", "reflection", "selfDiagnosis", "patterns", "laboratory", "returnProtocol", "alerts", "baseline", "analytics"];

const state = {
  view: getStartupPage(),
  authMode: "login",
  clientId: getClientId(),
  account: null,
  profile: null,
  patterns: { active_patterns: [], behavioral_signals: [], assumption_profiles: [] },
  alerts: { future_alerts: [], active_patterns: [] },
  dashboard: null,
  analytics: null,
  assessments: { assessment_results: [], latest_assessment: null },
  returnProtocol: null,
  lastResult: null,
  selectedPatternId: null,
  assessmentStep: Number(localStorage.getItem("introspectropy.assessmentStep") || 0),
  assessmentAnswers: loadAssessmentProgress(),
  assessmentComplete: localStorage.getItem("introspectropy.assessmentComplete") === "true",
  toast: "",
  tourActive: localStorage.getItem("introspectropy.tourComplete") !== "true",
  tourStep: 0,
  companionEnabled: localStorage.getItem("introspectropy.companionDisabled") !== "true",
  companionMinimized: localStorage.getItem("introspectropy.companionMinimized") === "true",
  preferences: loadPreferences(),
};

const app = document.querySelector("#app");

const navItems = [
  ["reflection", "Reflection Input"],
  ["selfDiagnosis", "Self Diagnosis"],
  ["patterns", "Pattern Drawer"],
  ["laboratory", "Fulcrum Laboratory"],
  ["returnProtocol", "Return Protocol"],
  ["alerts", "Future Alerts"],
  ["dashboard", "Dashboard"],
  ["baseline", "Identity Baseline"],
  ["why", "Why Introspectropy"],
  ["pricing", "Pricing"],
  ["enterprise", "Enterprise"],
  ["analytics", "Analytics"],
  ["settings", "Settings"],
];

const pressurePoints = ["competence", "belonging", "autonomy", "recognition", "security", "purpose"];
const assessmentDomains = {
  Identity: ["When pressure rises, which self do you most often present?", "What most shapes your sense of identity in hard moments?", "How do you know you are being yourself?", "What happens when others misunderstand you?", "Which identity signal do you trust first?"],
  Perception: ["When something feels clear, what do you check next?", "How do you respond to feedback that disrupts your story?", "What do you do when your interpretation feels certain?", "Which signal most changes your view of a situation?", "How often do you test what you think you see?"],
  Behavior: ["What happens when a familiar pressure appears?", "How do repeated reactions usually begin?", "What do you do when you notice yourself performing?", "How do you respond to automatic habits?", "What behavior gives you the most useful evidence?"],
  Action: ["What guides your next step under pressure?", "When you hesitate, what usually drives the pause?", "How do you choose a small experiment?", "What makes action feel aligned?", "What do you do after one imperfect attempt?"],
  Direction: ["How do you know you are moving in the right direction?", "What pulls you off course most often?", "What tells you a goal is still yours?", "How do you respond when progress is slow?", "What does return look like after drift?"],
  Society: ["How do group expectations affect your choices?", "What happens when belonging and accuracy conflict?", "How do you handle public perception?", "What kind of feedback do you seek from others?", "How do social roles shape your behavior?"],
  Return: ["What helps you come back to the Fulcrum?", "What do you do when you notice drift?", "Which return action feels most available?", "What makes feedback useful rather than threatening?", "How do you reconnect with honest direction?"],
};

const assessmentChoices = [
  ["outward", "I adjust toward what others expect or reward."],
  ["inward", "I retreat into my own interpretation before testing it."],
  ["distorted", "I become very certain and stop taking in new signal."],
  ["balanced", "I pause, compare signals, and choose a grounded next step."],
];

const assessmentQuestions = Object.entries(assessmentDomains).flatMap(([domain, questions]) =>
  questions.map((question, index) => ({ id: `${domain}-${index}`, domain, question, index })),
);

const tourSteps = [
  {
    key: "dashboard",
    view: "dashboard",
    title: "Dashboard",
    body: "Welcome to Introspectropy. This is your command center for pattern movement, experiments, and Pattern Interception Rate.",
  },
  {
    key: "reflection",
    view: "reflection",
    title: "Reflection Input",
    body: "Write a situation that keeps repeating. One reflection creates a hypothesis; multiple reflections strengthen recurring pattern analysis.",
  },
  {
    key: "patterns",
    view: "patterns",
    title: "Pattern Drawer",
    body: "This separates early pattern hypotheses from active recurring patterns that have appeared enough times to track.",
  },
  {
    key: "laboratory",
    view: "laboratory",
    title: "Fulcrum Laboratory",
    body: "When an active pattern exists, this is where you test the assumption underneath it with a micro experiment.",
  },
  {
    key: "alerts",
    view: "alerts",
    title: "Future Alerts",
    body: "Future alerts are quiet recognition signals. They help you notice a known pattern the next time it appears.",
  },
  {
    key: "baseline",
    view: "baseline",
    title: "Identity Baseline",
    body: "Use this to capture your Performed Self and Identity Drift watchpoints. It gives future classifications more context.",
  },
  {
    key: "analytics",
    view: "analytics",
    title: "Analytics",
    body: "Analytics shows product usage signals like tour completion, reflection completion, and most-used sections.",
  },
];

const glossary = {
  ICE: "Introspectropy Classification Engine. It turns reflection text into a pattern hypothesis, pressure weights, and assumption mapping.",
  "Pattern Signal": "A detected piece of evidence that may point to a recurring pattern. One signal is not enough to prove a pattern.",
  Fulcrum: "The hidden assumption or internal rule that gives a pattern leverage.",
  "Identity Drift": "A gradual gap between authentic identity and expressed identity.",
  "Pattern Interception Rate": "The percentage of known pattern activations you intercepted consciously, excluding not-sure responses.",
  "The Performed Self": "The adaptive identity a person uses when pressure pushes behavior toward protection, approval, or presentation.",
};

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

function getStartupPage() {
  const saved = localStorage.getItem("introspectropy.startupPage") || "dashboard";
  return startupViews.includes(saved) ? saved : "dashboard";
}

function setStartupPage(view) {
  const safeView = startupViews.includes(view) ? view : "dashboard";
  localStorage.setItem("introspectropy.startupPage", safeView);
  return safeView;
}

function loadPreferences() {
  return {
    theme: localStorage.getItem("introspectropy.theme") || "light",
    reducedMotion: localStorage.getItem("introspectropy.reducedMotion") === "true",
    largeText: localStorage.getItem("introspectropy.largeText") === "true",
    readAloud: localStorage.getItem("introspectropy.readAloud") === "true",
    voiceRate: localStorage.getItem("introspectropy.voiceRate") || "0.92",
    localOnly: localStorage.getItem("introspectropy.localOnly") === "true",
    notifications: localStorage.getItem("introspectropy.notifications") === "true",
    intelligenceDetail: localStorage.getItem("introspectropy.intelligenceDetail") || "balanced",
    reflectionExamplesOpen: localStorage.getItem("introspectropy.reflectionExamplesOpen") === "true",
    reflectionAutoFocus: localStorage.getItem("introspectropy.reflectionAutoFocus") === "true",
  };
}

function loadAssessmentProgress() {
  try {
    return JSON.parse(localStorage.getItem("introspectropy.assessmentAnswers") || "{}");
  } catch {
    return {};
  }
}

function saveAssessmentProgress() {
  localStorage.setItem("introspectropy.assessmentAnswers", JSON.stringify(state.assessmentAnswers));
  localStorage.setItem("introspectropy.assessmentStep", String(state.assessmentStep));
  localStorage.setItem("introspectropy.assessmentComplete", String(state.assessmentComplete));
}

function savePreferences(next) {
  state.preferences = { ...state.preferences, ...next };
  for (const [key, value] of Object.entries(state.preferences)) {
    localStorage.setItem(`introspectropy.${key}`, String(value));
  }
  applyPreferences();
}

function applyPreferences() {
  document.documentElement.dataset.theme = state.preferences.theme;
  document.documentElement.dataset.motion = state.preferences.reducedMotion ? "reduced" : "full";
  document.documentElement.dataset.textSize = state.preferences.largeText ? "large" : "normal";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function titleForView() {
  return {
    reflection: "Reflection Input",
    patterns: "Pattern Drawer",
    selfDiagnosis: "Self Diagnosis",
    laboratory: "Fulcrum Laboratory",
    returnProtocol: "Return Protocol",
    alerts: "Future Alerts",
    dashboard: "Dashboard",
    baseline: "Identity Baseline",
    why: "Why Introspectropy",
    pricing: "Pricing",
    enterprise: "Enterprise",
    analytics: "Analytics",
    settings: "Settings",
  }[state.view];
}

async function boot() {
  applyPreferences();
  await refresh();
  const profileStartup = state.profile?.identity_baseline?.default_startup_page;
  if (startupViews.includes(profileStartup) && !localStorage.getItem("introspectropy.startupPage")) {
    state.view = setStartupPage(profileStartup);
  }
  render();
}

async function refresh() {
  const [me, patterns, alerts, dashboard, analytics, assessments, protocol] = await Promise.all([
    api.get("/api/me"),
    api.get("/api/patterns"),
    api.get("/api/alerts"),
    api.get("/api/dashboard"),
    api.get("/api/analytics-dashboard").catch(() => ({ total_events: 0, most_used_features: [], drop_off_locations: [] })),
    api.get("/api/assessments").catch(() => ({ assessment_results: [], latest_assessment: null })),
    api.get("/api/return-protocol").catch(() => ({ return_protocol: null })),
  ]);
  state.account = me.account;
  state.profile = me.profile;
  state.patterns = patterns;
  state.alerts = alerts;
  state.dashboard = dashboard;
  state.analytics = analytics;
  state.assessments = assessments;
  state.returnProtocol = protocol.return_protocol;
}

function trackEvent(event_name, metadata = {}) {
  if (state.preferences.localOnly) return;
  api.post("/api/analytics", { event_name, metadata }).catch(() => {});
}

function render() {
  const activeTour = currentTourStep();
  app.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar">
        <button class="brand-button" data-view="dashboard" aria-label="Open Dashboard">
          <span class="brand-mark">I</span>
          <span><strong>Introspectropy</strong><small>SR-OS</small></span>
        </button>
        <nav class="nav">
          ${navItems.map(([view, label]) => `<button class="${state.view === view ? "active" : ""} ${tourClass(view)}" data-tour-key="${view}" data-view="${view}">${label}</button>`).join("")}
        </nav>
        <div class="account-card">
          <span class="status-dot"></span>
          <div>
            <strong>${state.account ? "Account synced" : "Private session"}</strong>
            <small>${state.account ? escapeHtml(state.account.email) : "Local reflection profile"}</small>
          </div>
        </div>
      </aside>
      <div class="workspace">
        <header class="topbar">
          <div>
            <p class="eyebrow">Introspectropy Classification Engine</p>
            <h1>${titleForView()}</h1>
          </div>
          <div class="top-actions">
            ${state.account ? `<button class="ghost compact" data-logout>Log out</button>` : `<button class="ghost compact" data-open-auth>Sign in</button>`}
            <button class="ghost compact" data-start-tour>Take Tour</button>
            <button class="primary compact" data-view="reflection">New reflection</button>
          </div>
        </header>
        ${state.toast ? `<div class="toast">${escapeHtml(state.toast)}</div>` : ""}
        <main>${route()}</main>
      </div>
    </div>
    ${(state.companionEnabled || state.tourActive) ? ReflectionCompanion() : ""}
    ${state.tourActive ? GuidedTour(activeTour) : ""}
    ${renderAuthDialog()}
  `;
  applyPreferences();
  if (state.view === "reflection" && state.preferences.reflectionAutoFocus) {
    setTimeout(() => document.querySelector("#reflectionText")?.focus(), 0);
  }
}

function route() {
  if (state.view === "patterns") return PatternDrawer();
  if (state.view === "selfDiagnosis") return SelfDiagnosisPage();
  if (state.view === "laboratory") return FulcrumLaboratory();
  if (state.view === "returnProtocol") return ReturnProtocolPage();
  if (state.view === "alerts") return FuturePatternAlert();
  if (state.view === "dashboard") return Dashboard();
  if (state.view === "baseline") return IdentityBaselineProtocol();
  if (state.view === "why") return WhyIntrospectropy();
  if (state.view === "pricing") return PricingPage();
  if (state.view === "enterprise") return EnterprisePage();
  if (state.view === "analytics") return AnalyticsDashboard();
  if (state.view === "settings") return SettingsPage();
  return ReflectionInput();
}

function ReflectionInput() {
  return `
    <section class="overview-grid">
      <article class="hero-panel">
        <div class="hero-copy">
          <p class="eyebrow">Pattern First workflow</p>
          <h2>Capture one friction event. ${term("ICE")} forms a pattern hypothesis.</h2>
          <p class="lede">ICE helps identify hidden assumptions, recurring pressures, and behavioral patterns that may be influencing outcomes. A single reflection creates a hypothesis; multiple reflections support recurring pattern analysis and drift measurement.</p>
        </div>
        <div class="instrument-card">
          <div class="instrument-top">
            <div><span>Rolling PIR</span><strong>${formatPir(state.dashboard?.rolling_30_day_pir)}</strong></div>
            <div><span>Signals</span><strong>${state.dashboard?.total_signals || 0}</strong></div>
          </div>
          <p>The user remains the scientist. The platform is laboratory equipment.</p>
        </div>
      </article>
      <article class="panel ${tourClass("reflection")}" data-tour-key="reflection">
        <div class="panel-heading">
          <div><p class="eyebrow">Reflection Input</p><h2>Enter reflection</h2></div>
          ${readButton("reflection", "Read Reflection")}
        </div>
        <div class="helper-card guidance-card">
          <h3>What should I write?</h3>
          <p>Write about something that keeps showing up, even if you do not understand it yet.</p>
          <ul class="prompt-list">
            <li>What situation keeps frustrating me?</li>
            <li>What goal do I repeatedly avoid?</li>
            <li>What conversation keeps replaying in my head?</li>
            <li>What problem appears again and again?</li>
            <li>Where do I feel stuck?</li>
          </ul>
          <details ${state.preferences.reflectionExamplesOpen ? "open" : ""}>
            <summary>Show examples</summary>
            <div class="example-grid">
              <p>"I keep delaying a hard conversation, then I feel resentful when nothing changes."</p>
              <p>"Whenever my work is questioned, I over-explain instead of staying grounded."</p>
              <p>"I keep taking on urgent tasks even when they pull me away from what matters."</p>
            </div>
          </details>
        </div>
        <textarea id="reflectionText" placeholder="Describe a situation, behavior, thought pattern, or challenge that keeps showing up in your life."></textarea>
        <div class="flow-actions">
          <button class="primary" data-submit-reflection>Run ICE classification</button>
        </div>
      </article>
      <article class="panel">
        <p class="eyebrow">Reflection starters</p>
        <div class="feature-list">
          ${starter("What situation keeps repeating in your life?")}
          ${starter("What interaction consistently drains your energy?")}
          ${starter("What criticism do you hear repeatedly?")}
          ${starter("What goal do you struggle to make progress toward?")}
          ${starter("When do you feel most like you are performing rather than being yourself?")}
        </div>
      </article>
      ${RelatedBookConcepts([
        { title: "The Performed Self", body: "Notice where pressure changes the version of yourself you present." },
        { title: "The Fulcrum", body: "Look for the assumption that gives a repeated behavior its leverage." },
        { title: "Identity Drift", body: "Use repeated reflections to see whether expression is moving away from alignment." },
      ])}
      ${state.lastResult ? ClassificationResult(state.lastResult) : ""}
    </section>
  `;
}

function ClassificationResult(result) {
  const signal = result.behavioral_signal;
  const classification = result.classification;
  return `
    <article class="panel">
      <div class="panel-heading">
        <div><p class="eyebrow">ICE output</p><h2>${escapeHtml(classification.child_pattern_class)}</h2></div>
        ${readButton("classification", "Read Classification")}
      </div>
      <p class="subtle">This is a pattern hypothesis. Recurring pattern analysis requires multiple related reflections over time.</p>
      <div class="stat-grid">
        ${stat("Parent", classification.parent_pattern_class)}
        ${stat("Assumption", classification.assumption_code)}
        ${stat("Confidence", classification.confidence_score)}
        ${stat("Pressure", classification.activation_profile.primary_pressure_point)}
      </div>
      <p><strong>Highlighted text:</strong> ${escapeHtml(classification.highlighted_text)}</p>
      <p><strong>Micro experiment:</strong> ${escapeHtml(classification.micro_experiment_prompt)}</p>
      ${signal ? `<button class="primary" data-view="patterns">Open Pattern Drawer</button>` : `<p class="subtle">Confidence below signal threshold. Reflection was stored without creating a behavioral signal.</p>`}
    </article>
  `;
}

function RelatedBookConcepts(items = []) {
  if (!items.length) return "";
  return `
    <article class="book-card related-book">
      <p class="eyebrow">Related Book Concepts</p>
      <div class="related-book-grid">
        ${items.map((item) => `
          <div>
            <h3>${escapeHtml(item.title)}</h3>
            <p>${escapeHtml(item.body)}</p>
          </div>
        `).join("")}
      </div>
    </article>
  `;
}

function PatternDrawer() {
  const active = state.patterns.active_patterns;
  const signals = state.patterns.behavioral_signals;
  return `
    <section class="content-stack">
      <div class="section-header">
        <div><p class="eyebrow">Reflection Memory</p><h2>Active patterns and recent signals</h2></div>
        ${readButton("patterns", "Read Pattern Analysis")}
      </div>
      <div class="card-grid">
        ${active.length ? active.map((pattern) => PatternCard(pattern)).join("") : emptyMini("No active pattern yet. A pattern becomes active after 3 related signals in 90 days. Until then, outputs are hypotheses.")}
      </div>
      <article class="panel">
        <p class="eyebrow">Recent behavioral signals ${term("Pattern Signal")}</p>
        <div class="entry-list">
          ${signals.length ? signals.map((signal) => SignalRow(signal)).join("") : emptyMini("No behavioral signals yet.")}
        </div>
      </article>
      ${RelatedBookConcepts([
        { title: "Behavioral Drift", body: "Repeated signals show how automatic responses become easier to repeat over time." },
        { title: "Assumption Architecture", body: "Pattern evidence is organized around the internal rule that may be powering it." },
      ])}
    </section>
  `;
}

function SelfDiagnosisPage() {
  const latest = state.assessments.latest_assessment;
  const total = assessmentQuestions.length;
  const step = Math.max(0, Math.min(state.assessmentStep, total - 1));
  const item = assessmentQuestions[step];
  const answeredCount = Object.values(state.assessmentAnswers).filter((answer) => answer && !answer.skipped).length;
  const skippedCount = Object.values(state.assessmentAnswers).filter((answer) => answer?.skipped).length;
  const progress = Math.round(((state.assessmentComplete ? total : step) / total) * 100);
  return `
    <section class="content-stack">
      <div class="section-header">
        <div><p class="eyebrow">Guided assessment</p><h2>Self Diagnosis</h2></div>
        ${readButton("assessment", "Read Assessment Result")}
      </div>
      <article class="helper-card guidance-card">
        <h3>Why take this assessment?</h3>
        <p>Self Diagnosis gives you a structured way to observe identity adaptation, perception habits, behavior under pressure, action patterns, direction, society signals, and return capacity without starting from a blank page.</p>
        <div class="explain-grid mini">
          ${valueCard("What the results mean", "The result is a reflection profile, not a label. It shows which drift pattern appears strongest in your current answers and what to examine next.")}
          ${valueCard("How scoring works", "Each answer adds weight toward Over Outward, Over Inward, Distorted Clarity, or Near Fulcrum. The strongest weighted pattern becomes the primary drift hypothesis.")}
        </div>
      </article>
      ${state.assessmentComplete ? AssessmentCompletion(answeredCount, skippedCount) : AssessmentQuestionCard(item, step, total, progress, answeredCount, skippedCount)}
      ${latest ? AssessmentResult(latest) : ""}
      ${RelatedBookConcepts([
        { title: "Signs of Introspectrophy", body: "Use the assessment to notice where repeated pressure alters perception and action." },
        { title: "The Performed Self", body: "Over Outward results point toward behavior shaped by approval, image, or external expectation." },
        { title: "Return to the Fulcrum", body: "Near Fulcrum movement comes from testing assumptions and choosing a small aligned action." },
      ])}
    </section>
  `;
}

function AssessmentQuestionCard(item, step, total, progress, answeredCount, skippedCount) {
  const current = state.assessmentAnswers[item.id] || {};
  return `
    <article class="assessment-shell">
      <div class="assessment-progress">
        <div><p class="eyebrow">${escapeHtml(item.domain)}</p><strong>Question ${step + 1} of ${total}</strong></div>
        <span>${answeredCount} answered${skippedCount ? `, ${skippedCount} skipped` : ""}</span>
      </div>
      <div class="progress assessment-bar"><span style="--value:${progress}%"></span></div>
      <section class="assessment-question-card">
        <p class="eyebrow">Self Diagnosis</p>
        <h2>${escapeHtml(item.question)}</h2>
        <div class="assessment-options">
          ${assessmentChoices.map(([value, label]) => `
            <button class="assessment-option ${current.value === value ? "selected" : ""}" data-answer-question="${escapeHtml(item.id)}" data-answer-value="${escapeHtml(value)}">
              <span>${escapeHtml(label)}</span>
            </button>
          `).join("")}
        </div>
      </section>
      <div class="assessment-nav">
        <button class="ghost" data-prev-assessment ${step === 0 ? "disabled" : ""}>Previous</button>
        <button class="ghost" data-skip-assessment>Skip Question</button>
        <button class="primary" data-next-assessment>${step >= total - 1 ? "Complete" : "Next"}</button>
      </div>
    </article>
  `;
}

function AssessmentCompletion(answeredCount, skippedCount) {
  return `
    <article class="assessment-shell completion">
      <p class="eyebrow">Assessment Complete</p>
      <h2>Assessment Complete</h2>
      <p class="lede">You answered ${answeredCount} questions${skippedCount ? ` and skipped ${skippedCount}` : ""}. Generate your results when you are ready.</p>
      <div class="flow-actions">
        <button class="ghost" data-prev-assessment>Review Previous</button>
        <button class="primary" data-submit-assessment>Generate My Results</button>
      </div>
    </article>
  `;
}

function AssessmentResult(assessment) {
  const result = assessment.result || {};
  const scores = assessment.scores || {};
  const book = result.book_reference || {};
  return `
    <article class="panel">
      <div class="panel-heading">
        <div><p class="eyebrow">Assessment result</p><h2>${escapeHtml(result.primary_drift_type || "No result")}</h2></div>
        ${readButton("assessment", "Read Assessment Result")}
      </div>
      <div class="stat-grid">
        ${stat("Secondary Drift", result.secondary_drift_type || "--")}
        ${stat("Fulcrum Alignment", `${result.fulcrum_alignment_score ?? "--"}%`)}
        ${stat("Over-Outward Score", scores.over_outward || 0)}
        ${stat("Over-Inward Score", scores.over_inward || 0)}
        ${stat("Distorted Clarity", scores.distorted_clarity || 0)}
        ${stat("Return Readiness", `${scores.return_readiness_score ?? result.fulcrum_alignment_score ?? "--"}%`)}
      </div>
      <p><strong>Pattern Hypothesis:</strong> ${escapeHtml(result.pattern_hypothesis || "")}</p>
      ${readButton("patternHypothesis", "Read Pattern Hypothesis")}
      <p><strong>Recommended Return Protocol:</strong> ${escapeHtml(result.recommended_return_protocol || "")}</p>
      <p><strong>Suggested Reflection Prompt:</strong> ${escapeHtml(result.suggested_reflection_prompt || "")}</p>
      <p><strong>Related Book Chapters:</strong> ${escapeHtml((book.chapters || []).join("; "))}</p>
      <div class="book-card">
        <p class="eyebrow">Continue in the Book</p>
        <h3>${escapeHtml(book.concept || "Return to the Fulcrum")}</h3>
        <p>${escapeHtml(book.explanation || "")}</p>
        <p><strong>Book Reference:</strong> ${escapeHtml((book.chapters || []).join("; "))}</p>
        <p><strong>Recommended Reading:</strong> ${escapeHtml(book.reading || "")}</p>
        <p><strong>Practice:</strong> ${escapeHtml(book.practice || "")}</p>
      </div>
      <div class="flow-actions">
        <button class="primary" data-view="returnProtocol">Open Return Protocol</button>
        <button class="ghost" data-export-assessment="pdf">Export PDF</button>
        <button class="ghost" data-export-assessment="text">Export Text</button>
        <button class="ghost" data-copy-assessment>Copy Summary</button>
      </div>
    </article>
  `;
}

function PatternCard(pattern) {
  return `
    <article class="panel protocol">
      <p class="eyebrow">${escapeHtml(pattern.framework)}</p>
      <h3>${escapeHtml(pattern.child_pattern_class)}</h3>
      <p>Pressure point: ${escapeHtml(pattern.pressure_point)}. Assumption: ${escapeHtml(pattern.assumption_code)}.</p>
      <div class="stat-grid">
        ${stat("Activations", pattern.activation_count)}
        ${stat("Status", pattern.status)}
      </div>
      <button class="primary" data-examine-pattern="${pattern.id}">Examine Pattern Base</button>
    </article>
  `;
}

function SignalRow(signal) {
  return `
    <article class="question-card">
      <h3>${escapeHtml(signal.child_pattern_class)}</h3>
      <p>${escapeHtml(signal.highlighted_text)}</p>
      <div class="bars">
        ${Object.entries(signal.pressure_point_weights || {}).map(([point, weight]) => bar(point, Math.round(Number(weight) * 100), point === signal.activation_profile?.primary_pressure_point ? "teal" : "")).join("")}
      </div>
    </article>
  `;
}

function FulcrumLaboratory() {
  const pattern = selectedPattern();
  if (!pattern) return emptyState("No pattern selected", "Open the Pattern Drawer and choose Examine Pattern Base.", "Open Pattern Drawer", "patterns");
  return `
    <section class="flow-layout">
      <aside class="flow-aside ${tourClass("laboratory")}" data-tour-key="laboratory">
        <p class="eyebrow">The Fulcrum ${term("Fulcrum")}</p>
        <h2>${escapeHtml(pattern.child_pattern_class)}</h2>
        <p>Anchor assumption: ${escapeHtml(pattern.assumption_code)}</p>
        <div class="helper-card dark-helper">
          <h3>What the Fulcrum represents</h3>
          <p>The Fulcrum is the assumption underneath the recurring pattern. In this lab, the goal is to test that assumption with one small observable action.</p>
        </div>
        <div class="step-list">
          <span class="done">Pattern class detection</span>
          <span class="done">Pressure point weighting</span>
          <span class="done">Assumption mapping</span>
          <span class="active">Micro experiment</span>
          <span>Future alert</span>
        </div>
      </aside>
      <article class="flow-card">
        <p class="eyebrow">Micro experiment design</p>
        <h2>Test the assumption that powers the pattern.</h2>
        <p class="subtle">Micro experiments are recommended because they create evidence. Instead of trying to think your way out of a pattern, you test one small behavior and observe what changes.</p>
        <div class="field">
          <label for="anchorAssumption">Anchor assumption</label>
          <input id="anchorAssumption" value="${escapeHtml(pattern.assumption_code)}" />
        </div>
        <div class="field">
          <label for="microExperiment">Micro experiment</label>
          <textarea id="microExperiment" placeholder="Define one small behavior that tests this assumption."></textarea>
        </div>
        <button class="primary" data-create-experiment="${pattern.id}">Create micro experiment and future alert</button>
        ${RelatedBookConcepts([
          { title: "The Fulcrum", body: "The leverage point beneath repeated behavior." },
          { title: "Assumption to Pattern to Behavior", body: "This lab follows the core sequence from hidden rule to observable response." },
        ])}
      </article>
    </section>
  `;
}

function ReturnProtocolPage() {
  const protocol = state.returnProtocol || state.assessments.latest_assessment?.return_protocol || {};
  return `
    <section class="content-stack">
      <div class="section-header">
        <div><p class="eyebrow">Return Protocol</p><h2>${escapeHtml(protocol.detected || "Near Fulcrum")}</h2></div>
        ${readButton("returnProtocol", "Read Return Protocol")}
      </div>
      <article class="hero-panel">
        <div class="hero-copy">
          <p class="eyebrow">What was detected</p>
          <h2>${escapeHtml(protocol.detected || "Near Fulcrum")}</h2>
          <p class="lede">${escapeHtml(protocol.why_it_matters || "Use one small action, one reflection question, and one feedback signal to return toward the Fulcrum.")}</p>
        </div>
        <div class="instrument-card">
          <p>A Return Protocol turns a pattern hypothesis into a practical next action. It helps you test behavior, gather outward feedback, and return attention to the Fulcrum.</p>
        </div>
      </article>
      <article class="helper-card guidance-card">
        <h3>How to use the protocol</h3>
        <p>Choose one small behavioral experiment, answer the reflection question after the action, and use the feedback action to compare your inner story with outward signal.</p>
        <p>Behavioral experiments are recommended because patterns change through tested evidence, not through explanation alone.</p>
      </article>
      <div class="card-grid">
        ${valueCard("One small behavioral experiment", protocol.small_experiment || "Take one aligned action and observe the pressure response.")}
        ${valueCard("One reflection question", protocol.reflection_question || "What stayed steady when pressure increased?")}
        ${valueCard("One outward feedback action", protocol.outward_feedback_action || "Ask one person whether your action matched your stated intention.")}
        ${valueCard("One follow up reminder suggestion", protocol.reminder_suggestion || "Check back after completing the aligned action.")}
      </div>
      ${RelatedBookConcepts([
        { title: "Return to the Fulcrum", body: "Use action, reflection, and feedback to come back toward grounded alignment." },
        { title: "The Return Protocol", body: "A repeatable structure for moving from pattern recognition to tested behavior." },
      ])}
    </section>
  `;
}

function FuturePatternAlert() {
  const alerts = state.alerts.future_alerts;
  return `
    <section class="content-stack">
      <div class="section-header ${tourClass("alerts")}" data-tour-key="alerts">
        <div><p class="eyebrow">Future Pattern Alert</p><h2>Quiet recognition signals</h2></div>
      </div>
      <div class="card-grid">
        ${alerts.length ? alerts.map((alert) => AlertCard(alert)).join("") : emptyMini("No future alerts yet. Create a micro experiment from an active pattern.")}
      </div>
      ${RelatedBookConcepts([
        { title: "Future Pattern Alert", body: "A quiet recognition signal for noticing a known pattern when it appears again." },
        { title: "Pattern Interception Rate", body: "Future alerts create the moments where interception can be logged and measured." },
      ])}
    </section>
  `;
}

function AlertCard(alert) {
  const pattern = state.alerts.active_patterns.find((item) => item.id === alert.active_pattern_id);
  return `
    <article class="panel">
      <p class="eyebrow">${escapeHtml(alert.alert_style)}</p>
      <h3>${escapeHtml(pattern?.child_pattern_class || alert.trigger_signature.child_pattern_class)}</h3>
      <p>Assumption: ${escapeHtml(alert.trigger_signature.assumption_code)}</p>
      <div class="flow-actions">
        <button class="primary" data-log-interception="${alert.id}" data-pattern-id="${alert.active_pattern_id}" data-response="intercepted_consciously">Intercepted Consciously</button>
        <button class="ghost" data-log-interception="${alert.id}" data-pattern-id="${alert.active_pattern_id}" data-response="repeated_unconsciously">Repeated Unconsciously</button>
        <button class="ghost" data-log-interception="${alert.id}" data-pattern-id="${alert.active_pattern_id}" data-response="not_sure">Not Sure Yet</button>
      </div>
    </article>
  `;
}

function Dashboard() {
  const dashboard = state.dashboard || {};
  const assessment = dashboard.latest_assessment || state.assessments.latest_assessment;
  const scores = assessment?.scores || {};
  const overInward = scores.over_inward || 0;
  const overOutward = scores.over_outward || 0;
  const distorted = scores.distorted_clarity || 0;
  const returnReady = scores.return_readiness_score ?? scores.fulcrum_alignment_score ?? null;
  return `
    <section class="content-stack">
      <div class="section-header">
        <div><p class="eyebrow">Pattern Interception Rate ${term("Pattern Interception Rate")}</p><h2>Operational dashboard</h2></div>
        <div class="flow-actions">
          ${readButton("dashboard", "Read Dashboard Summary")}
          <button class="ghost danger" data-delete-account>Delete my data</button>
        </div>
      </div>
      <article class="start-card ${tourClass("dashboard")}" data-tour-key="dashboard">
        <div>
          <p class="eyebrow">Start Here</p>
          <h2>Begin with structured reflection.</h2>
          <p>Introspectropy helps identify recurring patterns, pressure points, and identity drift through structured reflection.</p>
          <p>Begin by creating your first reflection and allow the system to build pattern hypotheses over time.</p>
        </div>
        <div class="flow-actions">
          <button class="primary" data-view="reflection">Start Reflection</button>
          <button class="ghost" data-start-tour>Take Tour</button>
        </div>
      </article>
      <article class="helper-card guidance-card">
        <h3>Platform overview</h3>
        <p>The dashboard brings together reflection hypotheses, active patterns, Fulcrum position, micro experiments, future alerts, and Pattern Interception Rate.</p>
        <div class="explain-grid mini">
          ${valueCard("Recommended first step", "Start with one reflection or complete Self Diagnosis if you prefer guided questions.")}
          ${valueCard("After a signal appears", "Open the Pattern Drawer to see whether the signal is still a hypothesis or part of an active pattern.")}
          ${valueCard("When a pattern is active", "Use the Fulcrum Laboratory to test the assumption with one micro experiment.")}
        </div>
      </article>
      <article class="reading-hero">
        ${stat("Rolling 30 day PIR", formatPir(dashboard.rolling_30_day_pir))}
        ${stat("Lifetime PIR", formatPir(dashboard.lifetime_pir))}
        ${stat("Active patterns", dashboard.active_patterns?.length || 0)}
        ${stat("Active experiments", dashboard.active_experiments?.length || 0)}
      </article>
      <article class="panel">
        <div class="panel-heading">
          <div><p class="eyebrow">Fulcrum Position</p><h2>${escapeHtml(assessment?.result?.primary_drift_type || "No assessment yet")}</h2></div>
          ${readButton("dashboard", "Read Dashboard Summary")}
        </div>
        <p class="subtle">Fulcrum Position shows where your latest assessment sits between inward drift, outward drift, distorted clarity, and return readiness. Balance matters because it keeps inner signal, outward feedback, and action in contact with each other.</p>
        <div class="stat-grid">
          ${stat("Over Outward Score", overOutward)}
          ${stat("Over Inward Score", overInward)}
          ${stat("Distorted Clarity Score", distorted)}
          ${stat("Return Readiness Score", returnReady === null ? "--" : `${returnReady}%`)}
        </div>
        <div class="fulcrum-meter" style="--position:${fulcrumPosition(overInward, overOutward)}%">
          <span>Over Inward</span><i><b></b></i><span>Over Outward</span>
        </div>
        <p class="center-label">Fulcrum</p>
        <p class="subtle">Drift is detected by scoring assessment answers and comparing repeated behavioral signals across reflections over time.</p>
        ${distorted >= 8 ? `<p class="warning">High certainty may be reducing feedback accuracy.</p>` : ""}
      </article>
      <div class="dashboard-grid">
        <article class="panel">
          <p class="eyebrow">Pressure point</p>
          <h2>${escapeHtml(dashboard.highest_pressure_point || "No data")}</h2>
          <p>Highest pressure point is calculated from behavioral signal weights.</p>
        </article>
        <article class="panel">
          <p class="eyebrow">Child pattern</p>
          <h2>${escapeHtml(dashboard.most_common_child_pattern || "No data")}</h2>
          <p>Most common child pattern across current reflection memory.</p>
        </article>
      </div>
      <article class="panel">
        <p class="eyebrow">PIR by pattern</p>
        <div class="entry-list">
          ${(dashboard.pir_by_pattern || []).length ? dashboard.pir_by_pattern.map((item) => `
            <div class="question-card">
              <h3>${escapeHtml(item.child_pattern_class)}</h3>
              ${bar("Pattern Interception Rate", item.pir ?? 0, "teal")}
            </div>
          `).join("") : emptyMini("No interception logs yet.")}
        </div>
      </article>
      ${RelatedBookConcepts([
        { title: "Pattern Interception Rate", body: "The dashboard tracks how often known patterns are intercepted consciously." },
        { title: "Identity Drift", body: "Fulcrum Position helps watch movement away from grounded identity expression." },
        { title: "The Fulcrum", body: "The center point for interpreting pressure, action, and return." },
      ])}
    </section>
  `;
}

function IdentityBaselineProtocol() {
  const baseline = state.profile?.identity_baseline || {};
  return `
    <section class="flow-layout baseline-layout">
      <aside class="flow-aside ${tourClass("baseline")}" data-tour-key="baseline">
        <p class="eyebrow">Identity Baseline Protocol</p>
        <h2>The Performed Self and Identity Drift watchpoints.</h2>
        <p>This baseline supports future classification. It does not override perceived-threat classification.</p>
        <div class="helper-card dark-helper">
          <h3>What is Identity Baseline?</h3>
          <p>A baseline records how you tend to present yourself under pressure and where identity drift may begin. It gives future reflections context without replacing the evidence in each reflection.</p>
        </div>
        ${readButton("baseline", "Read Identity Baseline")}
      </aside>
      <article class="flow-card">
        <div class="helper-card guidance-card">
          <h3>Why it matters</h3>
          <p>Identity Baseline helps compare current reflection evidence against your known watchpoints. Results should be interpreted as reference context, not as a final answer.</p>
          <p>When the baseline and a reflection disagree, the perceived threat in the reflection remains the classification anchor.</p>
        </div>
        <div class="field">
          <label for="performedSelf">Performed Self context</label>
          <textarea id="performedSelf">${escapeHtml(baseline.performed_self_context || "")}</textarea>
        </div>
        <div class="field">
          <label for="identityDrift">Identity Drift watchpoint</label>
          <textarea id="identityDrift">${escapeHtml(baseline.identity_drift_watchpoint || "")}</textarea>
        </div>
        <div class="field">
          <label for="primaryPressure">Primary pressure point</label>
          <select id="primaryPressure">
            ${pressurePoints.map((point) => `<option value="${point}" ${baseline.primary_pressure_point === point ? "selected" : ""}>${point}</option>`).join("")}
          </select>
        </div>
        <button class="primary" data-save-baseline>Save baseline</button>
        ${RelatedBookConcepts([
          { title: "The Performed Self", body: "The adaptive identity you may use when pressure pushes toward approval, protection, or presentation." },
          { title: "Identity Drift", body: "The gradual gap between authentic identity and expressed identity." },
        ])}
      </article>
    </section>
  `;
}

function WhyIntrospectropy() {
  return `
    <section class="content-stack">
      <article class="hero-panel">
        <div class="hero-copy">
          <p class="eyebrow">Why Introspectropy</p>
          <h2>Make recurring behavior visible before it runs automatically.</h2>
          <p class="lede">Introspectropy connects separated moments into a reflection profile so users can see repeated friction points, identity adaptations, and the assumptions beneath them.</p>
        </div>
        <div class="instrument-card">
          <p>The platform does not tell users what to think. It organizes evidence so the user can examine what keeps happening.</p>
        </div>
      </article>
      <div class="explain-grid">
        ${valueCard("What is Introspectropy?", "A self-reflection operating system that turns repeated life moments into structured pattern evidence.")}
        ${valueCard("Why use it?", "Because patterns are hard to see when every moment feels separate. Introspectropy helps connect those moments.")}
        ${valueCard("Who is it for?", "People who want clearer visibility into repeated friction points, identity adaptations, and behavior under pressure.")}
        ${valueCard("How is it different from journaling?", "Journaling records what happened. Introspectropy organizes reflections into hypotheses, signals, patterns, and micro experiments.")}
        ${valueCard("How does pattern detection work?", "ICE weighs language signals, pressure points, and assumption codes. One reflection creates a hypothesis; repeated related reflections increase confidence.")}
        ${valueCard("What does it produce?", "A reflection profile with behavioral signals, active patterns, Fulcrum assumptions, future alerts, and Pattern Interception Rate.")}
      </div>
      ${RelatedBookConcepts([
        { title: "The Performed Self", body: "A central lens for seeing how pressure changes identity expression." },
        { title: "Leadership Blind Spots", body: "Repeated patterns often remain invisible until separated moments are connected." },
        { title: "Self Reflection Deficits", body: "The platform gives structure to reflection so evidence can accumulate over time." },
      ])}
    </section>
  `;
}

function PricingPage() {
  const tiers = [
    { name: "Explorer", price: "Free", audience: "New users", features: ["Reflection Capture", "Identity Baseline", "Pattern Hypothesis Generation", "Limited History"] },
    { name: "Practitioner", price: "$19-$29/month", audience: "Individual depth users", features: ["Unlimited Reflections", "Pattern History", "Drift Tracking", "Confidence Scoring", "Fulcrum Experiments", "Export Reports"] },
    { name: "Professional", price: "$79-$149 / month", audience: "Coaches, consultants, leaders", features: ["Team Profiles", "Leadership Analytics", "Team Pattern Tracking", "Organizational Drift Monitoring", "Consulting Toolkit"] },
    { name: "Enterprise", price: "Custom", audience: "Organizations and programs", features: ["Unlimited Seats", "API Access", "White Label", "Executive Reporting", "Organizational Analytics", "SSO", "Dedicated Support"] },
  ];
  return `
    <section class="content-stack">
      <div class="section-header">
        <div><p class="eyebrow">Pricing architecture</p><h2>Choose the right operating layer.</h2></div>
      </div>
      <div class="pricing-grid">
        ${tiers.map((tier) => tierCard(tier.name, tier.price, tier.audience, tier.features)).join("")}
      </div>
      <article class="panel comparison-panel">
        <p class="eyebrow">Visual comparison</p>
        <div class="comparison-table">
          <div class="comparison-head"><span>Capability</span>${tiers.map((tier) => `<strong>${escapeHtml(tier.name)}</strong>`).join("")}</div>
          ${["Reflection Capture", "Identity Baseline", "Pattern History", "Fulcrum Experiments", "Team Profiles", "API Access", "SSO"].map((capability) => `
            <div class="comparison-row">
              <span>${escapeHtml(capability)}</span>
              ${tiers.map((tier) => `<i>${tier.features.includes(capability) || (capability === "Reflection Capture" && tier.name !== "Enterprise") || (capability === "Pattern History" && ["Practitioner", "Professional", "Enterprise"].includes(tier.name)) ? "Included" : "-"}</i>`).join("")}
            </div>
          `).join("")}
        </div>
      </article>
      ${RelatedBookConcepts([
        { title: "Insight Processing Infrastructure", body: "Each tier expands how much reflection evidence, pattern history, and reporting can be used." },
        { title: "Pattern First Architecture", body: "Pricing is organized around deeper pattern visibility rather than journal volume." },
      ])}
    </section>
  `;
}

function EnterprisePage() {
  return `
    <section class="content-stack">
      <article class="hero-panel">
        <div class="hero-copy">
          <p class="eyebrow">Enterprise architecture</p>
          <h2>Pattern infrastructure for organizations.</h2>
          <p class="lede">Designed for leadership development organizations, HR departments, executive coaching firms, training organizations, and workforce development programs.</p>
        </div>
        <div class="instrument-card">
          <p>Enterprise views aggregate recurring friction points and team trend signals without changing the SR-OS framework.</p>
        </div>
      </article>
      <div class="card-grid">
        ${valueCard("Organizational pattern analysis", "Map recurring behavioral patterns across groups and programs.")}
        ${valueCard("Team trend reporting", "Surface repeated pressure points and identity adaptations over time.")}
        ${valueCard("Culture pattern reporting", "Translate reflection evidence into organization-level pattern visibility.")}
        ${valueCard("Administrative dashboards", "Give program owners a structured view of adoption and pattern movement.")}
      </div>
      ${RelatedBookConcepts([
        { title: "The Performed Self at Scale", body: "Organizations can examine recurring adaptation patterns across roles and pressure environments." },
        { title: "Recurring Behavioral Patterns", body: "Enterprise architecture looks for repeated friction points without changing the individual SR-OS loop." },
      ])}
    </section>
  `;
}

function AnalyticsDashboard() {
  const analytics = state.analytics || {};
  return `
    <section class="content-stack">
      <div class="section-header">
        <div><p class="eyebrow">Product analytics</p><h2>User behavior signals</h2></div>
      </div>
      <article class="reading-hero">
        ${stat("Tour completion rate", formatPir(analytics.tour_completion_rate))}
        ${stat("Reflection completion rate", formatPir(analytics.reflection_completion_rate))}
        ${stat("Events captured", analytics.total_events || 0)}
        ${stat("Most used feature", analytics.most_used_feature || "No data")}
      </article>
      <div class="dashboard-grid">
        <article class="panel">
          <p class="eyebrow">Drop-off locations</p>
          <div class="entry-list">
            ${(analytics.drop_off_locations || []).length ? analytics.drop_off_locations.map((item) => metricRow(item.label, item.count)).join("") : emptyMini("No drop-off signals yet.")}
          </div>
        </article>
        <article class="panel">
          <p class="eyebrow">Most used features</p>
          <div class="entry-list">
            ${(analytics.most_used_features || []).length ? analytics.most_used_features.map((item) => metricRow(item.label, item.count)).join("") : emptyMini("No feature usage signals yet.")}
          </div>
        </article>
      </div>
      ${RelatedBookConcepts([
        { title: "Pattern Evidence Over Assumption", body: "Analytics tracks product behavior so future decisions are based on observed use." },
        { title: "Reflection Infrastructure", body: "Usage signals show whether people can move through the SR-OS loop clearly." },
      ])}
    </section>
  `;
}

function SettingsPage() {
  const startup = state.profile?.identity_baseline?.default_startup_page || getStartupPage();
  const pref = state.preferences;
  return `
    <section class="content-stack">
      <div class="section-header">
        <div><p class="eyebrow">Control center</p><h2>Settings</h2></div>
      </div>
      <div class="settings-grid">
        ${settingsSection("Appearance", `
          <div class="field">
            <label for="themeMode">Theme</label>
            <select id="themeMode">
              ${option("light", "Light", pref.theme)}
              ${option("dark", "Dark", pref.theme)}
            </select>
          </div>
          ${toggle("largeText", "Larger interface text", pref.largeText)}
        `)}
        ${settingsSection("Accessibility", `
          ${toggle("reducedMotion", "Reduce motion", pref.reducedMotion)}
          ${toggle("readAloud", "Enable read-aloud controls", pref.readAloud)}
          <div class="field">
            <label for="voiceRate">Voice speed</label>
            <input id="voiceRate" type="range" min="0.7" max="1.25" step="0.05" value="${escapeHtml(pref.voiceRate)}" />
          </div>
          <p class="subtle">Read-aloud buttons appear on reflections, classification outputs, pattern analysis, Identity Baseline, and Dashboard summaries.</p>
          <button class="ghost" data-pause-reading>Pause reading</button>
          <button class="ghost" data-stop-reading>Stop reading</button>
        `)}
        ${settingsSection("Startup Preferences", `
          <div class="field">
            <label for="startupPage">Default Startup Page</label>
            <select id="startupPage">
              ${startupViews.map((view) => `<option value="${view}" ${startup === view ? "selected" : ""}>${escapeHtml(titleFor(view))}</option>`).join("")}
            </select>
          </div>
          <p class="subtle">Stored locally and added to your reflection profile when an account session is active.</p>
        `)}
        ${settingsSection("Tigris Companion", `
          ${toggle("tigrisEnabled", "Show Tigris guide companion", state.companionEnabled)}
          <div class="flow-actions">
            <button class="ghost" data-enable-companion>Reopen Tigris</button>
            <button class="ghost" data-minimize-companion>Minimize Tigris</button>
          </div>
        `)}
        ${settingsSection("Notifications", `
          ${toggle("notifications", "Enable future reminder prompts", pref.notifications)}
          <p class="subtle">Browser push delivery is not enabled yet; this preference prepares notification behavior.</p>
        `)}
        ${settingsSection("Account", `
          <p class="subtle">${state.account ? `Signed in as ${escapeHtml(state.account.email)}.` : "Using a private local reflection profile."}</p>
          <div class="flow-actions">
            ${state.account ? `<button class="ghost" data-logout>Sign Out</button>` : `<button class="ghost" data-open-auth>Sign in</button>`}
            <button class="primary" data-export-data>Export Data</button>
          </div>
        `)}
        ${settingsSection("Privacy", `
          ${toggle("localOnly", "Local Only Mode", pref.localOnly)}
          <p class="subtle">Local Only Mode stops product analytics events from being sent by this browser. Account sync and API actions still require the existing backend routes.</p>
        `)}
        ${settingsSection("Intelligence Settings", `
          <div class="field">
            <label for="intelligenceDetail">Explanation detail</label>
            <select id="intelligenceDetail">
              ${option("concise", "Concise", pref.intelligenceDetail)}
              ${option("balanced", "Balanced", pref.intelligenceDetail)}
              ${option("expanded", "Expanded", pref.intelligenceDetail)}
            </select>
          </div>
          <p class="subtle">Controls how much classification explanation the interface presents. ICE taxonomy is unchanged.</p>
        `)}
        ${settingsSection("Reflection Experience", `
          ${toggle("reflectionExamplesOpen", "Open reflection examples by default", pref.reflectionExamplesOpen)}
          ${toggle("reflectionAutoFocus", "Focus reflection input on page open", pref.reflectionAutoFocus)}
        `)}
      </div>
      <article class="panel settings-actions">
        <div>
          <p class="eyebrow">Save preferences</p>
          <p class="subtle">These settings are stored in this browser. Startup page is also saved to your profile through the existing profile API.</p>
        </div>
        <button class="primary" data-save-settings>Save settings</button>
      </article>
    </section>
  `;
}

function settingsSection(title, body) {
  return `<article class="panel settings-card"><h3>${escapeHtml(title)}</h3>${body}</article>`;
}

function option(value, label, selected) {
  return `<option value="${escapeHtml(value)}" ${selected === value ? "selected" : ""}>${escapeHtml(label)}</option>`;
}

function toggle(id, label, checked) {
  return `
    <label class="toggle-row" for="${escapeHtml(id)}">
      <span>${escapeHtml(label)}</span>
      <input id="${escapeHtml(id)}" type="checkbox" ${checked ? "checked" : ""} />
    </label>
  `;
}

function valueCard(title, body) {
  return `<article class="panel value-card"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(body)}</p></article>`;
}

function tierCard(name, price, target, features) {
  return `
    <article class="panel tier-card">
      <p class="eyebrow">${escapeHtml(target)}</p>
      <h3>${escapeHtml(name)}</h3>
      <strong class="price">${escapeHtml(price)}</strong>
      <div class="feature-list">
        ${features.map((item) => feature(item, "")).join("")}
      </div>
    </article>
  `;
}

function titleFor(view) {
  return {
    dashboard: "Dashboard",
    reflection: "Reflection Input",
    selfDiagnosis: "Self Diagnosis",
    patterns: "Pattern Drawer",
    laboratory: "Fulcrum Laboratory",
    returnProtocol: "Return Protocol",
    alerts: "Future Alerts",
    baseline: "Identity Baseline",
    analytics: "Analytics",
  }[view] || view;
}

function metricRow(label, value) {
  return `<div class="question-card metric-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function assessmentSummaryText(assessment = state.assessments.latest_assessment) {
  const result = assessment?.result || {};
  const scores = assessment?.scores || {};
  const book = result.book_reference || {};
  return [
    "Introspectropy SR-OS Self Diagnosis Summary",
    `Primary Drift Type: ${result.primary_drift_type || "No result"}`,
    `Secondary Drift Type: ${result.secondary_drift_type || "No result"}`,
    `Fulcrum Alignment Score: ${result.fulcrum_alignment_score ?? "--"}%`,
    `Over-Outward Score: ${scores.over_outward || 0}`,
    `Over-Inward Score: ${scores.over_inward || 0}`,
    `Distorted Clarity Score: ${scores.distorted_clarity || 0}`,
    `Return Readiness Score: ${scores.return_readiness_score ?? result.fulcrum_alignment_score ?? "--"}%`,
    `Pattern Hypothesis: ${result.pattern_hypothesis || ""}`,
    `Recommended Return Protocol: ${result.recommended_return_protocol || ""}`,
    `Related Book Chapters: ${(book.chapters || []).join("; ")}`,
    `Related Concept: ${book.concept || ""}`,
    `Recommended Reading: ${book.reading || ""}`,
    `Practice or Checklist Reference: ${book.practice || ""}`,
  ].join("\n");
}

function exportAssessment(format) {
  const text = assessmentSummaryText();
  if (format === "pdf") {
    const win = window.open("", "_blank");
    if (!win) {
      flash("Allow popups to export PDF.");
      return;
    }
    win.document.write(`<pre style="font:16px/1.5 system-ui;white-space:pre-wrap;margin:32px;">${escapeHtml(text)}</pre>`);
    win.document.close();
    win.print();
  } else {
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `introspectropy-assessment-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }
  trackEvent("assessment_exported", { format });
}

function readButton(section, label) {
  return state.preferences.readAloud ? `<button class="ghost compact read-button" data-read-section="${escapeHtml(section)}">${escapeHtml(label)}</button>` : "";
}

function currentAssessmentItem() {
  const step = Math.max(0, Math.min(state.assessmentStep, assessmentQuestions.length - 1));
  return { step, item: assessmentQuestions[step] };
}

function showAssessmentQuestion(step) {
  state.assessmentStep = Math.max(0, Math.min(step, assessmentQuestions.length - 1));
  state.assessmentComplete = false;
  saveAssessmentProgress();
  const item = assessmentQuestions[state.assessmentStep];
  trackEvent("assessment_question_viewed", { question: item.id, domain: item.domain, step: state.assessmentStep + 1 });
  render();
}

function selectedPattern() {
  return state.patterns.active_patterns.find((pattern) => pattern.id === state.selectedPatternId) || state.patterns.active_patterns[0] || null;
}

function stat(label, value) {
  return `<div class="stat"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function feature(title, body) {
  return `<div class="feature"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(body)}</span></div>`;
}

function starter(text) {
  return `<button class="starter" data-starter="${escapeHtml(text)}">${escapeHtml(text)}</button>`;
}

function bar(label, value, tone = "") {
  const safeValue = Number.isFinite(Number(value)) ? Math.max(0, Math.min(100, Number(value))) : 0;
  return `<div class="bar ${tone}"><div><span>${escapeHtml(label)}</span><strong>${safeValue}</strong></div><i><span style="--value:${safeValue}%"></span></i></div>`;
}

function emptyState(title, body, label, view) {
  return `<section class="empty-state"><h2>${escapeHtml(title)}</h2><p>${escapeHtml(body)}</p><button class="primary" data-view="${view}">${escapeHtml(label)}</button></section>`;
}

function emptyMini(body) {
  return `<article class="panel"><p class="subtle">${escapeHtml(body)}</p></article>`;
}

function formatPir(value) {
  return value === null || value === undefined ? "--" : `${value}%`;
}

function fulcrumPosition(overInward, overOutward) {
  const total = Math.max(1, Number(overInward) + Number(overOutward));
  return Math.round(50 + ((Number(overOutward) - Number(overInward)) / total) * 42);
}

function renderAuthDialog() {
  return `
    <div class="modal hidden" data-auth-modal>
      <form class="auth-card" data-auth-form>
        <button class="modal-close" type="button" data-close-auth aria-label="Close">x</button>
        <p class="eyebrow">${state.authMode === "login" ? "Welcome back" : "Create account"}</p>
        <h2>${state.authMode === "login" ? "Sign in to sync your reflection profile." : "Keep your SR-OS data across devices."}</h2>
        <div class="field"><label for="email">Email</label><input id="email" type="email" autocomplete="email" required /></div>
        <div class="field"><label for="password">Password</label><input id="password" type="password" autocomplete="${state.authMode === "login" ? "current-password" : "new-password"}" required /></div>
        <button class="primary" type="submit">${state.authMode === "login" ? "Sign in" : "Create account"}</button>
        <button class="link-button" type="button" data-toggle-auth>${state.authMode === "login" ? "Need an account?" : "Already have an account?"}</button>
      </form>
    </div>
  `;
}

function term(label) {
  return `<span class="term" tabindex="0">${escapeHtml(label)}<span class="term-tip">${escapeHtml(glossary[label] || label)}</span></span>`;
}

function currentTourStep() {
  return tourSteps[state.tourStep] || tourSteps[0];
}

function tourClass(key) {
  const step = currentTourStep();
  return state.tourActive && step?.key === key ? "tour-focus" : "";
}

function GuidedTour(step) {
  return `
    <div class="tour-layer">
      <div class="tour-backdrop"></div>
      <aside class="tour-card">
        <div class="tour-tigris">${TigrisAvatar()}</div>
        <p class="eyebrow">${state.tourStep + 1} of ${tourSteps.length}</p>
        <h2>${escapeHtml(step.title)}</h2>
        <p>${escapeHtml(step.body)}</p>
        <div class="flow-actions">
          ${state.tourStep > 0 ? `<button class="ghost" data-prev-tour>Previous</button>` : ""}
          <button class="ghost" data-skip-tour>Skip Tour</button>
          <button class="primary" data-next-tour>${state.tourStep === tourSteps.length - 1 ? "Finish Tour" : "Next"}</button>
        </div>
      </aside>
    </div>
  `;
}

function ReflectionCompanion() {
  const minimized = state.companionMinimized && !state.tourActive;
  if (minimized) {
    return `
      <button class="companion minimized" data-expand-companion aria-label="Open Tigris">
        ${TigrisAvatar()}
      </button>
    `;
  }
  return `
    <aside class="companion ${state.tourActive ? "companion-tour" : ""}">
      <div class="companion-avatar">${TigrisAvatar()}</div>
      <button class="companion-close" data-disable-companion aria-label="Disable Tigris">x</button>
      <button class="companion-minimize" data-minimize-companion aria-label="Minimize Tigris">-</button>
      <strong>Tigris</strong>
      <p>${escapeHtml(companionTip())}</p>
    </aside>
  `;
}

function TigrisAvatar() {
  return `
    <svg class="tigris-avatar" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Tigris tiger guide">
      <circle cx="60" cy="62" r="42" fill="#F28C28"/>
      <circle cx="38" cy="28" r="16" fill="#F28C28"/>
      <circle cx="82" cy="28" r="16" fill="#F28C28"/>
      <circle cx="38" cy="28" r="8" fill="#FFD6A0"/>
      <circle cx="82" cy="28" r="8" fill="#FFD6A0"/>
      <path d="M60 18 L52 42 H68 Z" fill="#1F1F1F"/>
      <path d="M35 45 L18 38" stroke="#1F1F1F" stroke-width="6" stroke-linecap="round"/>
      <path d="M38 58 L20 58" stroke="#1F1F1F" stroke-width="6" stroke-linecap="round"/>
      <path d="M85 45 L102 38" stroke="#1F1F1F" stroke-width="6" stroke-linecap="round"/>
      <path d="M82 58 L100 58" stroke="#1F1F1F" stroke-width="6" stroke-linecap="round"/>
      <circle cx="45" cy="60" r="5" fill="#1F1F1F"/>
      <circle cx="75" cy="60" r="5" fill="#1F1F1F"/>
      <ellipse cx="60" cy="75" rx="18" ry="14" fill="#FFE1B5"/>
      <path d="M55 72 Q60 78 65 72" fill="none" stroke="#1F1F1F" stroke-width="3" stroke-linecap="round"/>
      <path d="M60 78 Q60 86 52 88" fill="none" stroke="#1F1F1F" stroke-width="3" stroke-linecap="round"/>
      <path d="M60 78 Q60 86 68 88" fill="none" stroke="#1F1F1F" stroke-width="3" stroke-linecap="round"/>
      <path d="M30 75 Q15 80 12 68" fill="none" stroke="#1F1F1F" stroke-width="3" stroke-linecap="round"/>
      <path d="M90 75 Q105 80 108 68" fill="none" stroke="#1F1F1F" stroke-width="3" stroke-linecap="round"/>
    </svg>
  `;
}

function companionTip() {
  if (state.view === "reflection") return "Start with one honest moment. I will help turn it into a pattern hypothesis you can inspect.";
  if (state.view === "selfDiagnosis") return "Move one question at a time. Choose the answer that fits your usual response under pressure.";
  if (state.view === "baseline") return "Set your baseline so future reflections have a steadier reference point.";
  if (state.view === "laboratory") return "Pick one assumption to test. Small experiments reveal more than big declarations.";
  if (state.view === "returnProtocol") return "Use this page to return to the Fulcrum through one action, one question, and one feedback signal.";
  if (state.view === "alerts") return "When a familiar pattern appears, log what happened without judging the result.";
  if (state.view === "dashboard") return "Start here to see your current position, then choose reflection, assessment, or return protocol.";
  if (state.view === "why") return "Use this page when you want the big picture before doing the work.";
  if (state.view === "pricing") return "Compare the operating layers and choose the level that matches the work you want to do.";
  if (state.view === "enterprise") return "Enterprise views translate individual pattern work into team and organization insight.";
  if (state.view === "analytics") return "Use analytics to see how people move through the product, not to judge reflection content.";
  if (state.view === "settings") return "Tune the app around how you want to work: theme, read-aloud, startup page, and guidance.";
  return "Open a pattern when you are ready to inspect what keeps repeating.";
}

function flash(message) {
  state.toast = message;
  render();
  setTimeout(() => {
    state.toast = "";
    render();
  }, 2400);
}

function speakText(text, label = "content") {
  if (!("speechSynthesis" in window)) {
    flash("Read-aloud is not supported in this browser.");
    return;
  }
  const cleanText = String(text || "").replace(/\s+/g, " ").trim();
  if (!cleanText) {
    flash(`No ${label} available to read yet.`);
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(cleanText.slice(0, 4200));
  utterance.rate = Number(state.preferences.voiceRate || 0.92);
  utterance.pitch = 1;
  utterance.onend = () => trackEvent("read_aloud_completed", { label });
  window.speechSynthesis.speak(utterance);
  trackEvent("read_aloud_started", { label });
  flash(`Reading ${label}.`);
}

function readSection(section) {
  const dashboard = state.dashboard || {};
  const baseline = state.profile?.identity_baseline || {};
  const result = state.lastResult || {};
  const classification = result.classification || {};
  const reflectionText = document.querySelector("#reflectionText")?.value || result.reflection?.raw_text || "";

  if (section === "reflection") {
    speakText(reflectionText, "reflection");
    return;
  }

  if (section === "classification") {
    speakText([
      "Classification output.",
      classification.child_pattern_class ? `Pattern hypothesis: ${classification.child_pattern_class}.` : "",
      classification.parent_pattern_class ? `Parent pattern class: ${classification.parent_pattern_class}.` : "",
      classification.assumption_code ? `Assumption code: ${classification.assumption_code}.` : "",
      classification.confidence_score !== undefined ? `Confidence score: ${classification.confidence_score}.` : "",
      classification.activation_profile?.primary_pressure_point ? `Primary pressure point: ${classification.activation_profile.primary_pressure_point}.` : "",
      classification.highlighted_text ? `Highlighted reflection text: ${classification.highlighted_text}.` : "",
      classification.micro_experiment_prompt ? `Suggested micro experiment: ${classification.micro_experiment_prompt}.` : "",
    ].filter(Boolean).join(" "), "classification");
    return;
  }

  if (section === "assessment") {
    const assessment = state.assessments.latest_assessment;
    const result = assessment?.result || {};
    const book = result.book_reference || {};
    speakText([
      "Self Diagnosis assessment result.",
      result.primary_drift_type ? `Primary Drift Type: ${result.primary_drift_type}.` : "",
      result.secondary_drift_type ? `Secondary Drift Type: ${result.secondary_drift_type}.` : "",
      result.fulcrum_alignment_score !== undefined ? `Fulcrum Alignment Score: ${result.fulcrum_alignment_score} percent.` : "",
      result.pattern_hypothesis ? `Pattern Hypothesis: ${result.pattern_hypothesis}.` : "",
      result.recommended_return_protocol ? `Recommended Return Protocol: ${result.recommended_return_protocol}.` : "",
      result.suggested_reflection_prompt ? `Suggested Reflection Prompt: ${result.suggested_reflection_prompt}.` : "",
      book.concept ? `Book concept: ${book.concept}.` : "",
      book.chapters ? `Continue in the book: ${book.chapters.join("; ")}.` : "",
    ].filter(Boolean).join(" "), "assessment result");
    return;
  }

  if (section === "patternHypothesis") {
    const result = state.assessments.latest_assessment?.result || state.lastResult?.classification || {};
    speakText(result.pattern_hypothesis || result.child_pattern_class || "", "pattern hypothesis");
    return;
  }

  if (section === "patterns") {
    const active = state.patterns.active_patterns || [];
    const signals = state.patterns.behavioral_signals || [];
    const activeSummary = active.length
      ? active.map((pattern) => `${pattern.child_pattern_class}, ${pattern.activation_count || 0} activations, pressure point ${pattern.pressure_point}, assumption ${pattern.assumption_code}.`).join(" ")
      : "No active patterns yet. A pattern becomes active after three related signals in ninety days.";
    const signalSummary = signals.length
      ? `Recent signals include ${signals.slice(0, 5).map((signal) => `${signal.child_pattern_class}: ${signal.highlighted_text}`).join(" ")}`
      : "No recent behavioral signals are available yet.";
    speakText(`Pattern analysis. ${activeSummary} ${signalSummary}`, "pattern analysis");
    return;
  }

  if (section === "baseline") {
    speakText([
      "Identity Baseline.",
      baseline.performed_self_context ? `Performed Self context: ${baseline.performed_self_context}.` : "Performed Self context has not been added yet.",
      baseline.identity_drift_watchpoint ? `Identity Drift watchpoint: ${baseline.identity_drift_watchpoint}.` : "Identity Drift watchpoint has not been added yet.",
      baseline.primary_pressure_point ? `Primary pressure point: ${baseline.primary_pressure_point}.` : "Primary pressure point has not been selected yet.",
    ].join(" "), "identity baseline");
    return;
  }

  if (section === "dashboard") {
    speakText([
      "Dashboard summary.",
      `Rolling thirty day Pattern Interception Rate: ${formatPir(dashboard.rolling_30_day_pir)}.`,
      `Lifetime Pattern Interception Rate: ${formatPir(dashboard.lifetime_pir)}.`,
      `Active patterns: ${dashboard.active_patterns?.length || 0}.`,
      `Active experiments: ${dashboard.active_experiments?.length || 0}.`,
      dashboard.highest_pressure_point ? `Highest pressure point: ${dashboard.highest_pressure_point}.` : "No highest pressure point yet.",
      dashboard.most_common_child_pattern ? `Most common child pattern: ${dashboard.most_common_child_pattern}.` : "No common child pattern yet.",
    ].join(" "), "dashboard summary");
    return;
  }

  if (section === "returnProtocol") {
    const protocol = state.returnProtocol || state.assessments.latest_assessment?.return_protocol || {};
    speakText([
      "Return Protocol.",
      protocol.detected ? `Detected: ${protocol.detected}.` : "",
      protocol.why_it_matters ? `Why it matters: ${protocol.why_it_matters}.` : "",
      protocol.small_experiment ? `Small experiment: ${protocol.small_experiment}.` : "",
      protocol.reflection_question ? `Reflection question: ${protocol.reflection_question}.` : "",
      protocol.outward_feedback_action ? `Outward feedback action: ${protocol.outward_feedback_action}.` : "",
      protocol.reminder_suggestion ? `Follow up reminder suggestion: ${protocol.reminder_suggestion}.` : "",
    ].filter(Boolean).join(" "), "return protocol");
  }
}

function stopReading() {
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  flash("Read-aloud stopped.");
}

function pauseReading() {
  if ("speechSynthesis" in window) window.speechSynthesis.pause();
  flash("Read-aloud paused.");
}

async function exportData() {
  const response = await fetch("/api/export", {
    credentials: "same-origin",
    headers: { "x-client-id": state.clientId },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Export failed.");
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `introspectropy-export-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  flash("Export prepared.");
}

app.addEventListener("click", async (event) => {
  const target = event.target.closest("button");
  if (!target) return;

  try {
    if (target.dataset.view) {
      state.view = target.dataset.view;
      trackEvent("view_changed", { view: state.view });
      if (state.view === "returnProtocol") trackEvent("return_protocol_viewed");
      if (state.view === "selfDiagnosis" && !state.assessmentComplete) {
        const item = assessmentQuestions[state.assessmentStep] || assessmentQuestions[0];
        trackEvent("assessment_question_viewed", { question: item.id, domain: item.domain, step: state.assessmentStep + 1 });
      }
      render();
      return;
    }
    if (target.dataset.startTour !== undefined) {
      trackEvent("tour_started");
      state.tourActive = true;
      state.companionMinimized = false;
      state.tourStep = 0;
      state.view = tourSteps[0].view;
      render();
      return;
    }
    if (target.dataset.skipTour !== undefined) {
      trackEvent("tour_skipped", { step: state.tourStep });
      state.tourActive = false;
      localStorage.setItem("introspectropy.tourComplete", "true");
      render();
      return;
    }
    if (target.dataset.prevTour !== undefined) {
      state.tourStep = Math.max(0, state.tourStep - 1);
      state.view = currentTourStep().view;
      render();
      return;
    }
    if (target.dataset.nextTour !== undefined) {
      if (state.tourStep >= tourSteps.length - 1) {
        trackEvent("tour_completed");
        state.tourActive = false;
        localStorage.setItem("introspectropy.tourComplete", "true");
      } else {
        state.tourStep += 1;
        state.view = currentTourStep().view;
      }
      render();
      return;
    }
    if (target.dataset.minimizeCompanion !== undefined) {
      state.companionMinimized = true;
      localStorage.setItem("introspectropy.companionMinimized", "true");
      render();
      return;
    }
    if (target.dataset.expandCompanion !== undefined) {
      state.companionMinimized = false;
      localStorage.removeItem("introspectropy.companionMinimized");
      render();
      return;
    }
    if (target.dataset.enableCompanion !== undefined) {
      state.companionEnabled = true;
      state.companionMinimized = false;
      localStorage.removeItem("introspectropy.companionDisabled");
      localStorage.removeItem("introspectropy.companionMinimized");
      flash("Tigris is available again.");
      return;
    }
    if (target.dataset.disableCompanion !== undefined) {
      trackEvent("companion_disabled", { view: state.view });
      state.companionEnabled = false;
      state.companionMinimized = false;
      localStorage.setItem("introspectropy.companionDisabled", "true");
      localStorage.removeItem("introspectropy.companionMinimized");
      render();
      return;
    }
    if (target.dataset.starter) {
      trackEvent("reflection_starter_used", { prompt: target.dataset.starter });
      const input = document.querySelector("#reflectionText");
      if (input) {
        input.value = target.dataset.starter;
        input.focus();
      }
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
    if (target.dataset.exportData !== undefined) {
      await exportData();
      return;
    }
    if (target.dataset.readSection) {
      readSection(target.dataset.readSection);
      return;
    }
    if (target.dataset.stopReading !== undefined) {
      stopReading();
      return;
    }
    if (target.dataset.pauseReading !== undefined) {
      pauseReading();
      return;
    }
    if (target.dataset.answerQuestion) {
      const { item } = currentAssessmentItem();
      state.assessmentAnswers[target.dataset.answerQuestion] = {
        domain: item.domain,
        question: item.question,
        value: target.dataset.answerValue,
      };
      saveAssessmentProgress();
      trackEvent("assessment_question_answered", { question: item.id, domain: item.domain, value: target.dataset.answerValue });
      render();
      return;
    }
    if (target.dataset.prevAssessment !== undefined) {
      showAssessmentQuestion(state.assessmentStep - 1);
      return;
    }
    if (target.dataset.skipAssessment !== undefined) {
      const { item } = currentAssessmentItem();
      state.assessmentAnswers[item.id] = { domain: item.domain, question: item.question, value: "skipped", skipped: true };
      saveAssessmentProgress();
      trackEvent("assessment_question_answered", { question: item.id, domain: item.domain, value: "skipped" });
      if (state.assessmentStep >= assessmentQuestions.length - 1) {
        state.assessmentComplete = true;
        saveAssessmentProgress();
        trackEvent("assessment_completed", { answered: Object.values(state.assessmentAnswers).filter((answer) => answer && !answer.skipped).length });
        render();
      } else {
        showAssessmentQuestion(state.assessmentStep + 1);
      }
      return;
    }
    if (target.dataset.nextAssessment !== undefined) {
      if (state.assessmentStep >= assessmentQuestions.length - 1) {
        state.assessmentComplete = true;
        saveAssessmentProgress();
        trackEvent("assessment_completed", { answered: Object.values(state.assessmentAnswers).filter((answer) => answer && !answer.skipped).length });
        render();
      } else {
        showAssessmentQuestion(state.assessmentStep + 1);
      }
      return;
    }
    if (target.dataset.submitReflection !== undefined) {
      const raw_text = document.querySelector("#reflectionText")?.value || "";
      const result = await api.post("/api/reflections", { raw_text });
      trackEvent("reflection_submitted", { has_signal: Boolean(result.behavioral_signal), has_active_pattern: Boolean(result.active_pattern) });
      state.lastResult = result;
      await refresh();
      render();
      return;
    }
    if (target.dataset.submitAssessment !== undefined) {
      const answers = Object.values(state.assessmentAnswers).filter((answer) => answer && !answer.skipped && answer.value !== "skipped");
      if (!answers.length) throw new Error("Answer at least one assessment question before generating results.");
      const result = await api.post("/api/assessments", { answers });
      state.assessments.latest_assessment = result.assessment_result;
      state.assessmentComplete = true;
      saveAssessmentProgress();
      trackEvent("assessment_results_generated", { primary_drift_type: result.assessment_result?.result?.primary_drift_type });
      await refresh();
      state.view = "selfDiagnosis";
      flash("Assessment completed.");
      return;
    }
    if (target.dataset.exportAssessment) {
      exportAssessment(target.dataset.exportAssessment);
      return;
    }
    if (target.dataset.copyAssessment !== undefined) {
      await navigator.clipboard.writeText(assessmentSummaryText());
      trackEvent("assessment_exported", { format: "copy" });
      flash("Assessment summary copied.");
      return;
    }
    if (target.dataset.examinePattern) {
      state.selectedPatternId = target.dataset.examinePattern;
      state.view = "laboratory";
      render();
      return;
    }
    if (target.dataset.createExperiment) {
      const active_pattern_id = target.dataset.createExperiment;
      await api.post(`/api/patterns/${active_pattern_id}/experiment`, {
        anchor_assumption: document.querySelector("#anchorAssumption")?.value || "",
        micro_experiment: document.querySelector("#microExperiment")?.value || "",
      });
      await refresh();
      state.view = "alerts";
      flash("Micro experiment and future alert created.");
      return;
    }
    if (target.dataset.logInterception) {
      await api.post("/api/interceptions", {
        future_alert_id: target.dataset.logInterception,
        active_pattern_id: target.dataset.patternId,
        response: target.dataset.response,
      });
      await refresh();
      flash("Interception logged.");
      return;
    }
    if (target.dataset.saveBaseline !== undefined) {
      await api.put("/api/me", {
        performed_self_context: document.querySelector("#performedSelf")?.value || "",
        identity_drift_watchpoint: document.querySelector("#identityDrift")?.value || "",
        primary_pressure_point: document.querySelector("#primaryPressure")?.value || "",
        default_startup_page: state.profile?.identity_baseline?.default_startup_page || getStartupPage(),
      });
      await refresh();
      flash("Identity baseline saved.");
      return;
    }
    if (target.dataset.saveSettings !== undefined) {
      const selected = setStartupPage(document.querySelector("#startupPage")?.value || "dashboard");
      const tigrisEnabled = Boolean(document.querySelector("#tigrisEnabled")?.checked);
      state.companionEnabled = tigrisEnabled;
      if (tigrisEnabled) {
        localStorage.removeItem("introspectropy.companionDisabled");
      } else {
        localStorage.setItem("introspectropy.companionDisabled", "true");
      }
      savePreferences({
        theme: document.querySelector("#themeMode")?.value || "light",
        reducedMotion: Boolean(document.querySelector("#reducedMotion")?.checked),
        largeText: Boolean(document.querySelector("#largeText")?.checked),
        readAloud: Boolean(document.querySelector("#readAloud")?.checked),
        voiceRate: document.querySelector("#voiceRate")?.value || "0.92",
        localOnly: Boolean(document.querySelector("#localOnly")?.checked),
        notifications: Boolean(document.querySelector("#notifications")?.checked),
        intelligenceDetail: document.querySelector("#intelligenceDetail")?.value || "balanced",
        reflectionExamplesOpen: Boolean(document.querySelector("#reflectionExamplesOpen")?.checked),
        reflectionAutoFocus: Boolean(document.querySelector("#reflectionAutoFocus")?.checked),
      });
      const baseline = state.profile?.identity_baseline || {};
      await api.put("/api/me", {
        performed_self_context: baseline.performed_self_context || "",
        identity_drift_watchpoint: baseline.identity_drift_watchpoint || "",
        primary_pressure_point: baseline.primary_pressure_point || "",
        default_startup_page: selected,
      });
      await refresh();
      flash("Settings saved.");
      return;
    }
    if (target.dataset.deleteAccount !== undefined) {
      if (!confirm("Delete all SR-OS data for this user?")) return;
      await api.delete("/api/me");
      localStorage.removeItem("introspectrophy.clientId");
      location.reload();
    }
  } catch (error) {
    flash(error.message);
  }
});

app.addEventListener("submit", async (event) => {
  if (!event.target.matches("[data-auth-form]")) return;
  event.preventDefault();
  try {
    const email = document.querySelector("#email").value;
    const password = document.querySelector("#password").value;
    await api.post(state.authMode === "login" ? "/api/auth/login" : "/api/auth/register", { email, password });
    await refresh();
    document.querySelector("[data-auth-modal]")?.classList.add("hidden");
    flash(state.authMode === "login" ? "Signed in." : "Account created.");
  } catch (error) {
    flash(error.message);
  }
});

boot().catch((error) => {
  app.innerHTML = `<main class="fatal"><h1>App failed to load</h1><p>${escapeHtml(error.message)}</p></main>`;
});

import { createServer } from "node:http";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { createHash, pbkdf2Sync, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";

const PORT = Number(process.env.PORT || 3000);
const ROOT = process.cwd();
const PUBLIC_DIR = resolve(ROOT, "public");
const DATA_FILE = resolve(ROOT, process.env.DATA_FILE || "data/db.json");
const DATABASE_URL = process.env.DATABASE_URL || "";
const APP_ORIGIN = process.env.APP_ORIGIN || `http://localhost:${PORT}`;
const SESSION_DAYS = 30;
const SIGNAL_CONFIDENCE_THRESHOLD = 0.65;
const ACTIVE_PATTERN_WINDOW_DAYS = 90;

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
};

const PRESSURE_POINTS = {
  competence: ["fail", "failed", "wrong", "incapable", "inadequate", "mistake", "performance", "output", "capable"],
  belonging: ["rejected", "excluded", "alone", "group", "belong", "ignored by them", "isolated", "connection"],
  autonomy: ["controlled", "trapped", "forced", "micromanaged", "permission", "agency", "cornered", "choice"],
  recognition: ["overlooked", "ignored", "credit", "status", "seen", "valued", "invisible", "noticed"],
  security: ["unsafe", "unstable", "chaos", "volatile", "risk", "uncertain", "security", "protected"],
  purpose: ["meaningless", "misaligned", "wasted", "purpose", "significant", "direction", "alignment", "pointless"],
};

const PATTERN_CLASSES = [
  {
    parent: "Validation Loops",
    child: "Competence Validation Loop",
    assumption: "ASM_PERFORMANCE",
    framework: "The Performed Self",
    pressure: "competence",
    terms: ["prove", "perform", "perfect", "capable", "failure", "output", "approval", "enough"],
    intervention: "Run a micro experiment where one useful action is completed without adding performance display.",
  },
  {
    parent: "Validation Loops",
    child: "Recognition Validation Loop",
    assumption: "ASM_VISIBILITY",
    framework: "Over-Outward Identity",
    pressure: "recognition",
    terms: ["seen", "credit", "noticed", "recognized", "status", "overlooked", "valued"],
    intervention: "Record the action's internal value before seeking external confirmation.",
  },
  {
    parent: "Avoidance Loops",
    child: "Conflict Avoidance Loop",
    assumption: "ASM_REJECTION",
    framework: "The Performed Self",
    pressure: "belonging",
    terms: ["avoid", "conflict", "rejection", "upset", "disagree", "tension", "approval"],
    intervention: "State one boundary or preference in a low-stakes context and observe the result.",
  },
  {
    parent: "Avoidance Loops",
    child: "Boundary Postponement Loop",
    assumption: "ASM_SUBORDINATION",
    framework: "Identity Drift",
    pressure: "autonomy",
    terms: ["later", "boundary", "yes", "overcommit", "others", "my needs", "postpone"],
    intervention: "Delay one automatic yes and ask for time before committing.",
  },
  {
    parent: "Identity Protection Loops",
    child: "Performed Competence Shield",
    assumption: "ASM_EXPOSURE",
    framework: "The Performed Self",
    pressure: "competence",
    terms: ["hide", "mistake", "expose", "weak", "competent", "shield", "know everything"],
    intervention: "Name one uncertainty directly before adding explanation.",
  },
  {
    parent: "Identity Protection Loops",
    child: "Hyper-Independent Defense",
    assumption: "ASM_DEPENDENCE_RISK",
    framework: "Identity Drift",
    pressure: "autonomy",
    terms: ["alone", "help", "depend", "independent", "need", "burden", "control"],
    intervention: "Ask for one specific input while keeping ownership of the decision.",
  },
  {
    parent: "Scarcity Loops",
    child: "Urgency Overcommitment Drift",
    assumption: "ASM_SCARCITY",
    framework: "Behavioral Drift",
    pressure: "security",
    terms: ["urgent", "scarce", "rush", "miss out", "overcommit", "not enough", "unstable"],
    intervention: "Remove one nonessential commitment for 24 hours and observe the pressure response.",
  },
  {
    parent: "Control Loops",
    child: "Autonomy Protection Loop",
    assumption: "ASM_CONTROL",
    framework: "The Fulcrum",
    pressure: "autonomy",
    terms: ["control", "micromanage", "forced", "trapped", "permission", "resist", "managed"],
    intervention: "Identify one controllable variable and release one nonessential control attempt.",
  },
  {
    parent: "Performance Loops",
    child: "Over-Outward Executive Performance",
    assumption: "ASM_IMAGE_MAINTENANCE",
    framework: "Over-Outward Identity",
    pressure: "recognition",
    terms: ["image", "presentation", "perform", "executive", "appear", "impress", "audience"],
    intervention: "Make one aligned decision privately before optimizing how it appears.",
  },
  {
    parent: "Performance Loops",
    child: "Compliance Presentation Loop",
    assumption: "ASM_BELONGING",
    framework: "The Performed Self",
    pressure: "belonging",
    terms: ["comply", "agree", "fit in", "belong", "accepted", "approval", "please"],
    intervention: "Give one accurate response instead of the most acceptable response.",
  },
];

let writeQueue = Promise.resolve();
let pgPool = null;

async function loadDb() {
  if (DATABASE_URL) return await loadPostgresDb();
  await mkdir(resolve(DATA_FILE, ".."), { recursive: true });
  try {
    return migrateDb(JSON.parse(await readFile(DATA_FILE, "utf8")));
  } catch {
    const initial = migrateDb({});
    await saveDb(initial);
    return initial;
  }
}

function migrateDb(db) {
  db.schemaVersion = 2;
  db.users ||= {};
  db.accounts ||= {};
  db.sessions ||= {};
  db.reflections ||= [];
  db.behavioral_signals ||= [];
  db.active_patterns ||= [];
  db.pattern_links ||= [];
  db.assumption_profiles ||= [];
  db.micro_experiments ||= [];
  db.future_alerts ||= [];
  db.interception_logs ||= [];
  db.analytics_events ||= [];
  db.assessment_results ||= [];
  db.createdAt ||= new Date().toISOString();

  for (const [id, account] of Object.entries(db.accounts)) {
    db.users[id] ||= {
      id,
      identity_baseline: {},
      created_at: account.createdAt || new Date().toISOString(),
      updated_at: account.updatedAt || new Date().toISOString(),
    };
  }

  if (Array.isArray(db.journals) && !db._journalsMigrated) {
    for (const journal of db.journals) {
      if (!db.reflections.some((item) => item.legacy_id === journal.id)) {
        db.reflections.push({
          id: randomUUID(),
          user_id: journal.clientId,
          raw_text: journal.body || "",
          source: "legacy_journal",
          legacy_id: journal.id,
          created_at: journal.createdAt || new Date().toISOString(),
        });
      }
    }
    db._journalsMigrated = true;
  }

  return db;
}

async function saveDb(db) {
  if (DATABASE_URL) return await savePostgresDb(migrateDb(db));
  writeQueue = writeQueue.then(() => writeFile(DATA_FILE, JSON.stringify(db, null, 2)));
  return writeQueue;
}

async function getPgPool() {
  if (!pgPool) {
    const { Pool } = await import("pg");
    pgPool = new Pool({
      connectionString: DATABASE_URL,
      ssl: process.env.DATABASE_SSL === "false" ? false : process.env.DATABASE_URL?.includes("localhost") ? false : { rejectUnauthorized: false },
    });
  }
  return pgPool;
}

async function loadPostgresDb() {
  const pool = await getPgPool();
  const [
    users,
    sessions,
    reflections,
    behavioralSignals,
    activePatterns,
    patternLinks,
    assumptionProfiles,
    microExperiments,
    futureAlerts,
    interceptionLogs,
    analyticsEvents,
    assessmentResults,
  ] = await Promise.all([
    pool.query("select * from users"),
    pool.query("select * from user_sessions"),
    pool.query("select * from reflections order by created_at"),
    pool.query("select * from behavioral_signals order by created_at"),
    pool.query("select * from active_patterns order by created_at"),
    pool.query("select * from pattern_links order by created_at"),
    pool.query("select * from assumption_profiles order by created_at"),
    pool.query("select * from micro_experiments order by created_at"),
    pool.query("select * from future_alerts order by created_at"),
    pool.query("select * from interception_logs order by created_at"),
    pool.query("select * from analytics_events order by created_at"),
    pool.query("select * from assessment_results order by created_at"),
  ]);

  const db = migrateDb({
    schemaVersion: 2,
    users: {},
    accounts: {},
    sessions: {},
    reflections: reflections.rows.map(mapRow),
    behavioral_signals: behavioralSignals.rows.map(mapRow),
    active_patterns: activePatterns.rows.map(mapRow),
    pattern_links: patternLinks.rows.map(mapRow),
    assumption_profiles: assumptionProfiles.rows.map(mapRow),
    micro_experiments: microExperiments.rows.map(mapRow),
    future_alerts: futureAlerts.rows.map(mapRow),
    interception_logs: interceptionLogs.rows.map(mapRow),
    analytics_events: analyticsEvents.rows.map(mapRow),
    assessment_results: assessmentResults.rows.map(mapRow),
    createdAt: new Date().toISOString(),
  });

  for (const row of users.rows) {
    db.users[row.id] = {
      id: row.id,
      identity_baseline: row.identity_baseline || {},
      created_at: toIso(row.created_at),
      updated_at: toIso(row.updated_at),
    };
    if (row.email) {
      db.accounts[row.id] = {
        id: row.id,
        email: row.email,
        passwordHash: row.password_hash,
        createdAt: toIso(row.created_at),
        updatedAt: toIso(row.updated_at),
      };
    }
  }

  for (const row of sessions.rows) {
    db.sessions[row.token_hash] = {
      accountId: row.account_id,
      createdAt: toIso(row.created_at),
      expiresAt: toIso(row.expires_at),
    };
  }

  return db;
}

function mapRow(row) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, value instanceof Date ? value.toISOString() : value]),
  );
}

function toIso(value) {
  return value instanceof Date ? value.toISOString() : value || new Date().toISOString();
}

async function savePostgresDb(db) {
  const pool = await getPgPool();
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("delete from analytics_events");
    await client.query("delete from assessment_results");
    await client.query("delete from interception_logs");
    await client.query("delete from future_alerts");
    await client.query("delete from micro_experiments");
    await client.query("delete from assumption_profiles");
    await client.query("delete from pattern_links");
    await client.query("delete from active_patterns");
    await client.query("delete from behavioral_signals");
    await client.query("delete from reflections");
    await client.query("delete from user_sessions");
    await client.query("delete from users");

    const accountIds = new Set(Object.keys(db.accounts));
    const userIds = new Set([...Object.keys(db.users), ...accountIds]);
    for (const id of userIds) {
      const user = db.users[id] || {};
      const account = db.accounts[id] || null;
      await client.query(
        `insert into users (id, email, password_hash, identity_baseline, created_at, updated_at)
         values ($1, $2, $3, $4, $5, $6)`,
        [
          id,
          account?.email || null,
          account?.passwordHash || null,
          user.identity_baseline || {},
          user.created_at || account?.createdAt || new Date().toISOString(),
          user.updated_at || account?.updatedAt || new Date().toISOString(),
        ],
      );
    }

    for (const [token_hash, session] of Object.entries(db.sessions)) {
      if (!db.accounts[session.accountId]) continue;
      await client.query(
        "insert into user_sessions (token_hash, account_id, created_at, expires_at) values ($1, $2, $3, $4)",
        [token_hash, session.accountId, session.createdAt, session.expiresAt],
      );
    }

    for (const item of db.reflections) {
      await client.query(
        "insert into reflections (id, user_id, raw_text, source, created_at) values ($1, $2, $3, $4, $5)",
        [item.id, item.user_id, item.raw_text, item.source || "reflection_input", item.created_at],
      );
    }
    for (const item of db.behavioral_signals) {
      await client.query(
        `insert into behavioral_signals
         (id, user_id, reflection_id, primary_pattern_class, child_pattern_class, confidence_score, pressure_point_weights, activation_profile, assumption_code, highlighted_text, suggested_intervention, created_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [item.id, item.user_id, item.reflection_id, item.primary_pattern_class, item.child_pattern_class, item.confidence_score, item.pressure_point_weights || {}, item.activation_profile || {}, item.assumption_code, item.highlighted_text, item.suggested_intervention, item.created_at],
      );
    }
    for (const item of db.active_patterns) {
      await client.query(
        `insert into active_patterns
         (id, user_id, primary_pattern_class, child_pattern_class, framework, pressure_point, assumption_code, activation_count, status, first_seen_at, last_seen_at, created_at, updated_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [item.id, item.user_id, item.primary_pattern_class, item.child_pattern_class, item.framework, item.pressure_point, item.assumption_code, item.activation_count || 0, item.status || "active", item.first_seen_at, item.last_seen_at, item.created_at, item.updated_at],
      );
    }
    for (const item of db.pattern_links) {
      await client.query(
        "insert into pattern_links (id, user_id, active_pattern_id, behavioral_signal_id, created_at) values ($1,$2,$3,$4,$5)",
        [item.id, item.user_id, item.active_pattern_id, item.behavioral_signal_id, item.created_at],
      );
    }
    for (const item of db.assumption_profiles) {
      await client.query(
        "insert into assumption_profiles (id, user_id, assumption_code, occurrence_count, linked_pattern_ids, created_at, updated_at) values ($1,$2,$3,$4,$5,$6,$7)",
        [item.id, item.user_id, item.assumption_code, item.occurrence_count || 0, item.linked_pattern_ids || [], item.created_at, item.updated_at],
      );
    }
    for (const item of db.micro_experiments) {
      await client.query(
        "insert into micro_experiments (id, user_id, active_pattern_id, anchor_assumption, micro_experiment, status, created_at, updated_at) values ($1,$2,$3,$4,$5,$6,$7,$8)",
        [item.id, item.user_id, item.active_pattern_id, item.anchor_assumption, item.micro_experiment, item.status || "active", item.created_at, item.updated_at],
      );
    }
    for (const item of db.future_alerts) {
      await client.query(
        "insert into future_alerts (id, user_id, active_pattern_id, micro_experiment_id, alert_style, trigger_signature, status, created_at, updated_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
        [item.id, item.user_id, item.active_pattern_id, item.micro_experiment_id || null, item.alert_style, item.trigger_signature || {}, item.status || "active", item.created_at, item.updated_at],
      );
    }
    for (const item of db.interception_logs) {
      await client.query(
        "insert into interception_logs (id, user_id, future_alert_id, active_pattern_id, response, created_at) values ($1,$2,$3,$4,$5,$6)",
        [item.id, item.user_id, item.future_alert_id || null, item.active_pattern_id || null, item.response, item.created_at],
      );
    }
    for (const item of db.analytics_events) {
      await client.query(
        "insert into analytics_events (id, user_id, event_name, metadata, created_at) values ($1,$2,$3,$4,$5)",
        [item.id, item.user_id, item.event_name, item.metadata || {}, item.created_at],
      );
    }
    for (const item of db.assessment_results) {
      await client.query(
        "insert into assessment_results (id, user_id, answers, scores, result, return_protocol, created_at) values ($1,$2,$3,$4,$5,$6,$7)",
        [item.id, item.user_id, item.answers || [], item.scores || {}, item.result || {}, item.return_protocol || {}, item.created_at],
      );
    }

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

function sendJson(res, status, payload) {
  res.writeHead(status, JSON_HEADERS);
  res.end(JSON.stringify(payload));
}

function sendError(res, status, message) {
  sendJson(res, status, { error: message });
}

async function readBody(req) {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  if (!raw) return {};
  if (raw.length > 1024 * 1024) throw new Error("Request body is too large.");
  return JSON.parse(raw);
}

function getClientId(req) {
  const id = req.headers["x-client-id"];
  return typeof id === "string" && /^[a-zA-Z0-9_-]{12,80}$/.test(id) ? id : null;
}

function parseCookies(req) {
  return Object.fromEntries(
    String(req.headers.cookie || "")
      .split(";")
      .map((item) => item.trim().split("="))
      .filter(([key, value]) => key && value)
      .map(([key, value]) => [key, decodeURIComponent(value)]),
  );
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function hashPassword(password, salt = randomBytes(16).toString("hex")) {
  const hash = pbkdf2Sync(String(password), salt, 210000, 32, "sha256").toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = String(stored || "").split(":");
  if (!salt || !hash) return false;
  const attempt = hashPassword(password, salt).split(":")[1];
  return timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(attempt, "hex"));
}

function publicAccount(account) {
  if (!account) return null;
  return { id: account.id, email: account.email, createdAt: account.createdAt };
}

function sessionCookie(token, expiresAt) {
  const secure = APP_ORIGIN.startsWith("https://") ? "; Secure" : "";
  return `introspectrophy_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Expires=${new Date(expiresAt).toUTCString()}${secure}`;
}

function clearSessionCookie() {
  const secure = APP_ORIGIN.startsWith("https://") ? "; Secure" : "";
  return `introspectrophy_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

function getSessionAccount(req, db) {
  const token = parseCookies(req).introspectrophy_session;
  if (!token) return null;
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const session = db.sessions[tokenHash];
  if (!session || new Date(session.expiresAt) <= new Date()) return null;
  return db.accounts[session.accountId] || null;
}

function createSession(res, db, accountId) {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  db.sessions[tokenHash] = { accountId, createdAt: new Date().toISOString(), expiresAt };
  res.setHeader("Set-Cookie", sessionCookie(token, expiresAt));
}

function getUserKey(req, db) {
  const account = getSessionAccount(req, db);
  if (account) return { userKey: account.id, account };
  const clientId = getClientId(req);
  if (!clientId) return null;
  return { userKey: clientId, account: null };
}

function ensureUser(db, userKey) {
  if (!db.users[userKey]) {
    db.users[userKey] = {
      id: userKey,
      identity_baseline: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }
  return db.users[userKey];
}

function words(text) {
  return String(text || "").toLowerCase().match(/[a-z0-9'-]+/g) || [];
}

function countTerms(textWords, terms) {
  const joined = textWords.join(" ");
  return terms.reduce((sum, term) => sum + (term.includes(" ") ? (joined.includes(term) ? 1 : 0) : textWords.filter((word) => word === term).length), 0);
}

function pressurePointWeights(text) {
  const textWords = words(text);
  const raw = {};
  let total = 0;
  for (const [point, terms] of Object.entries(PRESSURE_POINTS)) {
    raw[point] = countTerms(textWords, terms);
    total += raw[point];
  }
  if (total === 0) {
    return {
      competence: 0.17,
      belonging: 0.17,
      autonomy: 0.17,
      recognition: 0.17,
      security: 0.16,
      purpose: 0.16,
    };
  }
  return Object.fromEntries(Object.entries(raw).map(([point, value]) => [point, Number((value / total).toFixed(3))]));
}

function classifyReflection(rawText) {
  const text = String(rawText || "").trim();
  const textWords = words(text);
  const pressure_point_weights = pressurePointWeights(text);
  const pressureLeader = Object.entries(pressure_point_weights).sort((a, b) => b[1] - a[1])[0]?.[0] || "competence";

  const scored = PATTERN_CLASSES.map((pattern) => {
    const termScore = countTerms(textWords, pattern.terms);
    const pressureBonus = pattern.pressure === pressureLeader ? 2 : 0;
    return { pattern, score: termScore + pressureBonus };
  }).sort((a, b) => b.score - a.score);

  const best = scored[0].score > 0 ? scored[0].pattern : PATTERN_CLASSES.find((pattern) => pattern.pressure === pressureLeader) || PATTERN_CLASSES[0];
  const secondScore = scored[1]?.score || 0;
  const confidence_score = Number(Math.min(0.95, Math.max(0.45, 0.52 + scored[0].score * 0.08 - secondScore * 0.02)).toFixed(2));
  const highlighted_text = highlightText(text, best.terms);

  return {
    parent_pattern_class: best.parent,
    child_pattern_class: best.child,
    primary_pattern_class: best.parent,
    pressure_point_weights,
    activation_profile: {
      primary_pressure_point: pressureLeader,
      framework: best.framework,
      perceived_threat: perceivedThreat(pressureLeader),
      signal_terms: best.terms.filter((term) => text.toLowerCase().includes(term)).slice(0, 5),
    },
    assumption_code: best.assumption,
    confidence_score,
    highlighted_text,
    suggested_intervention: best.intervention,
    micro_experiment_prompt: best.intervention,
  };
}

function perceivedThreat(point) {
  return {
    competence: "Failure, inadequacy, being wrong, or being perceived as incapable.",
    belonging: "Exclusion, isolation, rejection, or loss of group membership.",
    autonomy: "Control by others, entrapment, or loss of agency.",
    recognition: "Being overlooked, ignored, or losing status or credit.",
    security: "Instability, volatility, chaos, or psychological unsafety.",
    purpose: "Meaninglessness, misalignment, wasted effort, or lack of significance.",
  }[point];
}

function highlightText(text, terms) {
  const lower = text.toLowerCase();
  const matched = terms.find((term) => lower.includes(term));
  if (!matched) return text.slice(0, 260);
  const index = lower.indexOf(matched);
  const start = Math.max(0, index - 90);
  const end = Math.min(text.length, index + matched.length + 130);
  return text.slice(start, end);
}

function isWithinDays(date, days) {
  return new Date(date).getTime() >= Date.now() - days * 24 * 60 * 60 * 1000;
}

function upsertAssumptionProfile(db, userKey, signal) {
  let profile = db.assumption_profiles.find((item) => item.user_id === userKey && item.assumption_code === signal.assumption_code);
  if (!profile) {
    profile = {
      id: randomUUID(),
      user_id: userKey,
      assumption_code: signal.assumption_code,
      occurrence_count: 0,
      linked_pattern_ids: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    db.assumption_profiles.push(profile);
  }
  profile.occurrence_count += 1;
  profile.updated_at = new Date().toISOString();
  return profile;
}

function upsertActivePattern(db, userKey, signal) {
  const related = db.behavioral_signals.filter((item) =>
    item.user_id === userKey &&
    item.primary_pattern_class === signal.primary_pattern_class &&
    item.child_pattern_class === signal.child_pattern_class &&
    item.assumption_code === signal.assumption_code &&
    isWithinDays(item.created_at, ACTIVE_PATTERN_WINDOW_DAYS)
  );
  if (related.length < 3) return null;

  let active = db.active_patterns.find((item) =>
    item.user_id === userKey &&
    item.primary_pattern_class === signal.primary_pattern_class &&
    item.child_pattern_class === signal.child_pattern_class &&
    item.assumption_code === signal.assumption_code &&
    item.status === "active"
  );

  if (!active) {
    active = {
      id: randomUUID(),
      user_id: userKey,
      primary_pattern_class: signal.primary_pattern_class,
      child_pattern_class: signal.child_pattern_class,
      framework: signal.activation_profile.framework,
      pressure_point: signal.activation_profile.primary_pressure_point,
      assumption_code: signal.assumption_code,
      activation_count: related.length,
      status: "active",
      first_seen_at: related[0].created_at,
      last_seen_at: signal.created_at,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    db.active_patterns.push(active);
  } else {
    active.activation_count = related.length;
    active.last_seen_at = signal.created_at;
    active.updated_at = new Date().toISOString();
  }

  for (const item of related) {
    if (!db.pattern_links.some((link) => link.active_pattern_id === active.id && link.behavioral_signal_id === item.id)) {
      db.pattern_links.push({
        id: randomUUID(),
        user_id: userKey,
        active_pattern_id: active.id,
        behavioral_signal_id: item.id,
        created_at: new Date().toISOString(),
      });
    }
  }

  const profile = upsertAssumptionProfile(db, userKey, signal);
  if (!profile.linked_pattern_ids.includes(active.id)) profile.linked_pattern_ids.push(active.id);
  return active;
}

function createFutureAlert(db, userKey, activePattern, experiment) {
  let alert = db.future_alerts.find((item) => item.user_id === userKey && item.active_pattern_id === activePattern.id && item.status === "active");
  if (!alert) {
    alert = {
      id: randomUUID(),
      user_id: userKey,
      active_pattern_id: activePattern.id,
      micro_experiment_id: experiment.id,
      alert_style: "quiet_recognition_signal",
      trigger_signature: {
        primary_pattern_class: activePattern.primary_pattern_class,
        child_pattern_class: activePattern.child_pattern_class,
        assumption_code: activePattern.assumption_code,
      },
      status: "active",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    db.future_alerts.push(alert);
  } else {
    alert.micro_experiment_id = experiment.id;
    alert.updated_at = new Date().toISOString();
  }
  return alert;
}

function dashboardFor(db, userKey) {
  const logs = db.interception_logs.filter((item) => item.user_id === userKey);
  const logs30 = logs.filter((item) => isWithinDays(item.created_at, 30));
  const activePatterns = db.active_patterns.filter((item) => item.user_id === userKey && item.status === "active");
  const activeExperiments = db.micro_experiments.filter((item) => item.user_id === userKey && item.status === "active");
  const signals = db.behavioral_signals.filter((item) => item.user_id === userKey);
  const latestAssessment = latestAssessmentFor(db, userKey);

  return {
    rolling_30_day_pir: calculatePir(logs30),
    lifetime_pir: calculatePir(logs),
    pir_by_pattern: activePatterns.map((pattern) => ({
      active_pattern_id: pattern.id,
      child_pattern_class: pattern.child_pattern_class,
      pir: calculatePir(logs.filter((log) => log.active_pattern_id === pattern.id)),
    })),
    active_experiments: activeExperiments,
    active_patterns: activePatterns,
    highest_pressure_point: highestPressurePoint(signals),
    most_common_child_pattern: mostCommon(signals.map((signal) => signal.child_pattern_class)),
    total_reflections: db.reflections.filter((item) => item.user_id === userKey).length,
    total_signals: signals.length,
    total_alerts: db.future_alerts.filter((item) => item.user_id === userKey && item.status === "active").length,
    latest_assessment: latestAssessment,
  };
}

function latestAssessmentFor(db, userKey) {
  return db.assessment_results
    .filter((item) => item.user_id === userKey)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0] || null;
}

function assessmentBookReferences(type) {
  const references = {
    "Over Outward": {
      chapters: ["Chapter 3, Signs of Introspectrophy", "Chapter 4, Who Are You Without the Performance?"],
      concept: "The Performed Self",
      explanation: "External approval may be carrying more weight than internal alignment.",
      reading: "Review the sections on performance identity and over-adjustment.",
      practice: "Use the performance audit checklist and note one moment where presentation replaced accuracy.",
    },
    "Over Inward": {
      chapters: ["Chapter 3, Signs of Introspectrophy", "Chapter 5, How You See vs. What Is"],
      concept: "The Untested Self",
      explanation: "Internal interpretation may be closing too quickly before outside feedback updates the picture.",
      reading: "Review the perception sections on internal loops and untested conclusions.",
      practice: "Use the reality-check prompt: what evidence would change this story?",
    },
    "Distorted Clarity": {
      chapters: ["Chapter 3, Signs of Introspectrophy", "Chapter 5, Perception"],
      concept: "False certainty and distorted self-story",
      explanation: "High certainty can reduce the accuracy of feedback and pattern recognition.",
      reading: "Review the sections on perception, certainty, and self-story distortion.",
      practice: "Use the certainty audit checklist before making a meaning-heavy conclusion.",
    },
    "Near Fulcrum": {
      chapters: ["Chapter 10, Return to the Fulcrum", "Appendix D, The Return Protocol"],
      concept: "Return to the Fulcrum",
      explanation: "Your responses show enough balance to test assumptions without over-correcting.",
      reading: "Review the Return Protocol sequence and Fulcrum stabilization prompts.",
      practice: "Use one small alignment action, one feedback action, and one follow-up reflection.",
    },
  };
  return references[type] || references["Near Fulcrum"];
}

function returnProtocolFor(type) {
  const protocols = {
    "Over Outward": {
      detected: "Over Outward Identity Drift",
      why_it_matters: "You may be over-adjusting to external approval while losing contact with what you actually want.",
      small_experiment: "Say one honest preference this week without over-explaining it.",
      reflection_question: "Where did I trade accuracy for approval?",
      outward_feedback_action: "Ask one trusted person where they notice you performing instead of being direct.",
      reminder_suggestion: "Check back after the next high-approval interaction.",
    },
    "Over Inward": {
      detected: "Over Inward Drift",
      why_it_matters: "You may be relying on an internal story before testing it against the situation.",
      small_experiment: "Ask one clarifying question before acting on your first interpretation.",
      reflection_question: "What did I assume without verifying?",
      outward_feedback_action: "Ask one trusted person what they observed that you might have missed.",
      reminder_suggestion: "Check back after one reality-testing conversation.",
    },
    "Distorted Clarity": {
      detected: "Distorted Clarity",
      why_it_matters: "High certainty may be reducing feedback accuracy.",
      small_experiment: "Name one alternative explanation before deciding what the situation means.",
      reflection_question: "What evidence would make this conclusion less certain?",
      outward_feedback_action: "Ask someone close to the situation what they think you are over-certifying.",
      reminder_suggestion: "Check back after you receive one piece of disconfirming information.",
    },
    "Near Fulcrum": {
      detected: "Near Fulcrum",
      why_it_matters: "You appear closer to balanced perception and action, which makes small experiments more useful.",
      small_experiment: "Take one aligned action and observe the pressure response.",
      reflection_question: "What stayed steady when pressure increased?",
      outward_feedback_action: "Ask one person whether your action matched your stated intention.",
      reminder_suggestion: "Check back after completing the aligned action.",
    },
  };
  return protocols[type] || protocols["Near Fulcrum"];
}

function scoreAssessment(answers) {
  const scores = { over_outward: 0, over_inward: 0, distorted_clarity: 0, fulcrum_alignment: 0 };
  for (const answer of answers) {
    if (answer.value === "outward") scores.over_outward += 1;
    if (answer.value === "inward") scores.over_inward += 1;
    if (answer.value === "distorted") scores.distorted_clarity += 1;
    if (answer.value === "balanced") scores.fulcrum_alignment += 1;
  }
  const driftEntries = [
    ["Over Outward", scores.over_outward],
    ["Over Inward", scores.over_inward],
    ["Distorted Clarity", scores.distorted_clarity],
    ["Near Fulcrum", scores.fulcrum_alignment],
  ].sort((a, b) => b[1] - a[1]);
  const primary = driftEntries[0][0];
  const secondary = driftEntries.find(([name]) => name !== primary)?.[0] || "Near Fulcrum";
  const total = Math.max(1, answers.length);
  const fulcrumScore = Math.round((scores.fulcrum_alignment / total) * 100);
  return {
    scores: {
      ...scores,
      fulcrum_alignment_score: fulcrumScore,
      return_readiness_score: fulcrumScore,
    },
    result: {
      primary_drift_type: primary,
      secondary_drift_type: secondary,
      fulcrum_alignment_score: fulcrumScore,
      pattern_hypothesis: `${primary} may be shaping how reflection, perception, and action are currently organizing.`,
      recommended_return_protocol: returnProtocolFor(primary).detected,
      suggested_reflection_prompt: `Where did ${primary.toLowerCase()} show up most clearly this week?`,
      book_reference: assessmentBookReferences(primary),
      continue_in_book: {
        return_protocol: assessmentBookReferences("Near Fulcrum"),
      },
    },
    return_protocol: returnProtocolFor(primary),
  };
}

function analyticsFor(db, userKey) {
  const events = db.analytics_events.filter((item) => item.user_id === userKey);
  const started = countEvents(events, "tour_started");
  const completed = countEvents(events, "tour_completed");
  const reflectionViews = events.filter((item) => item.event_name === "view_changed" && item.metadata?.view === "reflection").length;
  const reflectionSubmits = countEvents(events, "reflection_submitted");
  const featureEvents = events.filter((item) => item.event_name === "view_changed");
  const featureCounts = rankedCounts(featureEvents.map((item) => item.metadata?.view).filter(Boolean));
  const dropOffLocations = rankedCounts(
    events
      .filter((item) => ["tour_skipped", "companion_disabled"].includes(item.event_name))
      .map((item) => item.metadata?.view || item.event_name),
  );

  return {
    total_events: events.length,
    tour_completion_rate: started ? Math.round((completed / started) * 100) : null,
    reflection_completion_rate: reflectionViews ? Math.round((reflectionSubmits / reflectionViews) * 100) : null,
    most_used_feature: featureCounts[0]?.label || null,
    most_used_features: featureCounts,
    drop_off_locations: dropOffLocations,
  };
}

function countEvents(events, name) {
  return events.filter((item) => item.event_name === name).length;
}

function rankedCounts(values) {
  const counts = {};
  for (const value of values.filter(Boolean)) counts[value] = (counts[value] || 0) + 1;
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({ label, count }));
}

function calculatePir(logs) {
  const intercepted = logs.filter((item) => item.response === "intercepted_consciously").length;
  const repeated = logs.filter((item) => item.response === "repeated_unconsciously").length;
  const denominator = intercepted + repeated;
  return denominator ? Math.round((intercepted / denominator) * 100) : null;
}

function highestPressurePoint(signals) {
  const totals = {};
  for (const signal of signals) {
    for (const [point, weight] of Object.entries(signal.pressure_point_weights || {})) {
      totals[point] = (totals[point] || 0) + Number(weight || 0);
    }
  }
  return Object.entries(totals).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
}

function mostCommon(values) {
  const counts = {};
  for (const value of values.filter(Boolean)) counts[value] = (counts[value] || 0) + 1;
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
}

function routeParam(pathname, pattern) {
  const match = pathname.match(pattern);
  return match?.[1] || null;
}

async function handleApi(req, res, url) {
  const db = await loadDb();
  const method = req.method || "GET";

  if (method === "GET" && url.pathname === "/api/health") {
    return sendJson(res, 200, { ok: true, app: "introspectropy-sros", origin: APP_ORIGIN, schemaVersion: db.schemaVersion });
  }

  if (method === "POST" && url.pathname === "/api/auth/register") {
    const body = await readBody(req);
    const email = normalizeEmail(body.email);
    const password = String(body.password || "");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return sendError(res, 400, "Enter a valid email address.");
    if (password.length < 8) return sendError(res, 400, "Password must be at least 8 characters.");
    if (Object.values(db.accounts).some((account) => account.email === email)) return sendError(res, 409, "An account already exists for that email.");

    const account = {
      id: `acct_${randomUUID()}`,
      email,
      passwordHash: hashPassword(password),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.accounts[account.id] = account;

    const clientId = getClientId(req);
    if (clientId && db.users[clientId] && !db.users[account.id]) {
      db.users[account.id] = { ...db.users[clientId], id: account.id, updated_at: new Date().toISOString() };
      for (const collection of ["reflections", "behavioral_signals", "active_patterns", "pattern_links", "assumption_profiles", "micro_experiments", "future_alerts", "interception_logs", "analytics_events", "assessment_results"]) {
        db[collection].forEach((item) => {
          if (item.user_id === clientId) item.user_id = account.id;
        });
      }
    }

    createSession(res, db, account.id);
    await saveDb(db);
    return sendJson(res, 201, { account: publicAccount(account) });
  }

  if (method === "POST" && url.pathname === "/api/auth/login") {
    const body = await readBody(req);
    const account = Object.values(db.accounts).find((item) => item.email === normalizeEmail(body.email));
    if (!account || !verifyPassword(body.password, account.passwordHash)) return sendError(res, 401, "Email or password is incorrect.");
    createSession(res, db, account.id);
    await saveDb(db);
    return sendJson(res, 200, { account: publicAccount(account) });
  }

  if (method === "POST" && url.pathname === "/api/auth/logout") {
    const token = parseCookies(req).introspectrophy_session;
    if (token) delete db.sessions[createHash("sha256").update(token).digest("hex")];
    res.setHeader("Set-Cookie", clearSessionCookie());
    await saveDb(db);
    return sendJson(res, 200, { ok: true });
  }

  if (method === "GET" && url.pathname === "/api/auth/session") {
    return sendJson(res, 200, { account: publicAccount(getSessionAccount(req, db)) });
  }

  const identity = getUserKey(req, db);
  if (!identity) return sendError(res, 401, "Missing account session or X-Client-Id header.");
  const { userKey, account } = identity;
  const user = ensureUser(db, userKey);

  if (method === "GET" && url.pathname === "/api/me") {
    return sendJson(res, 200, { account: publicAccount(account), profile: user });
  }

  if (method === "PUT" && url.pathname === "/api/me") {
    const body = await readBody(req);
    user.identity_baseline = {
      performed_self_context: String(body.performed_self_context || "").slice(0, 1000),
      identity_drift_watchpoint: String(body.identity_drift_watchpoint || "").slice(0, 1000),
      primary_pressure_point: String(body.primary_pressure_point || "").slice(0, 80),
      default_startup_page: ["dashboard", "reflection", "selfDiagnosis", "patterns", "laboratory", "returnProtocol", "alerts", "baseline", "analytics"].includes(String(body.default_startup_page || ""))
        ? String(body.default_startup_page)
        : user.identity_baseline?.default_startup_page || "dashboard",
    };
    user.updated_at = new Date().toISOString();
    await saveDb(db);
    return sendJson(res, 200, { profile: user });
  }

  if (method === "POST" && url.pathname === "/api/reflections") {
    const body = await readBody(req);
    const rawText = String(body.raw_text || body.text || "").trim();
    if (!rawText) return sendError(res, 400, "Reflection text is required.");

    const reflection = {
      id: randomUUID(),
      user_id: userKey,
      raw_text: rawText.slice(0, 12000),
      source: "reflection_input",
      created_at: new Date().toISOString(),
    };
    db.reflections.push(reflection);

    const classification = classifyReflection(rawText);
    let signal = null;
    let active_pattern = null;
    let matching_alerts = [];

    if (classification.confidence_score >= SIGNAL_CONFIDENCE_THRESHOLD) {
      signal = {
        id: randomUUID(),
        user_id: userKey,
        reflection_id: reflection.id,
        primary_pattern_class: classification.primary_pattern_class,
        child_pattern_class: classification.child_pattern_class,
        confidence_score: classification.confidence_score,
        pressure_point_weights: classification.pressure_point_weights,
        activation_profile: classification.activation_profile,
        assumption_code: classification.assumption_code,
        highlighted_text: classification.highlighted_text,
        suggested_intervention: classification.suggested_intervention,
        created_at: new Date().toISOString(),
      };
      db.behavioral_signals.push(signal);
      upsertAssumptionProfile(db, userKey, signal);
      active_pattern = upsertActivePattern(db, userKey, signal);
      matching_alerts = db.future_alerts.filter((alert) =>
        alert.user_id === userKey &&
        alert.status === "active" &&
        alert.trigger_signature.child_pattern_class === signal.child_pattern_class &&
        alert.trigger_signature.assumption_code === signal.assumption_code
      );
    }

    await saveDb(db);
    return sendJson(res, 201, { reflection, classification, behavioral_signal: signal, active_pattern, future_alerts: matching_alerts });
  }

  if (method === "GET" && url.pathname === "/api/patterns") {
    return sendJson(res, 200, {
      active_patterns: db.active_patterns.filter((item) => item.user_id === userKey && item.status === "active"),
      behavioral_signals: db.behavioral_signals.filter((item) => item.user_id === userKey).slice(-20).reverse(),
      assumption_profiles: db.assumption_profiles.filter((item) => item.user_id === userKey),
    });
  }

  const experimentPatternId = routeParam(url.pathname, /^\/api\/patterns\/([^/]+)\/experiment$/);
  if (method === "POST" && experimentPatternId) {
    const body = await readBody(req);
    const activePattern = db.active_patterns.find((item) => item.user_id === userKey && item.id === experimentPatternId);
    if (!activePattern) return sendError(res, 404, "Active pattern not found.");
    const experiment = {
      id: randomUUID(),
      user_id: userKey,
      active_pattern_id: activePattern.id,
      anchor_assumption: String(body.anchor_assumption || activePattern.assumption_code).slice(0, 120),
      micro_experiment: String(body.micro_experiment || "").slice(0, 2000),
      status: "active",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (!experiment.micro_experiment) return sendError(res, 400, "Micro experiment is required.");
    db.micro_experiments.push(experiment);
    const future_alert = createFutureAlert(db, userKey, activePattern, experiment);
    await saveDb(db);
    return sendJson(res, 201, { micro_experiment: experiment, future_alert });
  }

  if (method === "GET" && url.pathname === "/api/alerts") {
    return sendJson(res, 200, {
      future_alerts: db.future_alerts.filter((item) => item.user_id === userKey && item.status === "active"),
      active_patterns: db.active_patterns.filter((item) => item.user_id === userKey && item.status === "active"),
    });
  }

  if (method === "POST" && url.pathname === "/api/interceptions") {
    const body = await readBody(req);
    const response = String(body.response || "");
    if (!["intercepted_consciously", "repeated_unconsciously", "not_sure"].includes(response)) return sendError(res, 400, "Invalid interception response.");
    const log = {
      id: randomUUID(),
      user_id: userKey,
      future_alert_id: String(body.future_alert_id || ""),
      active_pattern_id: String(body.active_pattern_id || ""),
      response,
      created_at: new Date().toISOString(),
    };
    db.interception_logs.push(log);
    await saveDb(db);
    return sendJson(res, 201, { interception_log: log, dashboard: dashboardFor(db, userKey) });
  }

  if (method === "GET" && url.pathname === "/api/dashboard") {
    return sendJson(res, 200, dashboardFor(db, userKey));
  }

  if (method === "GET" && url.pathname === "/api/assessments") {
    const results = db.assessment_results.filter((item) => item.user_id === userKey).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return sendJson(res, 200, { assessment_results: results, latest_assessment: results[0] || null });
  }

  if (method === "POST" && url.pathname === "/api/assessments") {
    const body = await readBody(req);
    const answers = Array.isArray(body.answers) ? body.answers.slice(0, 60).map((answer) => ({
      domain: String(answer.domain || "").slice(0, 80),
      question: String(answer.question || "").slice(0, 240),
      value: String(answer.value || "").slice(0, 40),
    })) : [];
    if (!answers.length) return sendError(res, 400, "Assessment answers are required.");
    const scored = scoreAssessment(answers);
    const assessment = {
      id: randomUUID(),
      user_id: userKey,
      answers,
      scores: scored.scores,
      result: scored.result,
      return_protocol: scored.return_protocol,
      created_at: new Date().toISOString(),
    };
    db.assessment_results.push(assessment);
    db.analytics_events.push({
      id: randomUUID(),
      user_id: userKey,
      event_name: "assessment_completed",
      metadata: { primary_drift_type: scored.result.primary_drift_type },
      created_at: new Date().toISOString(),
    });
    await saveDb(db);
    return sendJson(res, 201, { assessment_result: assessment });
  }

  if (method === "GET" && url.pathname === "/api/return-protocol") {
    const latest = latestAssessmentFor(db, userKey);
    return sendJson(res, 200, {
      return_protocol: latest?.return_protocol || returnProtocolFor("Near Fulcrum"),
      assessment_result: latest,
    });
  }

  if (method === "POST" && url.pathname === "/api/analytics") {
    const body = await readBody(req);
    const eventName = String(body.event_name || "").trim().slice(0, 80);
    if (!/^[a-z0-9_:-]{3,80}$/.test(eventName)) return sendError(res, 400, "Analytics event name is invalid.");
    const event = {
      id: randomUUID(),
      user_id: userKey,
      event_name: eventName,
      metadata: typeof body.metadata === "object" && body.metadata && !Array.isArray(body.metadata) ? body.metadata : {},
      created_at: new Date().toISOString(),
    };
    db.analytics_events.push(event);
    await saveDb(db);
    return sendJson(res, 201, { analytics_event: event });
  }

  if (method === "GET" && url.pathname === "/api/analytics-dashboard") {
    return sendJson(res, 200, analyticsFor(db, userKey));
  }

  if (method === "GET" && url.pathname === "/api/export") {
    return sendJson(res, 200, {
      account: publicAccount(account),
      profile: user,
      reflections: db.reflections.filter((item) => item.user_id === userKey),
      behavioral_signals: db.behavioral_signals.filter((item) => item.user_id === userKey),
      active_patterns: db.active_patterns.filter((item) => item.user_id === userKey),
      pattern_links: db.pattern_links.filter((item) => item.user_id === userKey),
      assumption_profiles: db.assumption_profiles.filter((item) => item.user_id === userKey),
      micro_experiments: db.micro_experiments.filter((item) => item.user_id === userKey),
      future_alerts: db.future_alerts.filter((item) => item.user_id === userKey),
      interception_logs: db.interception_logs.filter((item) => item.user_id === userKey),
      analytics_events: db.analytics_events.filter((item) => item.user_id === userKey),
      assessment_results: db.assessment_results.filter((item) => item.user_id === userKey),
      exported_at: new Date().toISOString(),
    });
  }

  if (method === "DELETE" && url.pathname === "/api/me") {
    delete db.users[userKey];
    if (account) delete db.accounts[account.id];
    for (const collection of ["reflections", "behavioral_signals", "active_patterns", "pattern_links", "assumption_profiles", "micro_experiments", "future_alerts", "interception_logs", "analytics_events", "assessment_results"]) {
      db[collection] = db[collection].filter((item) => item.user_id !== userKey);
    }
    for (const [tokenHash, session] of Object.entries(db.sessions)) {
      if (session.accountId === userKey) delete db.sessions[tokenHash];
    }
    res.setHeader("Set-Cookie", clearSessionCookie());
    await saveDb(db);
    return sendJson(res, 200, { ok: true });
  }

  sendError(res, 404, "API route not found.");
}

async function serveStatic(req, res, url) {
  const requested = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const normalized = normalize(requested).replace(/^(\.\.[/\\])+/, "");
  const filePath = resolve(join(PUBLIC_DIR, normalized));

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  try {
    const info = await stat(filePath);
    if (!info.isFile()) throw new Error("Not a file");
    res.writeHead(200, {
      "content-type": MIME[extname(filePath)] || "application/octet-stream",
      "cache-control": "no-store",
    });
    createReadStream(filePath).pipe(res);
  } catch {
    createReadStream(join(PUBLIC_DIR, "index.html")).pipe(res);
  }
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", APP_ORIGIN);
    if (url.pathname.startsWith("/api/")) return await handleApi(req, res, url);
    return await serveStatic(req, res, url);
  } catch (error) {
    const message = error instanceof SyntaxError ? "Invalid JSON body." : error.message || "Server error.";
    sendError(res, 500, message);
  }
});

server.listen(PORT, () => {
  console.log(`Introspectropy SR-OS is running at ${APP_ORIGIN}`);
});

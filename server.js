import { createServer } from "node:http";
import { mkdir, readFile, writeFile, stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { createHash, pbkdf2Sync, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";

const PORT = Number(process.env.PORT || 3000);
const ROOT = process.cwd();
const PUBLIC_DIR = resolve(ROOT, "public");
const DATA_FILE = resolve(ROOT, process.env.DATA_FILE || "data/db.json");
const APP_ORIGIN = process.env.APP_ORIGIN || `http://localhost:${PORT}`;
const SESSION_DAYS = 30;

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

const QUESTIONS = [
  { id: "identity-1", axis: "identity", text: "I can name what I want before I check what others expect.", inward: 6, outward: -2 },
  { id: "identity-2", axis: "identity", text: "I change my presentation to preserve approval.", inward: -2, outward: 7 },
  { id: "identity-3", axis: "identity", text: "I know which parts of me are real and which parts are performance.", inward: 7, outward: -1 },
  { id: "identity-4", axis: "identity", text: "When I am alone, I feel unclear about who I am.", inward: -6, outward: 3 },
  { id: "identity-5", axis: "identity", text: "I can disappoint someone without losing myself.", inward: 8, outward: -4 },
  { id: "perception-1", axis: "perception", text: "I notice when my interpretation is not the same thing as the facts.", inward: 6, outward: 2 },
  { id: "perception-2", axis: "perception", text: "I often read rejection into neutral behavior.", inward: -5, outward: 5 },
  { id: "perception-3", axis: "perception", text: "I can stay with uncertainty without filling it with a story.", inward: 7, outward: -1 },
  { id: "perception-4", axis: "perception", text: "I trust external signals more than my direct experience.", inward: -3, outward: 7 },
  { id: "perception-5", axis: "perception", text: "I can revise my view when new evidence appears.", inward: 5, outward: 4 },
  { id: "behavior-1", axis: "behavior", text: "My actions usually match what I privately know is true.", inward: 7, outward: 0 },
  { id: "behavior-2", axis: "behavior", text: "I delay decisions by endlessly analyzing myself.", inward: 5, outward: -6 },
  { id: "behavior-3", axis: "behavior", text: "I overcommit so nobody has to feel let down.", inward: -4, outward: 8 },
  { id: "behavior-4", axis: "behavior", text: "I can interrupt a familiar pattern while it is happening.", inward: 8, outward: 1 },
  { id: "behavior-5", axis: "behavior", text: "I use productivity to avoid feeling what is underneath.", inward: -5, outward: 6 },
  { id: "direction-1", axis: "direction", text: "I know what deserves my attention this season.", inward: 6, outward: 3 },
  { id: "direction-2", axis: "direction", text: "I chase visible progress even when it points away from my life.", inward: -3, outward: 8 },
  { id: "direction-3", axis: "direction", text: "I can act before the whole path is emotionally certain.", inward: 7, outward: 2 },
  { id: "direction-4", axis: "direction", text: "My next step is often shaped by comparison.", inward: -2, outward: 7 },
  { id: "direction-5", axis: "direction", text: "I return to center quickly after being pulled off course.", inward: 8, outward: -1 },
];

const DEFAULT_PROTOCOLS = [
  {
    id: "return-to-center",
    title: "Return to Center",
    duration: "7 minutes",
    focus: "Reset after an approval spiral",
    steps: [
      "Write the exact external signal that pulled you away from center.",
      "Name the story you added to it.",
      "Separate one fact, one fear, and one next honest action.",
    ],
  },
  {
    id: "identity-audit",
    title: "Identity Audit",
    duration: "12 minutes",
    focus: "Distinguish self from performance",
    steps: [
      "List the roles you are currently performing.",
      "Circle the role that feels most expensive.",
      "Write what would remain true if nobody rewarded that role.",
    ],
  },
  {
    id: "decision-fulcrum",
    title: "Decision Fulcrum",
    duration: "10 minutes",
    focus: "Move without overcorrecting inward or outward",
    steps: [
      "Write the decision in one sentence.",
      "Score your inward evidence and outward evidence separately.",
      "Choose the smallest reversible action that respects both.",
    ],
  },
];

const LIBRARY = [
  {
    id: "fulcrum-basics",
    title: "The Fulcrum Model",
    category: "Orientation",
    minutes: 4,
    summary: "Inward and outward awareness are both useful. Clarity drops when either one becomes the whole instrument.",
  },
  {
    id: "approval-gravity",
    title: "Approval Gravity",
    category: "Distortion",
    minutes: 6,
    summary: "Approval becomes distorting when external response starts deciding what your private experience is allowed to mean.",
  },
  {
    id: "analysis-shelter",
    title: "Analysis Shelter",
    category: "Distortion",
    minutes: 5,
    summary: "Reflection turns into shelter when it keeps you from making contact with a small, honest action.",
  },
  {
    id: "return-protocols",
    title: "Return Protocols",
    category: "Practice",
    minutes: 7,
    summary: "A return protocol is not a performance improvement trick. It is a short path back to usable perception.",
  },
];

let writeQueue = Promise.resolve();

async function loadDb() {
  await mkdir(resolve(DATA_FILE, ".."), { recursive: true });
  try {
    return JSON.parse(await readFile(DATA_FILE, "utf8"));
  } catch {
    const initial = {
      users: {},
      accounts: {},
      sessions: {},
      readings: [],
      journals: [],
      protocolCompletions: [],
      libraryState: [],
      createdAt: new Date().toISOString(),
    };
    await saveDb(initial);
    return initial;
  }
}

async function saveDb(db) {
  writeQueue = writeQueue.then(() => writeFile(DATA_FILE, JSON.stringify(db, null, 2)));
  return writeQueue;
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
  const header = req.headers.cookie || "";
  return Object.fromEntries(
    header
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
  return {
    id: account.id,
    email: account.email,
    createdAt: account.createdAt,
  };
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
  const session = db.sessions?.[tokenHash];
  if (!session || new Date(session.expiresAt) <= new Date()) return null;
  return db.accounts?.[session.accountId] || null;
}

function createSession(res, db, accountId) {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  db.sessions[tokenHash] = { accountId, createdAt: new Date().toISOString(), expiresAt };
  res.setHeader("Set-Cookie", sessionCookie(token, expiresAt));
}

function clamp(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.max(min, Math.min(max, number));
}

function scoreReading(answers) {
  let inward = 0;
  let outward = 0;
  const axes = {};

  for (const question of QUESTIONS) {
    const raw = clamp(answers[question.id], 1, 5);
    const centered = raw - 3;
    inward += 50 + centered * question.inward;
    outward += 50 + centered * question.outward;

    axes[question.axis] ||= { inward: 0, outward: 0, count: 0 };
    axes[question.axis].inward += 50 + centered * question.inward;
    axes[question.axis].outward += 50 + centered * question.outward;
    axes[question.axis].count += 1;
  }

  const count = QUESTIONS.length;
  const inwardScore = Math.round(clamp(inward / count, 0, 100));
  const outwardScore = Math.round(clamp(outward / count, 0, 100));
  const tilt = outwardScore - inwardScore;
  const magnitude = Math.abs(tilt);
  const direction = magnitude < 8 ? "centered" : tilt > 0 ? "outward" : "inward";

  const axisScores = Object.fromEntries(
    Object.entries(axes).map(([axis, value]) => [
      axis,
      {
        inward: Math.round(clamp(value.inward / value.count, 0, 100)),
        outward: Math.round(clamp(value.outward / value.count, 0, 100)),
      },
    ]),
  );

  return {
    inwardScore,
    outwardScore,
    tilt,
    direction,
    magnitude,
    axisScores,
    distortions: detectDistortions(answers, direction),
    protocol: recommendProtocol(direction, magnitude),
  };
}

function detectDistortions(answers, direction) {
  const high = (id) => clamp(answers[id], 1, 5) >= 4;
  const low = (id) => clamp(answers[id], 1, 5) <= 2;
  const distortions = [];

  if (high("identity-2") || high("behavior-3")) {
    distortions.push({
      name: "Approval Gravity",
      detail: "External response is carrying more weight than internal consent.",
    });
  }
  if (high("behavior-2") || low("direction-3")) {
    distortions.push({
      name: "Analysis Shelter",
      detail: "Self-observation is being used to delay contact with action.",
    });
  }
  if (high("perception-2") || high("perception-4")) {
    distortions.push({
      name: "Signal Inflation",
      detail: "Neutral cues are being converted into conclusions faster than evidence supports.",
    });
  }
  if (high("direction-2") || high("direction-4")) {
    distortions.push({
      name: "Borrowed Direction",
      detail: "Comparison is acting like a compass, which makes movement feel urgent but less owned.",
    });
  }
  if (!distortions.length && direction === "centered") {
    distortions.push({
      name: "Stable Fulcrum",
      detail: "No dominant distortion surfaced. The work is maintenance, not correction.",
    });
  }

  return distortions.slice(0, 3);
}

function recommendProtocol(direction, magnitude) {
  if (direction === "outward") return DEFAULT_PROTOCOLS[0];
  if (direction === "inward" && magnitude > 14) return DEFAULT_PROTOCOLS[2];
  return DEFAULT_PROTOCOLS[1];
}

function getUserKey(req, db) {
  const account = getSessionAccount(req, db);
  if (account) return { userKey: account.id, account };
  const clientId = getClientId(req);
  if (!clientId) return null;
  return { userKey: clientId, account: null };
}

async function handleApi(req, res, url) {
  const db = await loadDb();
  const method = req.method || "GET";

  if (method === "GET" && url.pathname === "/api/health") {
    return sendJson(res, 200, { ok: true, app: "introspectrophy", origin: APP_ORIGIN });
  }

  if (method === "GET" && url.pathname === "/api/questions") {
    return sendJson(res, 200, { questions: QUESTIONS });
  }

  if (method === "GET" && url.pathname === "/api/protocols") {
    return sendJson(res, 200, { protocols: DEFAULT_PROTOCOLS });
  }

  if (method === "GET" && url.pathname === "/api/library") {
    return sendJson(res, 200, { items: LIBRARY });
  }

  db.accounts ||= {};
  db.sessions ||= {};
  db.libraryState ||= [];

  if (method === "POST" && url.pathname === "/api/auth/register") {
    const body = await readBody(req);
    const email = normalizeEmail(body.email);
    const password = String(body.password || "");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return sendError(res, 400, "Enter a valid email address.");
    if (password.length < 8) return sendError(res, 400, "Password must be at least 8 characters.");
    if (Object.values(db.accounts).some((account) => account.email === email)) {
      return sendError(res, 409, "An account already exists for that email.");
    }
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
      db.users[account.id] = { ...db.users[clientId], id: account.id, updatedAt: new Date().toISOString() };
      db.readings.forEach((item) => {
        if (item.clientId === clientId) item.clientId = account.id;
      });
      db.journals.forEach((item) => {
        if (item.clientId === clientId) item.clientId = account.id;
      });
      db.protocolCompletions.forEach((item) => {
        if (item.clientId === clientId) item.clientId = account.id;
      });
    }

    createSession(res, db, account.id);
    await saveDb(db);
    return sendJson(res, 201, { account: publicAccount(account) });
  }

  if (method === "POST" && url.pathname === "/api/auth/login") {
    const body = await readBody(req);
    const email = normalizeEmail(body.email);
    const account = Object.values(db.accounts).find((item) => item.email === email);
    if (!account || !verifyPassword(body.password, account.passwordHash)) {
      return sendError(res, 401, "Email or password is incorrect.");
    }
    createSession(res, db, account.id);
    await saveDb(db);
    return sendJson(res, 200, { account: publicAccount(account) });
  }

  if (method === "POST" && url.pathname === "/api/auth/logout") {
    const token = parseCookies(req).introspectrophy_session;
    if (token) {
      const tokenHash = createHash("sha256").update(token).digest("hex");
      delete db.sessions[tokenHash];
    }
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

  if (!db.users[userKey]) {
    db.users[userKey] = {
      id: userKey,
      name: "",
      ageRange: "",
      intentions: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  if (method === "GET" && url.pathname === "/api/me") {
    return sendJson(res, 200, {
      account: publicAccount(account),
      profile: db.users[userKey],
      readings: db.readings.filter((r) => r.clientId === userKey).slice(-10).reverse(),
      journals: db.journals.filter((j) => j.clientId === userKey).slice(-20).reverse(),
    });
  }

  if (method === "PUT" && url.pathname === "/api/me") {
    const body = await readBody(req);
    db.users[userKey] = {
      ...db.users[userKey],
      name: String(body.name || "").slice(0, 80),
      ageRange: String(body.ageRange || "").slice(0, 40),
      intentions: Array.isArray(body.intentions) ? body.intentions.map(String).slice(0, 8) : [],
      updatedAt: new Date().toISOString(),
    };
    await saveDb(db);
    return sendJson(res, 200, { profile: db.users[userKey] });
  }

  if (method === "POST" && url.pathname === "/api/readings") {
    const body = await readBody(req);
    const answers = body.answers && typeof body.answers === "object" ? body.answers : {};
    const missing = QUESTIONS.filter((q) => !answers[q.id]).map((q) => q.id);
    if (missing.length) return sendError(res, 400, `Missing answers: ${missing.join(", ")}`);

    const reading = {
      id: randomUUID(),
      clientId: userKey,
      answers,
      notes: String(body.notes || "").slice(0, 2000),
      createdAt: new Date().toISOString(),
      ...scoreReading(answers),
    };
    db.readings.push(reading);
    await saveDb(db);
    return sendJson(res, 201, { reading });
  }

  if (method === "GET" && url.pathname === "/api/readings") {
    return sendJson(res, 200, {
      readings: db.readings.filter((r) => r.clientId === userKey).reverse(),
    });
  }

  if (method === "POST" && url.pathname === "/api/journals") {
    const body = await readBody(req);
    const entry = {
      id: randomUUID(),
      clientId: userKey,
      prompt: String(body.prompt || "Open reflection").slice(0, 200),
      body: String(body.body || "").slice(0, 5000),
      createdAt: new Date().toISOString(),
    };
    if (!entry.body.trim()) return sendError(res, 400, "Journal entry cannot be empty.");
    db.journals.push(entry);
    await saveDb(db);
    return sendJson(res, 201, { entry });
  }

  if (method === "POST" && url.pathname === "/api/protocol-completions") {
    const body = await readBody(req);
    const completion = {
      id: randomUUID(),
      clientId: userKey,
      protocolId: String(body.protocolId || ""),
      note: String(body.note || "").slice(0, 2000),
      createdAt: new Date().toISOString(),
    };
    db.protocolCompletions.push(completion);
    await saveDb(db);
    return sendJson(res, 201, { completion });
  }

  if (method === "GET" && url.pathname === "/api/dashboard") {
    const readings = db.readings.filter((r) => r.clientId === userKey);
    const journals = db.journals.filter((j) => j.clientId === userKey);
    const latest = readings.at(-1) || null;
    const averageTilt = readings.length
      ? Math.round(readings.reduce((sum, r) => sum + r.tilt, 0) / readings.length)
      : 0;
    return sendJson(res, 200, {
      latest,
      totalReadings: readings.length,
      totalJournals: journals.length,
      protocolsCompleted: db.protocolCompletions.filter((p) => p.clientId === userKey).length,
      averageTilt,
      trend: readings.slice(-8).map((r) => ({
        id: r.id,
        createdAt: r.createdAt,
        inwardScore: r.inwardScore,
        outwardScore: r.outwardScore,
        tilt: r.tilt,
      })),
    });
  }

  if (method === "GET" && url.pathname === "/api/export") {
    return sendJson(res, 200, {
      account: publicAccount(account),
      profile: db.users[userKey],
      readings: db.readings.filter((r) => r.clientId === userKey),
      journals: db.journals.filter((j) => j.clientId === userKey),
      protocolCompletions: db.protocolCompletions.filter((p) => p.clientId === userKey),
      libraryState: db.libraryState.filter((item) => item.clientId === userKey),
      exportedAt: new Date().toISOString(),
    });
  }

  if (method === "POST" && url.pathname === "/api/library-state") {
    const body = await readBody(req);
    const itemId = String(body.itemId || "");
    const existing = db.libraryState.find((item) => item.clientId === userKey && item.itemId === itemId);
    if (existing) {
      existing.status = String(body.status || "saved").slice(0, 20);
      existing.updatedAt = new Date().toISOString();
    } else {
      db.libraryState.push({
        id: randomUUID(),
        clientId: userKey,
        itemId,
        status: String(body.status || "saved").slice(0, 20),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    await saveDb(db);
    return sendJson(res, 200, { ok: true });
  }

  if (method === "DELETE" && url.pathname === "/api/me") {
    delete db.users[userKey];
    if (account) delete db.accounts[account.id];
    db.readings = db.readings.filter((r) => r.clientId !== userKey);
    db.journals = db.journals.filter((j) => j.clientId !== userKey);
    db.protocolCompletions = db.protocolCompletions.filter((p) => p.clientId !== userKey);
    db.libraryState = db.libraryState.filter((item) => item.clientId !== userKey);
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
    if (url.pathname.startsWith("/api/")) {
      return await handleApi(req, res, url);
    }
    return await serveStatic(req, res, url);
  } catch (error) {
    const message = error instanceof SyntaxError ? "Invalid JSON body." : error.message || "Server error.";
    sendError(res, 500, message);
  }
});

server.listen(PORT, () => {
  console.log(`Introspectrophy is running at ${APP_ORIGIN}`);
});

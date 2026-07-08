import { spawn } from "node:child_process";
import { setTimeout as wait } from "node:timers/promises";

const port = 3333;
const clientId = `smoke_${Date.now()}`;
const env = {
  ...process.env,
  PORT: String(port),
  APP_ORIGIN: `http://127.0.0.1:${port}`,
  ...(process.env.DATABASE_URL ? {} : { DATA_FILE: "./data/smoke-test-db.json" }),
};

const server = spawn(process.execPath, ["server.js"], { env, stdio: ["ignore", "pipe", "pipe"] });

let stderr = "";
server.stderr.on("data", (chunk) => {
  stderr += chunk;
});

async function request(path, options = {}) {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      "x-client-id": clientId,
      ...(options.headers || {}),
    },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`${path}: ${data.error || response.statusText}`);
  return data;
}

try {
  let healthy = false;
  for (let i = 0; i < 20; i += 1) {
    await wait(150);
    try {
      const health = await request("/api/health");
      healthy = health.ok;
      break;
    } catch {
      // Retry until the child server has bound the port.
    }
  }
  if (!healthy) throw new Error(`Server did not become healthy. ${stderr}`);

  await request("/api/analytics", { method: "POST", body: JSON.stringify({ event_name: "view_changed", metadata: { view: "reflection" } }) });
  const assessmentAnswers = Array.from({ length: 35 }, (_, index) => ({
    domain: "Smoke",
    question: `Question ${index + 1}`,
    value: index % 4 === 0 ? "balanced" : "outward",
  }));
  const assessment = await request("/api/assessments", { method: "POST", body: JSON.stringify({ answers: assessmentAnswers }) });
  if (!assessment.assessment_result?.result?.primary_drift_type) throw new Error("Expected assessment primary drift type.");
  const protocol = await request("/api/return-protocol");
  if (!protocol.return_protocol?.detected) throw new Error("Expected return protocol.");
  const sample = "I keep saying yes because I do not want the group to reject me, then I postpone the boundary and feel misaligned.";
  await request("/api/reflections", { method: "POST", body: JSON.stringify({ raw_text: sample }) });
  await request("/api/reflections", { method: "POST", body: JSON.stringify({ raw_text: sample }) });
  const third = await request("/api/reflections", { method: "POST", body: JSON.stringify({ raw_text: sample }) });
  if (!third.behavioral_signal) throw new Error("Expected behavioral_signal after ICE classification.");
  if (!third.active_pattern) throw new Error("Expected active_pattern after three related signals.");

  const experiment = await request(`/api/patterns/${third.active_pattern.id}/experiment`, {
    method: "POST",
    body: JSON.stringify({
      anchor_assumption: third.active_pattern.assumption_code,
      micro_experiment: "Pause before one automatic yes and state one accurate constraint.",
    }),
  });
  if (!experiment.future_alert) throw new Error("Expected future_alert after micro experiment.");

  await request("/api/interceptions", {
    method: "POST",
    body: JSON.stringify({
      future_alert_id: experiment.future_alert.id,
      active_pattern_id: third.active_pattern.id,
      response: "intercepted_consciously",
    }),
  });
  const dashboard = await request("/api/dashboard");
  if (dashboard.lifetime_pir !== 100) throw new Error(`Expected lifetime PIR 100, got ${dashboard.lifetime_pir}`);
  const analytics = await request("/api/analytics-dashboard");
  if (analytics.total_events < 1) throw new Error("Expected analytics dashboard to include captured events.");
  await request("/api/me", { method: "DELETE" });

  console.log(`Smoke test passed using ${process.env.DATABASE_URL ? "PostgreSQL" : "local JSON"} storage.`);
} finally {
  server.kill();
}

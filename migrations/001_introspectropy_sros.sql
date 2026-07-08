CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  email text UNIQUE,
  password_hash text,
  identity_baseline jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_sessions (
  token_hash text PRIMARY KEY,
  account_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS reflections (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  raw_text text NOT NULL,
  source text NOT NULL DEFAULT 'reflection_input',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS behavioral_signals (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reflection_id text NOT NULL REFERENCES reflections(id) ON DELETE CASCADE,
  primary_pattern_class text NOT NULL,
  child_pattern_class text NOT NULL,
  confidence_score numeric(4,3) NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
  pressure_point_weights jsonb NOT NULL DEFAULT '{}'::jsonb,
  activation_profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  assumption_code text NOT NULL,
  highlighted_text text,
  suggested_intervention text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS active_patterns (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  primary_pattern_class text NOT NULL,
  child_pattern_class text NOT NULL,
  framework text NOT NULL,
  pressure_point text NOT NULL,
  assumption_code text NOT NULL,
  activation_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  first_seen_at timestamptz,
  last_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pattern_links (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  active_pattern_id text NOT NULL REFERENCES active_patterns(id) ON DELETE CASCADE,
  behavioral_signal_id text NOT NULL REFERENCES behavioral_signals(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(active_pattern_id, behavioral_signal_id)
);

CREATE TABLE IF NOT EXISTS assumption_profiles (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assumption_code text NOT NULL,
  occurrence_count integer NOT NULL DEFAULT 0,
  linked_pattern_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, assumption_code)
);

CREATE TABLE IF NOT EXISTS micro_experiments (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  active_pattern_id text NOT NULL REFERENCES active_patterns(id) ON DELETE CASCADE,
  anchor_assumption text NOT NULL,
  micro_experiment text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS future_alerts (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  active_pattern_id text NOT NULL REFERENCES active_patterns(id) ON DELETE CASCADE,
  micro_experiment_id text REFERENCES micro_experiments(id) ON DELETE SET NULL,
  alert_style text NOT NULL DEFAULT 'quiet_recognition_signal',
  trigger_signature jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS interception_logs (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  future_alert_id text REFERENCES future_alerts(id) ON DELETE SET NULL,
  active_pattern_id text REFERENCES active_patterns(id) ON DELETE SET NULL,
  response text NOT NULL CHECK (response IN ('intercepted_consciously', 'repeated_unconsciously', 'not_sure')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS analytics_events (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_name text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS assessment_results (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  answers jsonb NOT NULL DEFAULT '[]'::jsonb,
  scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  return_protocol jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_account ON user_sessions(account_id);
CREATE INDEX IF NOT EXISTS idx_reflections_user_created ON reflections(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_behavioral_signals_user_created ON behavioral_signals(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_behavioral_signals_pattern ON behavioral_signals(user_id, primary_pattern_class, child_pattern_class, assumption_code, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_active_patterns_user_status ON active_patterns(user_id, status);
CREATE INDEX IF NOT EXISTS idx_future_alerts_user_status ON future_alerts(user_id, status);
CREATE INDEX IF NOT EXISTS idx_interception_logs_user_created ON interception_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_created ON analytics_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_name ON analytics_events(user_id, event_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_assessment_results_user_created ON assessment_results(user_id, created_at DESC);

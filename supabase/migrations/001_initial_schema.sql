-- ========================================
-- Migration 001: Initial Schema
-- ========================================

-- טנאנט / סוכנות
CREATE TABLE agencies (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  logo_url    TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- סוכנים
CREATE TABLE agents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id   UUID REFERENCES agencies NOT NULL,
  name        TEXT NOT NULL,
  email       TEXT UNIQUE NOT NULL,
  role        TEXT CHECK (role IN ('admin','agent')) DEFAULT 'agent',
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- לקוחות
CREATE TABLE clients (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id   UUID REFERENCES agencies NOT NULL,
  name        TEXT NOT NULL,
  phone       TEXT,
  id_number   TEXT,
  email       TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- פגישות
CREATE TABLE meetings (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id       UUID REFERENCES agents NOT NULL,
  client_id      UUID REFERENCES clients NOT NULL,
  meeting_date   TIMESTAMPTZ NOT NULL,
  recording_url  TEXT,
  transcript     TEXT,
  mode           TEXT CHECK (mode IN ('live','memo')) NOT NULL,
  status         TEXT CHECK (status IN (
                   'recording','uploading','transcribing',
                   'summarizing','ready','error'
                 )) DEFAULT 'recording',
  created_at     TIMESTAMPTZ DEFAULT now()
);

-- סיכומים
CREATE TABLE summaries (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id        UUID REFERENCES meetings NOT NULL,
  content           JSONB NOT NULL,
  pdf_url           TEXT,
  edited_by_agent   BOOLEAN DEFAULT FALSE,
  created_at        TIMESTAMPTZ DEFAULT now()
);

-- Audit log
CREATE TABLE audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id    UUID REFERENCES agents,
  action      TEXT NOT NULL,
  resource    TEXT NOT NULL,
  resource_id UUID,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ========================================
-- RLS Policies
-- ========================================

ALTER TABLE agencies  ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents    ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients   ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Helper function: מחזיר את ה-agency_id של המשתמש המחובר
CREATE OR REPLACE FUNCTION get_my_agency_id()
RETURNS UUID AS $$
  SELECT agency_id FROM agents WHERE email = auth.jwt()->>'email' LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- Agencies: סוכן רואה רק את הסוכנות שלו
CREATE POLICY "agents see own agency"
  ON agencies FOR SELECT
  USING (id = get_my_agency_id());

-- Agents: רואה רק סוכנים באותה סוכנות
CREATE POLICY "agents see own agency agents"
  ON agents FOR SELECT
  USING (agency_id = get_my_agency_id());

-- Clients: רק לקוחות של הסוכנות
CREATE POLICY "agents see own agency clients"
  ON clients FOR ALL
  USING (agency_id = get_my_agency_id());

-- Meetings: רק פגישות של הסוכנות
CREATE POLICY "agents see own agency meetings"
  ON meetings FOR ALL
  USING (
    agent_id IN (
      SELECT id FROM agents WHERE agency_id = get_my_agency_id()
    )
  );

-- Summaries: רק דרך פגישות של הסוכנות
CREATE POLICY "agents see own agency summaries"
  ON summaries FOR ALL
  USING (
    meeting_id IN (
      SELECT m.id FROM meetings m
      JOIN agents a ON a.id = m.agent_id
      WHERE a.agency_id = get_my_agency_id()
    )
  );

-- Audit log: רק רשומות של הסוכנות
CREATE POLICY "agents see own audit log"
  ON audit_log FOR ALL
  USING (
    agent_id IN (
      SELECT id FROM agents WHERE agency_id = get_my_agency_id()
    )
  );

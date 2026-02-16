-- ============================================================
-- Migration: Comercial Module v2
-- Description: CRM/Sales Pipeline management for B2B waste management
-- Date: 2026-02-15
-- ============================================================

-- ============================================
-- PHASE 1: Enums
-- ============================================

-- Lead source enum
DO $$ BEGIN
  CREATE TYPE lead_source AS ENUM (
    'referido', 'web', 'llamada_fria', 'evento', 'linkedin', 'email_marketing', 'otro'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Prospect stage enum
DO $$ BEGIN
  CREATE TYPE prospect_stage AS ENUM (
    'lead', 'contactado', 'calificado', 'propuesta', 'negociacion', 'cerrado_ganado', 'cerrado_perdido'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Priority enum (reusable)
DO $$ BEGIN
  CREATE TYPE priority AS ENUM (
    'baja', 'media', 'alta', 'urgente'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Activity type enum
DO $$ BEGIN
  CREATE TYPE activity_type AS ENUM (
    'llamada', 'email', 'reunion', 'nota', 'cambio_etapa', 'documento', 'propuesta', 'otro'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Meeting status enum
DO $$ BEGIN
  CREATE TYPE meeting_status AS ENUM (
    'programada', 'completada', 'cancelada', 'reprogramada'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Proposal status enum
DO $$ BEGIN
  CREATE TYPE proposal_status AS ENUM (
    'borrador', 'enviada', 'revisada', 'aceptada', 'rechazada'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Alert status enum
DO $$ BEGIN
  CREATE TYPE alert_status AS ENUM (
    'pending', 'acknowledged', 'dismissed', 'auto_resolved'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Alert type enum
DO $$ BEGIN
  CREATE TYPE alert_type AS ENUM (
    'overdue_follow_up', 'stale_prospect', 'high_value_at_risk', 'scheduled_reminder'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Reminder frequency enum
DO $$ BEGIN
  CREATE TYPE reminder_frequency AS ENUM (
    'once', 'daily', 'weekly', 'monthly'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- PHASE 2: Main Tables
-- ============================================

-- Prospects table
CREATE TABLE IF NOT EXISTS prospects (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL,

  -- Contact information
  contact_name TEXT NOT NULL,
  contact_email TEXT,
  contact_phone TEXT,
  contact_position TEXT,

  -- Company information
  company_name TEXT NOT NULL,
  industry TEXT,
  employee_count TEXT,
  website TEXT,
  address TEXT,
  city TEXT,
  state TEXT,

  -- Stage and tracking
  stage prospect_stage NOT NULL DEFAULT 'lead',
  priority priority DEFAULT 'media',
  source lead_source,

  -- Value and opportunity
  estimated_value NUMERIC(14, 2),
  estimated_close_date TIMESTAMP,
  probability INTEGER DEFAULT 50,

  -- Waste management specific
  waste_types TEXT[],
  services_interested TEXT[],
  estimated_volume TEXT,

  -- Competition
  competitors TEXT[],
  current_provider TEXT,

  -- Proposals
  proposal_sent_at TIMESTAMP,
  current_proposal_id INTEGER,

  -- Closed result
  closed_reason TEXT,
  lost_to_competitor TEXT,

  -- Assignment
  assigned_to_id INTEGER REFERENCES users(id),

  -- Follow-up dates
  last_contact_at TIMESTAMP,
  next_follow_up_at TIMESTAMP,

  -- Metadata
  notes TEXT,
  tags TEXT[],
  created_by_id INTEGER REFERENCES users(id) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Activities table (Timeline)
CREATE TABLE IF NOT EXISTS prospect_activities (
  id SERIAL PRIMARY KEY,
  prospect_id INTEGER REFERENCES prospects(id) ON DELETE CASCADE NOT NULL,
  type activity_type NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  metadata JSONB,
  created_by_id INTEGER REFERENCES users(id) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Notes table
CREATE TABLE IF NOT EXISTS prospect_notes (
  id SERIAL PRIMARY KEY,
  prospect_id INTEGER REFERENCES prospects(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  is_pinned BOOLEAN DEFAULT FALSE,
  created_by_id INTEGER REFERENCES users(id) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Meetings table
CREATE TABLE IF NOT EXISTS prospect_meetings (
  id SERIAL PRIMARY KEY,
  prospect_id INTEGER REFERENCES prospects(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  scheduled_at TIMESTAMP NOT NULL,
  duration INTEGER DEFAULT 60,
  location TEXT,
  meeting_url TEXT,
  status meeting_status DEFAULT 'programada',
  attendees JSONB,
  outcome TEXT,
  completed_at TIMESTAMP,
  created_by_id INTEGER REFERENCES users(id) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Documents table
CREATE TABLE IF NOT EXISTS prospect_documents (
  id SERIAL PRIMARY KEY,
  prospect_id INTEGER REFERENCES prospects(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  url TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  description TEXT,
  uploaded_by_id INTEGER REFERENCES users(id) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Proposal versions table
CREATE TABLE IF NOT EXISTS proposal_versions (
  id SERIAL PRIMARY KEY,
  prospect_id INTEGER REFERENCES prospects(id) ON DELETE CASCADE NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  amount NUMERIC(14, 2),
  valid_until TIMESTAMP,
  status proposal_status DEFAULT 'borrador',
  notes TEXT,
  sent_at TIMESTAMP,
  sent_by_id INTEGER REFERENCES users(id),
  created_by_id INTEGER REFERENCES users(id) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Follow-up alerts table
CREATE TABLE IF NOT EXISTS follow_up_alerts (
  id SERIAL PRIMARY KEY,
  prospect_id INTEGER REFERENCES prospects(id) ON DELETE CASCADE,
  alert_type alert_type NOT NULL,
  status alert_status DEFAULT 'pending',
  title TEXT NOT NULL,
  message TEXT,
  priority priority DEFAULT 'media',
  due_date TIMESTAMP,
  acknowledged_at TIMESTAMP,
  acknowledged_by_id INTEGER REFERENCES users(id),
  assigned_to_id INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Scheduled reminders table
CREATE TABLE IF NOT EXISTS scheduled_reminders (
  id SERIAL PRIMARY KEY,
  prospect_id INTEGER REFERENCES prospects(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  reminder_date TIMESTAMP NOT NULL,
  frequency reminder_frequency DEFAULT 'once',
  is_active BOOLEAN DEFAULT TRUE,
  last_triggered_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- PHASE 3: Add foreign key for current_proposal_id
-- ============================================

-- Add the foreign key constraint after proposal_versions exists
DO $$ BEGIN
  ALTER TABLE prospects
    ADD CONSTRAINT fk_prospects_current_proposal
    FOREIGN KEY (current_proposal_id) REFERENCES proposal_versions(id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- PHASE 4: Indexes
-- ============================================

-- Prospects indexes
CREATE INDEX IF NOT EXISTS idx_prospects_company ON prospects(company_id);
CREATE INDEX IF NOT EXISTS idx_prospects_stage ON prospects(stage);
CREATE INDEX IF NOT EXISTS idx_prospects_assigned ON prospects(assigned_to_id);
CREATE INDEX IF NOT EXISTS idx_prospects_next_follow_up ON prospects(next_follow_up_at);

-- Activities indexes
CREATE INDEX IF NOT EXISTS idx_activities_prospect ON prospect_activities(prospect_id);
CREATE INDEX IF NOT EXISTS idx_activities_created ON prospect_activities(created_at);

-- Notes indexes
CREATE INDEX IF NOT EXISTS idx_notes_prospect ON prospect_notes(prospect_id);

-- Meetings indexes
CREATE INDEX IF NOT EXISTS idx_meetings_prospect ON prospect_meetings(prospect_id);
CREATE INDEX IF NOT EXISTS idx_meetings_scheduled ON prospect_meetings(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_meetings_status ON prospect_meetings(status);

-- Documents indexes
CREATE INDEX IF NOT EXISTS idx_documents_prospect ON prospect_documents(prospect_id);

-- Proposals indexes
CREATE INDEX IF NOT EXISTS idx_proposals_prospect ON proposal_versions(prospect_id);
CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposal_versions(status);

-- Alerts indexes
CREATE INDEX IF NOT EXISTS idx_alerts_status ON follow_up_alerts(status);
CREATE INDEX IF NOT EXISTS idx_alerts_assigned ON follow_up_alerts(assigned_to_id);
CREATE INDEX IF NOT EXISTS idx_alerts_prospect ON follow_up_alerts(prospect_id);

-- Reminders indexes
CREATE INDEX IF NOT EXISTS idx_reminders_user ON scheduled_reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_reminders_date ON scheduled_reminders(reminder_date);
CREATE INDEX IF NOT EXISTS idx_reminders_active ON scheduled_reminders(is_active);

-- ============================================
-- PHASE 5: Triggers for updated_at
-- ============================================

-- Create trigger function if not exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Prospects trigger
DROP TRIGGER IF EXISTS update_prospects_updated_at ON prospects;
CREATE TRIGGER update_prospects_updated_at
  BEFORE UPDATE ON prospects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Notes trigger
DROP TRIGGER IF EXISTS update_prospect_notes_updated_at ON prospect_notes;
CREATE TRIGGER update_prospect_notes_updated_at
  BEFORE UPDATE ON prospect_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Meetings trigger
DROP TRIGGER IF EXISTS update_prospect_meetings_updated_at ON prospect_meetings;
CREATE TRIGGER update_prospect_meetings_updated_at
  BEFORE UPDATE ON prospect_meetings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Proposals trigger
DROP TRIGGER IF EXISTS update_proposal_versions_updated_at ON proposal_versions;
CREATE TRIGGER update_proposal_versions_updated_at
  BEFORE UPDATE ON proposal_versions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Done!
-- ============================================

COMMENT ON TABLE prospects IS 'CRM prospects - potential B2B clients for waste management services';
COMMENT ON TABLE prospect_activities IS 'Timeline of all interactions with prospects';
COMMENT ON TABLE prospect_notes IS 'Notes attached to prospects';
COMMENT ON TABLE prospect_meetings IS 'Scheduled meetings with prospects';
COMMENT ON TABLE prospect_documents IS 'Documents attached to prospects';
COMMENT ON TABLE proposal_versions IS 'Versioned proposals sent to prospects';
COMMENT ON TABLE follow_up_alerts IS 'System-generated alerts for follow-up actions';
COMMENT ON TABLE scheduled_reminders IS 'User-created reminders for prospects';

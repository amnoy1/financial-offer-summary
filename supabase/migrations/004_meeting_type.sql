-- ========================================
-- Migration 004: Meeting Type Classification
-- ========================================

ALTER TABLE meetings
  ADD COLUMN IF NOT EXISTS meeting_type TEXT
  CHECK (meeting_type IN ('pre_treatment', 'recommendations', 'service'))
  DEFAULT 'pre_treatment';

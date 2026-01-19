-- Create slop_reports table
CREATE TABLE IF NOT EXISTS slop_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('twitter', 'youtube', 'linkedin', 'website')),
  reporter_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(item_id, platform, reporter_hash)
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_slop_reports_item_platform ON slop_reports(item_id, platform);
CREATE INDEX IF NOT EXISTS idx_slop_reports_created_at ON slop_reports(created_at);

-- Enable Row Level Security
ALTER TABLE slop_reports ENABLE ROW LEVEL SECURITY;

-- Policy: Allow anonymous users to read reports (for checking status)
CREATE POLICY "Allow anonymous read" ON slop_reports
  FOR SELECT
  USING (true);

-- Policy: Allow anonymous users to insert reports
CREATE POLICY "Allow anonymous insert" ON slop_reports
  FOR INSERT
  WITH CHECK (true);

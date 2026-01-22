-- Create slop_websites table to track slop count per website domain
CREATE TABLE IF NOT EXISTS slop_websites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT NOT NULL UNIQUE,
  slop_count INTEGER NOT NULL DEFAULT 0,
  first_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_slop_websites_domain ON slop_websites(domain);
CREATE INDEX IF NOT EXISTS idx_slop_websites_slop_count ON slop_websites(slop_count DESC);
CREATE INDEX IF NOT EXISTS idx_slop_websites_last_seen_at ON slop_websites(last_seen_at DESC);

-- Enable Row Level Security
ALTER TABLE slop_websites ENABLE ROW LEVEL SECURITY;

-- Policy: Allow anonymous users to read website slop counts
CREATE POLICY "Allow anonymous read" ON slop_websites
  FOR SELECT
  USING (true);

-- Policy: Allow anonymous users to insert/update (via RPC functions)
CREATE POLICY "Allow anonymous insert" ON slop_websites
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow anonymous update" ON slop_websites
  FOR UPDATE
  USING (true);

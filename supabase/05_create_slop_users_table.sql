-- Create slop_users table to track slop count per user per platform
CREATE TABLE IF NOT EXISTS slop_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_identifier TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('twitter', 'youtube', 'linkedin')),
  slop_count INTEGER NOT NULL DEFAULT 0,
  first_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_identifier, platform)
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_slop_users_user_platform ON slop_users(user_identifier, platform);
CREATE INDEX IF NOT EXISTS idx_slop_users_platform ON slop_users(platform);
CREATE INDEX IF NOT EXISTS idx_slop_users_slop_count ON slop_users(slop_count DESC);
CREATE INDEX IF NOT EXISTS idx_slop_users_last_seen_at ON slop_users(last_seen_at DESC);

-- Enable Row Level Security
ALTER TABLE slop_users ENABLE ROW LEVEL SECURITY;

-- Policy: Allow anonymous users to read user slop counts
CREATE POLICY "Allow anonymous read" ON slop_users
  FOR SELECT
  USING (true);

-- Policy: Allow anonymous users to insert/update (via RPC functions)
CREATE POLICY "Allow anonymous insert" ON slop_users
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow anonymous update" ON slop_users
  FOR UPDATE
  USING (true);

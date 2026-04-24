-- Supabase Schema for Units Management
-- Run this in Supabase SQL Editor

-- Create table units
CREATE TABLE IF NOT EXISTS units (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER NOT NULL,
  price NUMERIC NOT NULL,
  description TEXT,
  status TEXT CHECK (status IN ('available', 'sold')) DEFAULT 'available',
  images TEXT[] DEFAULT '{}',
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE units ENABLE ROW LEVEL SECURITY;

-- Policy: Allow public read access (SELECT for everyone)
CREATE POLICY "Allow public read access" 
  ON units 
  FOR SELECT 
  USING (true);

-- Policy: Allow INSERT only to authenticated users
CREATE POLICY "Allow authenticated insert" 
  ON units 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid() = user_id);

-- Policy: Allow UPDATE only to owner
CREATE POLICY "Allow owner update" 
  ON units 
  FOR UPDATE 
  TO authenticated 
  USING (auth.uid() = user_id) 
  WITH CHECK (auth.uid() = user_id);

-- Policy: Allow DELETE only to owner
CREATE POLICY "Allow owner delete" 
  ON units 
  FOR DELETE 
  TO authenticated 
  USING (auth.uid() = user_id);

-- Create index for user_id (performance)
CREATE INDEX IF NOT EXISTS idx_units_user_id ON units(user_id);

-- Create index for status (filtering)
CREATE INDEX IF NOT EXISTS idx_units_status ON units(status);

-- Trigger to update updated_at automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_units_updated_at 
  BEFORE UPDATE ON units 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

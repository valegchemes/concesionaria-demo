-- Create units table
CREATE TABLE IF NOT EXISTS units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand text NOT NULL,
  model text NOT NULL,
  year integer NOT NULL,
  price decimal(10, 2) NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'sold')),
  images text[] DEFAULT ARRAY[]::text[],
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS (Row Level Security)
ALTER TABLE units ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can insert their own units
CREATE POLICY "Users can insert their own units"
  ON units
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own units
CREATE POLICY "Users can update their own units"
  ON units
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own units
CREATE POLICY "Users can delete their own units"
  ON units
  FOR DELETE
  USING (auth.uid() = user_id);

-- Policy: Anyone can read units (public catalog)
CREATE POLICY "Anyone can read units"
  ON units
  FOR SELECT
  USING (true);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_units_user_id ON units(user_id);
CREATE INDEX IF NOT EXISTS idx_units_status ON units(status);
CREATE INDEX IF NOT EXISTS idx_units_created_at ON units(created_at DESC);

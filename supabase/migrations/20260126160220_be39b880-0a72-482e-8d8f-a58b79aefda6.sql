-- Add missing columns to clients table
ALTER TABLE clients 
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS legal_name text,
  ADD COLUMN IF NOT EXISTS tax_code text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS address_text text,
  ADD COLUMN IF NOT EXISTS active boolean DEFAULT true NOT NULL;

-- Populate display_name from existing name column for backward compatibility
UPDATE clients SET display_name = name WHERE display_name IS NULL;

-- Make display_name required (after populating existing data)
ALTER TABLE clients ALTER COLUMN display_name SET NOT NULL;

-- Unique constraint on user_id + vat_number (when vat_number is not null/empty)
CREATE UNIQUE INDEX IF NOT EXISTS clients_user_vat_unique 
  ON clients (user_id, vat_number) 
  WHERE vat_number IS NOT NULL AND vat_number != '';
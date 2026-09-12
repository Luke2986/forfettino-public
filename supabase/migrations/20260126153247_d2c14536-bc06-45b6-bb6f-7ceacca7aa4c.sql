-- Add unique constraint on fiscal_year_settings (user_id, fiscal_year)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fiscal_year_settings_user_year_unique'
    ) THEN
        ALTER TABLE fiscal_year_settings 
        ADD CONSTRAINT fiscal_year_settings_user_year_unique 
        UNIQUE (user_id, fiscal_year);
    END IF;
END $$;

-- Add unique constraint on tax_schedule (user_id, payment_year, bucket)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'tax_schedule_user_year_bucket_unique'
    ) THEN
        ALTER TABLE tax_schedule 
        ADD CONSTRAINT tax_schedule_user_year_bucket_unique 
        UNIQUE (user_id, payment_year, bucket);
    END IF;
END $$;

-- Populate ATECO presets if empty
INSERT INTO profit_coeff_presets (ateco_code, description, coefficient) VALUES
('62.01.00', 'Sviluppo software', 67),
('73.11.01', 'Agenzie pubblicitarie', 78),
('74.10.21', 'Consulenza design', 78),
('62.02.00', 'Consulenza informatica', 67),
('74.90.99', 'Altre attività professionali', 78),
('69.20.13', 'Servizi contabili', 78),
('70.22.09', 'Consulenza aziendale', 78),
('71.12.10', 'Ingegneria', 78),
('85.59.30', 'Formazione', 78)
ON CONFLICT DO NOTHING;
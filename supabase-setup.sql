-- ==========================================================
-- Skrip Setup Database Supabase untuk MemFinance
-- Jalankan skrip ini di SQL Editor dashboard Supabase Anda
-- ==========================================================

-- 1. Buat Schema memfinance
CREATE SCHEMA IF NOT EXISTS memfinance;

-- 2. Buat Tabel user_profiles
CREATE TABLE IF NOT EXISTS memfinance.user_profiles (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    ga_sheet_id TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 3. Aktifkan Row Level Security (RLS)
ALTER TABLE memfinance.user_profiles ENABLE ROW LEVEL SECURITY;

-- 4. Policy: Pengguna hanya dapat membaca profil milik mereka sendiri
CREATE POLICY "Users can view own profile"
    ON memfinance.user_profiles
    FOR SELECT
    USING (auth.uid()::text = id);

-- 5. Policy: Service Role memiliki akses penuh untuk server hooks
CREATE POLICY "Service role full access"
    ON memfinance.user_profiles
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

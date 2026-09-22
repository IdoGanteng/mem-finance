-- ==========================================================
-- Skrip Setup Database Supabase untuk MemFinance
-- Jalankan skrip ini di SQL Editor dashboard Supabase Anda:
-- https://supabase.com/dashboard/project/knawnlginiulbnfobrwv/sql
-- ==========================================================

-- 1. Buat Tabel user_profiles di schema public
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    ga_sheet_id TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2. Aktifkan Row Level Security (RLS)
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- 3. Hapus policy lama jika ada
DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Service role full access" ON public.user_profiles;

-- 4. Policy: Pengguna hanya dapat membaca profil milik mereka sendiri
CREATE POLICY "Users can view own profile"
    ON public.user_profiles
    FOR SELECT
    USING (auth.uid()::text = id);

-- 5. Policy: Service Role memiliki akses penuh untuk server hooks
CREATE POLICY "Service role full access"
    ON public.user_profiles
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

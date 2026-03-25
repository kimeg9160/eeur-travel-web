-- Supabase SQL Editor에서 실행
ALTER TABLE itinerary ADD COLUMN IF NOT EXISTS google_maps_url TEXT DEFAULT NULL;
ALTER TABLE itinerary ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT NULL;

-- RLS 비활성화 (insert/update 권한 문제 해결)
ALTER TABLE itinerary DISABLE ROW LEVEL SECURITY;

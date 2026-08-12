-- Migration 013: Seed Data (idempotent)
-- Standard ISO card sizes (CR80 / ID-1, ID-2, Jumbo B1/B2, etc.)
-- Run only once; repeated application is safe (ON CONFLICT DO NOTHING).

INSERT INTO public.card_sizes (id, organization_id, name, code, width_mm, height_mm, orientation, category, description, is_system_default, active) VALUES
('00000000-0000-0000-0000-000000000001', NULL, 'CR80 / ID-1 (standard card)', 'CR80', 85.60, 53.98, 'landscape', 'standard', 'ISO/IEC 7810 ID-1 — 85.60 × 53.98 mm. The most common ID and credit card size.', true, true),
('00000000-0000-0000-0000-000000000002', NULL, 'ID-2 (European identity card)', 'ID2', 105.00, 74.00, 'landscape', 'standard', 'ISO/IEC 7810 ID-2 — 105 × 74 mm. Used for passports and EU identity cards.', true, true),
('00000000-0000-0000-0000-000000000003', NULL, 'Jumbo / B1 (event badge)', 'B1', 125.00, 90.00, 'landscape', 'standard', 'Jumbo event/conference badge — 125 × 90 mm.', true, true),
('00000000-0000-0000-0000-000000000004', NULL, 'Large / B2 (visitor pass)', 'B2', 154.00, 107.00, 'landscape', 'standard', 'Large visitor pass — 154 × 107 mm.', true, true),
('00000000-0000-0000-0000-000000000005', NULL, 'Portrait ID-1 (vertical CR80)', 'CR80-V', 53.98, 85.60, 'portrait', 'standard', 'Portrait orientation of the standard CR80 / ID-1 card.', true, true)
ON CONFLICT (id) DO NOTHING;

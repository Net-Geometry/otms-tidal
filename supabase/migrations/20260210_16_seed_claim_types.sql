-- Claims Management: seed claim_types (ERP MVP)

INSERT INTO public.claim_types (
  code,
  name,
  final_approver,
  limit_amount,
  limit_period,
  is_active,
  sort_order
)
VALUES
  ('stationery', 'Stationery', 'hr', NULL, NULL, true, 10),
  ('medical_hospital', 'Medical Hospital/Clinic', 'finance', NULL, NULL, true, 20),
  ('medical_medicine', 'Medical Medicine', 'hr', NULL, NULL, true, 30),
  ('food_refreshment', 'Food/Refreshment', 'hr', 20.00, 'day', true, 40),
  ('hotel_accommodation', 'Hotel/Accommodation', 'hr', NULL, NULL, true, 50),
  ('mileage_transport', 'Mileage/Transport', 'hr', NULL, NULL, true, 60),
  ('repair_vehicle', 'Repair & Maintenance Vehicle', 'hr', NULL, NULL, true, 70),
  ('repair_general', 'Repair & Maintenance General', 'hr', NULL, NULL, true, 80),
  ('entertainment', 'Entertainment', 'hr', NULL, NULL, true, 90),
  ('education_training', 'Education/Training', 'finance', NULL, NULL, true, 100),
  ('others', 'Others', 'hr', NULL, NULL, true, 110)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  final_approver = EXCLUDED.final_approver,
  limit_amount = EXCLUDED.limit_amount,
  limit_period = EXCLUDED.limit_period,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

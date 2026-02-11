-- Payroll Management: Seed configuration data

-- 1) Seed payroll_settings singleton
INSERT INTO public.payroll_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- 2) Seed allowance types
INSERT INTO public.allowance_types (code, name, is_epf_subject, is_socso_subject, is_eis_subject, is_taxable, default_amount, sort_order)
VALUES
  ('general', 'General Allowance', true, true, true, true, 0, 1),
  ('net', 'Net Allowance', false, false, false, false, 0, 2),
  ('phone', 'Phone Allowance', false, false, false, true, 0, 3),
  ('hardship', 'Hardship Allowance', true, true, true, true, 0, 4)
ON CONFLICT (code) DO NOTHING;

-- 3) Seed deduction types
INSERT INTO public.deduction_types (code, name, category, sort_order)
VALUES
  ('pcb', 'PCB / MTD (Income Tax)', 'statutory', 1),
  ('cp38', 'CP38 (Additional Tax Deduction)', 'statutory', 2),
  ('zakat', 'Zakat', 'statutory', 3),
  ('sports_club', 'Sports Club', 'other', 4),
  ('staff_loan', 'Staff Loan', 'loan', 5),
  ('rental', 'Rental Deduction', 'other', 6)
ON CONFLICT (code) DO NOTHING;

-- 4) Seed SOCSO contribution table (PERKESO official wage ranges up to RM4000)
INSERT INTO public.socso_contribution_table (wage_from, wage_to, employer_first_category, employee_first_category, employer_second_category)
VALUES
  (0.00, 30.00, 0.40, 0.10, 0.30),
  (30.01, 50.00, 0.70, 0.20, 0.50),
  (50.01, 70.00, 1.10, 0.30, 0.80),
  (70.01, 100.00, 1.50, 0.40, 1.10),
  (100.01, 140.00, 2.10, 0.60, 1.50),
  (140.01, 200.00, 2.70, 0.75, 1.95),
  (200.01, 300.00, 3.80, 1.05, 2.75),
  (300.01, 400.00, 5.40, 1.50, 3.90),
  (400.01, 500.00, 6.90, 1.85, 4.95),
  (500.01, 600.00, 8.40, 2.25, 6.05),
  (600.01, 700.00, 9.90, 2.65, 7.15),
  (700.01, 800.00, 11.40, 3.05, 8.25),
  (800.01, 900.00, 12.90, 3.45, 9.35),
  (900.01, 1000.00, 14.40, 3.85, 10.45),
  (1000.01, 1100.00, 15.90, 4.25, 11.55),
  (1100.01, 1200.00, 17.40, 4.65, 12.65),
  (1200.01, 1300.00, 18.90, 5.05, 13.75),
  (1300.01, 1400.00, 20.40, 5.45, 14.85),
  (1400.01, 1500.00, 21.90, 5.85, 15.95),
  (1500.01, 1600.00, 23.40, 6.25, 17.05),
  (1600.01, 1700.00, 24.90, 6.65, 18.15),
  (1700.01, 1800.00, 26.40, 7.05, 19.25),
  (1800.01, 1900.00, 27.90, 7.45, 20.35),
  (1900.01, 2000.00, 29.40, 7.85, 21.45),
  (2000.01, 2100.00, 30.90, 8.25, 22.55),
  (2100.01, 2200.00, 32.40, 8.65, 23.65),
  (2200.01, 2300.00, 33.90, 9.05, 24.75),
  (2300.01, 2400.00, 35.40, 9.45, 25.85),
  (2400.01, 2500.00, 36.90, 9.85, 26.95),
  (2500.01, 2600.00, 38.40, 10.25, 28.05),
  (2600.01, 2700.00, 39.90, 10.65, 29.15),
  (2700.01, 2800.00, 41.40, 11.05, 30.25),
  (2800.01, 2900.00, 42.90, 11.45, 31.35),
  (2900.01, 3000.00, 44.40, 11.85, 32.45),
  (3000.01, 3100.00, 45.90, 12.25, 33.55),
  (3100.01, 3200.00, 47.40, 12.65, 34.65),
  (3200.01, 3300.00, 48.90, 13.05, 35.75),
  (3300.01, 3400.00, 50.40, 13.45, 36.85),
  (3400.01, 3500.00, 51.90, 13.85, 37.95),
  (3500.01, 3600.00, 53.40, 14.25, 39.05),
  (3600.01, 3700.00, 54.90, 14.65, 40.15),
  (3700.01, 3800.00, 56.40, 15.05, 41.25),
  (3800.01, 3900.00, 57.90, 15.45, 42.35),
  (3900.01, 4000.00, 59.40, 15.85, 43.45)
ON CONFLICT DO NOTHING;

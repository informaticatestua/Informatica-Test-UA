-- Ampliar el CHECK de category para incluir la rama 'ti' (Tecnologías de la Información)
ALTER TABLE subjects DROP CONSTRAINT IF EXISTS subjects_category_check;
ALTER TABLE subjects ADD CONSTRAINT subjects_category_check
  CHECK (category = ANY (ARRAY['software'::text, 'third_year'::text, 'second_year'::text, 'first_year'::text, 'other'::text, 'ti'::text]));

-- Insertar la asignatura IR en la rama de Tecnologías de la Información
INSERT INTO subjects (id, display_name, category, parent_id, sort_order, is_ai_generated)
VALUES ('ir', 'IR', 'ti', NULL, 150, false);

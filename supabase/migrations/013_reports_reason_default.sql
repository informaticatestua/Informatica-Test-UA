-- Elimina la necesidad de enviar `reason` desde el cliente.
-- El campo sigue siendo válido para clasificación futura, pero ya no es obligatorio.
ALTER TABLE reports ALTER COLUMN reason SET DEFAULT 'Otro';

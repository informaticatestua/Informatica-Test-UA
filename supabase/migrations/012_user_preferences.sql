-- Añade columnas de preferencias de usuario al perfil:
-- tema visual, proveedor de IA activo y modelos seleccionados.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS theme           TEXT CHECK (theme IN ('light', 'dark')),
  ADD COLUMN IF NOT EXISTS ai_provider     TEXT,
  ADD COLUMN IF NOT EXISTS ai_gemini_model TEXT,
  ADD COLUMN IF NOT EXISTS ai_groq_model   TEXT,
  ADD COLUMN IF NOT EXISTS ai_deepseek_model TEXT;

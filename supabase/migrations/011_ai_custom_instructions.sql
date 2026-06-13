-- Añade campo para instrucciones personalizadas de IA al perfil del usuario.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ai_custom_instructions TEXT;

-- ═══════════════════════════════════════════════════════════════════
-- 006_api_key_encryption.sql
-- Columnas encriptadas para las API keys de IA (pgcrypto).
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS groq_key_enc   TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS gemini_key_enc TEXT DEFAULT NULL;

CREATE OR REPLACE FUNCTION save_api_key(p_provider TEXT, p_key TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_secret TEXT := 'informatica-test-ua-enc-key-2024';
BEGIN
  IF p_key IS NULL OR p_key = '' THEN
    CASE p_provider
      WHEN 'groq'   THEN UPDATE public.profiles SET groq_key_enc   = NULL WHERE id = auth.uid();
      WHEN 'gemini' THEN UPDATE public.profiles SET gemini_key_enc = NULL WHERE id = auth.uid();
      ELSE NULL;
    END CASE;
    RETURN;
  END IF;

  CASE p_provider
    WHEN 'groq'   THEN UPDATE public.profiles SET groq_key_enc   = encode(pgp_sym_encrypt(p_key, v_secret), 'base64') WHERE id = auth.uid();
    WHEN 'gemini' THEN UPDATE public.profiles SET gemini_key_enc = encode(pgp_sym_encrypt(p_key, v_secret), 'base64') WHERE id = auth.uid();
    ELSE NULL;
  END CASE;
END;
$$;

CREATE OR REPLACE FUNCTION get_api_key(p_provider TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_secret  TEXT := 'informatica-test-ua-enc-key-2024';
  v_enc_val TEXT;
BEGIN
  CASE p_provider
    WHEN 'groq'   THEN SELECT groq_key_enc   INTO v_enc_val FROM public.profiles WHERE id = auth.uid();
    WHEN 'gemini' THEN SELECT gemini_key_enc INTO v_enc_val FROM public.profiles WHERE id = auth.uid();
    ELSE RETURN NULL;
  END CASE;

  IF v_enc_val IS NULL OR v_enc_val = '' THEN RETURN NULL; END IF;
  RETURN pgp_sym_decrypt(decode(v_enc_val, 'base64'), v_secret);
END;
$$;

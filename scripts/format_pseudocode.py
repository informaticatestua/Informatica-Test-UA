"""
format_pseudocode.py
====================
Detecta y formatea bloques de pseudocódigo/código fuente incrustados en
las preguntas de pedPreguntas.txt, añadiendo bloques Markdown ``` ```.

REGLAS DE SEGURIDAD:
  - Solo modifica la línea de texto de la pregunta (línea 1 de cada bloque).
  - Nunca toca delimitadores, respuestas, ni líneas en blanco.
  - El archivo resultante debe poder ser parseado de igual forma que el original.
"""

import re
import sys

INPUT_FILE  = r"C:\Users\Jesus\Documents\Proyectos\Informatica-Test-UA\public\resources\data\pedPreguntas.txt"
OUTPUT_FILE = INPUT_FILE  # Sobrescribe en sitio

# ─────────────────────────────────────────────────────────────────────────────
# Helpers de detección
# ─────────────────────────────────────────────────────────────────────────────

# Palabras-clave de pseudocódigo / C++ que indican bloques de código
CODE_KEYWORDS = re.compile(
    r'\b(VAR|Var|var|si\s+\w|sino|fsi|fopción|opción|función|ffunción|'
    r'devuelve|para|fpara|mientras|fmientras|'
    r'int\s+\w|for\s*\(|if\s*\(|while\s*\(|cout\s*<<|'
    r'delete\s|new\s+\w|void\s+\w|return\s|'
    r'TCoordenada|TCalendario|TLista|TPosicion|TNodo|Tlista|Tnodo)\b'
)

# Señales de que hay múltiples sentencias pegadas (separadas por ; o espacio entre asignaciones)
MULTI_STMT = re.compile(r';[^;]+;|\)\s*=\s*[^ ]+\s+[a-z_A-Z0-9]+\(')

# Líneas de sintaxis algebraica con flechas y ecuaciones
ALGEBRAIC = re.compile(r'(→|->\s*\w|\bVAR\b|\bcero\b.*=|\bsuc\b\(|(?:\b[a-z_]+\([^)]*\)\s*=\s*))')


def looks_like_code_block(text: str) -> bool:
    """Devuelve True si el texto parece contener pseudocódigo/código fuente."""
    # Si ya tiene un bloque Markdown, lo ignoramos para no reformatear
    if '```' in text:
        return False
    
    has_keyword = bool(CODE_KEYWORDS.search(text))
    has_multi   = bool(MULTI_STMT.search(text))
    has_alg     = bool(ALGEBRAIC.search(text))
    
    # Algunos casos tienen funciones que se evalúan, ej. "base(crear())=error_item()"
    has_mashed_equations = bool(re.search(r'\)\s*=\s*[a-zA-Z_0-9\(\)]+\s*[a-zA-Z_]\w*\(', text))

    return (has_keyword and has_multi) or (has_alg and has_multi) or has_mashed_equations or (has_alg and has_keyword)


# ─────────────────────────────────────────────────────────────────────────────
# Code splitting logic
# ─────────────────────────────────────────────────────────────────────────────

def format_code_block(code: str) -> str:
    """
    Toma el bloque de código en una sola línea y lo formatea agregando
    el escape de salto de línea literalmente "\\n" que espera el parser JS.
    """
    # 1. Expandimos espacios donde haya ecuaciones pegadas: "algo()=x base(p)=" -> "algo()=x ; base(p)="
    code = re.sub(r'(\)\s*=\s*[^;\s]+)\s+([a-zA-Z_]\w*\()', r'\1; \2', code)
    code = re.sub(r'\s*;\s*', '; ', code)

    lines = []
    depth = 0
    current = []
    i = 0
    while i < len(code):
        ch = code[i]
        if ch in '([{':
            depth += 1
            current.append(ch)
        elif ch in ')]}':
            depth -= 1
            current.append(ch)
        elif ch == ';' and depth == 0:
            current.append(';')
            line = ''.join(current).strip()
            if line:
                lines.append(line)
            current = []
        else:
            current.append(ch)
        i += 1

    remainder = ''.join(current).strip()
    if remainder:
        lines.append(remainder)

    if len(lines) <= 1:
        # Quizás todo esto era un código en C++ donde no hay pto y coma...
        if '{' in code and '}' in code:
            code = code.replace('{', '{\\n').replace('}', '\\n}')
            return f"```{code}```"
        return None

    # Usamos literal con doble backslash "\\n" para generar un \n (2 caracteres) en el txt
    # ya que el parser JS hace .split('\\n') y lo procesa internamente.
    formatted = '\\n'.join(lines)
    return f"```{formatted}```"


def format_question_line(line: str) -> str:
    """
    Intenta extraer el bloque de código y le pone ```...```.
    """
    if '```' in line:
        return line

    separators = [
        r'(?:es la siguiente[^:]*|son las siguientes[^:]*|es la siguiente|'
        r'es el siguiente[^:]*|se define as[íi][^:]*|es la siguiente \([^)]+\)):\s*',
        r'(?:siguiente \([^)]+\)):?\s*',
        r'(?:es:)\s*',
        r'(?:siguiente[s]?:)\s*',
    ]

    for sep_pattern in separators:
        m = re.search(sep_pattern, line, re.IGNORECASE)
        if m:
            end_of_sep = m.end()
            intro = line[:end_of_sep].rstrip()
            code_raw = line[end_of_sep:].strip()

            if code_raw and len(code_raw) > 8:
                formatted = format_code_block(code_raw)
                if formatted:
                    return intro + ' ' + formatted

    # Fallback heurística
    m = re.search(
        r'(?<!\w)(VAR|Var)\s+\w|'
        r'(?<=[.:])\s+[A-Za-z_]\w*\s*[\(:→]',
        line
    )
    if m:
        split_pos = m.start()
        # Ensure we don't pick up matching too early
        if split_pos > 10:
            intro    = line[:split_pos].rstrip()
            code_raw = line[split_pos:].strip()
            if code_raw and len(code_raw) > 15:
                formatted = format_code_block(code_raw)
                if formatted:
                    return intro + ' ' + formatted

    # Second fallback for direct functions
    m = re.search(r'\s([a-zA-Z_]\w*\([^\)]*\)\s*(?:->|→)\s*\w+;)', line)
    if m:
        split_pos = m.start()
        intro = line[:split_pos].rstrip()
        code_raw = line[split_pos:].strip()
        formatted = format_code_block(code_raw)
        if formatted:
            return intro + ' ' + formatted

    return line

# ─────────────────────────────────────────────────────────────────────────────
# Procesamiento principal del archivo
# ─────────────────────────────────────────────────────────────────────────────

def process_file(input_path: str, output_path: str):
    raw = ""
    # Try multiple encodings
    for encoding in ['utf-8', 'utf-8-sig', 'windows-1252', 'latin-1']:
        try:
            with open(input_path, 'r', encoding=encoding) as f:
                raw = f.read()
            # Si logró leerlo sin errores, terminamos el loop
            break
        except UnicodeDecodeError:
            continue

    if not raw:
        print("No se pudo leer el archivo. Problemas de codificación.")
        return

    if '\r\n' in raw:
        line_ending = '\r\n'
    else:
        line_ending = '\n'

    lines = raw.splitlines()
    total = len(lines)

    modified_count = 0
    new_lines = []
    i = 0

    while i < total:
        line = lines[i]

        is_question = False
        if i + 1 < total:
            next_line = lines[i + 1].strip()
            if re.match(r'^\d[\d,]*$', next_line):
                is_question = True

        if is_question and looks_like_code_block(line):
            formatted_line = format_question_line(line)
            if formatted_line and formatted_line != line:
                new_lines.append(formatted_line)
                modified_count += 1
                i += 1
                continue

        new_lines.append(line)
        i += 1

    result = line_ending.join(new_lines)
    if raw.endswith('\n') or raw.endswith('\r\n'):
        result += line_ending

    # Save format using utf-8 consistently
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(result)

    print(f"-> Procesadas {total} líneas.")
    print(f"-> Preguntas modificadas en esta pasada: {modified_count}")
    print(f"-> Archivo guardado en: {output_path}")

if __name__ == '__main__':
    process_file(INPUT_FILE, OUTPUT_FILE)


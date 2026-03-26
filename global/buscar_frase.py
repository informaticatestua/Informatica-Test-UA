import os
import fitz  # PyMuPDF
from tqdm import tqdm
from fuzzywuzzy import fuzz
from concurrent.futures import ThreadPoolExecutor, as_completed

def procesar_pdf(ruta_completa, frase, similitud_minima):
    try:
        doc = fitz.open(ruta_completa)
        paginas_encontradas = []
        for pagina in doc:
            texto_pagina = pagina.get_text("text").split('\n')  # Divide el texto de la página en líneas
            for segmento_texto in texto_pagina:
                ratio_similitud = fuzz.ratio(segmento_texto, frase)
                if ratio_similitud >= similitud_minima:
                    paginas_encontradas.append(pagina.number + 1)
                    break  # Detiene la búsqueda en esta página después de encontrar una coincidencia
        doc.close()
        if paginas_encontradas:
            return f'Frase similar encontrada en "{ruta_completa}" con similitud ≥ {similitud_minima}%, páginas {list(set(paginas_encontradas))}'
    except Exception as e:
        return f"Error al abrir el archivo {ruta_completa}: {e}"

def buscar_frase_similar_en_pdf(directorio, frase, similitud_minima):
    archivos_pdf = [os.path.join(raiz, archivo) for raiz, dirs, archivos in os.walk(directorio) for archivo in archivos if archivo.endswith('.pdf')]

    resultados = []
    with ThreadPoolExecutor() as executor:
        # Crear un futuro para cada archivo PDF
        future_to_pdf = {executor.submit(procesar_pdf, ruta_completa, frase, similitud_minima): ruta_completa for ruta_completa in archivos_pdf}
        for future in tqdm(as_completed(future_to_pdf), total=len(archivos_pdf), desc="Procesando archivos PDF"):
            resultado = future.result()
            if resultado:
                resultados.append(resultado)
    
    for resultado in resultados:
        print(resultado)

frase_a_buscar = input("Ingresa la frase que quieres buscar: ")
similitud_minima = int(input("Ingresa el porcentaje mínimo de similitud (0-100): "))
directorio_actual = '.'  # Representa el directorio actual
buscar_frase_similar_en_pdf(directorio_actual, frase_a_buscar, similitud_minima)

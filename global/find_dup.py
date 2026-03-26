import itertools
import sys
import time
from multiprocessing import Pool, cpu_count, Manager

def distancia_levenshtein(s1, s2):
    if len(s1) < len(s2):
        return distancia_levenshtein(s2, s1)
    if not s1:
        return len(s2)

    previa_fila = range(len(s2) + 1)
    for i, c1 in enumerate(s1):
        actual_fila = [i + 1]
        for j, c2 in enumerate(s2):
            inserciones = previa_fila[j + 1] + 1
            eliminaciones = actual_fila[j] + 1
            sustituciones = previa_fila[j] + (c1 != c2)
            actual_fila.append(min(inserciones, eliminaciones, sustituciones))
        previa_fila = actual_fila

    return previa_fila[-1]

def leer_preguntas(archivo_txt):
    with open(archivo_txt, 'r', encoding='utf-8') as archivo:
        contenido = archivo.read().strip()
    segmentos = contenido.split('\n\n')
    preguntas = [segmento.split('\n', 1)[0].strip() for segmento in segmentos if segmento.strip()]
    return preguntas

def formatear_tiempo(segundos):
    horas = segundos // 3600
    minutos = (segundos % 3600) // 60
    segundos = segundos % 60
    if horas > 0:
        return f"{int(horas)}h {int(minutos)}m {int(segundos)}s"
    elif minutos > 0:
        return f"{int(minutos)}m {int(segundos)}s"
    else:
        return f"{int(segundos)}s"

def comparar_pares(pares, contador, total_comparaciones, inicio):
    resultados = []
    for pregunta1, pregunta2 in pares:
        distancia = distancia_levenshtein(pregunta1, pregunta2)
        longitud_maxima = max(len(pregunta1), len(pregunta2))
        if longitud_maxima > 0:
            similitud = (1 - distancia / longitud_maxima) * 100
            resultados.append(((pregunta1, pregunta2), similitud))
        
        contador.value += 1
        if contador.value % 100 == 0:
            tiempo_actual = time.time()
            tiempo_transcurrido = tiempo_actual - inicio.value
            porcentaje = (contador.value / total_comparaciones) * 100
            tiempo_restante_estimado = (tiempo_transcurrido / contador.value) * (total_comparaciones - contador.value)
            tiempo_restante_formateado = formatear_tiempo(tiempo_restante_estimado)
            print(f"Procesando... {porcentaje:.2f}% completado. Tiempo restante estimado: {tiempo_restante_formateado}", end='\r')
    return resultados

def calcular_similitudes(preguntas):
    pares = list(itertools.combinations(preguntas, 2))
    total_comparaciones = len(pares)
    num_cpus = cpu_count()
    trozo = len(pares) // num_cpus

    with Manager() as manager:
        contador = manager.Value('i', 0)
        inicio = manager.Value('d', time.time())
        with Pool(processes=num_cpus) as pool:
            tareas = [(pares[i:i + trozo], contador, total_comparaciones, inicio) for i in range(0, len(pares), trozo)]
            resultados = pool.starmap(comparar_pares, tareas)

        similitudes = [item for sublist in resultados for item in sublist]
        similitudes.sort(key=lambda x: x[1], reverse=True)

        return similitudes

def mostrar_similitudes(similitudes, n=10, umbral_similitud=90.0):
    similitudes_filtradas = [(par, sim) for par, sim in similitudes if sim >= umbral_similitud]
    total = len(similitudes_filtradas)
    mostradas = 0

    for i, ((pregunta1, pregunta2), similitud) in enumerate(similitudes_filtradas):
        print(f"Similitud: {similitud:.2f}%\nPregunta 1: {pregunta1}\nPregunta 2: {pregunta2}\n")
        mostradas += 1
        if mostradas % n == 0:
            restantes = total - mostradas
            respuesta = input(f"Mostrar más resultados? (s/n) [Quedan {restantes} comparaciones por mostrar]: ")
            if respuesta.lower() != 's':
                break

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python script.py archivo.txt [umbral_similitud]")
        sys.exit(1)

    archivo_txt = sys.argv[1]
    umbral_similitud = 90.0  # Valor predeterminado

    if len(sys.argv) >= 3:
        try:
            umbral_similitud = float(sys.argv[2])
        except ValueError:
            print("El umbral de similitud debe ser un número. Usando el valor predeterminado de 90.0")

    preguntas = leer_preguntas(archivo_txt)
    num_cpus = cpu_count()
    print(f"Total de preguntas en el archivo: {len(preguntas)}")
    print(f"Número de núcleos de CPU utilizados: {num_cpus}")

    similitudes = calcular_similitudes(preguntas)
    mostrar_similitudes(similitudes, n=10, umbral_similitud=umbral_similitud)

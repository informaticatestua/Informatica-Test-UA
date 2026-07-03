# Vídeo de novedad — Remotion (Cambio de Monedas)

Fuente [Remotion](https://www.remotion.dev/) que genera el vídeo de preview usado en
`src/components/NovedadModal.astro` (el diálogo de "¡Novedad!" al entrar en la web).

Anima el algoritmo **Cambio de Monedas (Voraz)** de la web de Esquemas (AlgoVisual / ADA):
una intro que simula pulsar *play* y luego el algoritmo resolviéndose paso a paso,
con la misma estética (monedas, paleta, cabecera) que el proyecto real.

## Estructura

- `src/steps.ts` — genera los pasos del algoritmo voraz (réplica de `ALGO_COIN_CHANGE`).
- `src/config.ts` — dimensiones, fps y línea de tiempo (fase intro + pasos).
- `src/CoinChange.tsx` — composición/animación.
- `src/Root.tsx` — registra la composición `CoinChange`.

## Cómo renderizar

> ⚠️ Remotion lanza un Chrome headless. Instálalo y renderízalo en una ruta de
> disco **real** (p. ej. fuera de directorios temporales/sandbox), o el navegador
> no arrancará (`spawn ... ENOENT`).

```bash
npm install
npm run render     # -> out/coin-change.mp4
npm run still      # -> out/poster.png (fotograma para el póster)
npm run studio     # editor interactivo en el navegador
```

## Publicar en la web

Copia los ficheros renderizados al proyecto Astro:

```
out/coin-change.mp4  ->  public/resources/videos/novedad-esquemas.mp4
out/poster.jpg       ->  public/resources/videos/novedad-esquemas.jpg
```

(El póster de producción se generó con el botón de play visible, para invitar a reproducir:
`npx remotion still CoinChange out/poster.jpg --frame=42 --jpeg-quality=82`.)

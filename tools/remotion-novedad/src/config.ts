import { generateSteps } from './steps';

export { COINS, AMOUNT } from './steps';

export const FPS = 30;
export const WIDTH = 1280;
export const HEIGHT = 800;

// Fases de la línea de tiempo (en frames)
export const INTRO_END = 58;   // ventana de la app + botón play pulsando
export const PRESS_DUR = 18;   // animación de "click" en play
export const STEPS_START = INTRO_END + PRESS_DUR;
export const STEP_DUR = 24;    // frames por paso del algoritmo
export const END_HOLD = 54;    // congelado final

export const STEPS = generateSteps();

export const DURATION_IN_FRAMES =
  STEPS_START + STEPS.length * STEP_DUR + END_HOLD;

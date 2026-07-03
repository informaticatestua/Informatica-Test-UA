// Genera los pasos del algoritmo voraz de Cambio de Monedas,
// replicando la lógica de subjects/ADA/algoritmos_data.js (ALGO_COIN_CHANGE).

export type CoinStep = {
  remaining: number;
  cur: number;            // índice de la moneda "en foco" (-1 = ninguna)
  chosen: number[];       // monedas ya elegidas
  desc: string;           // descripción del paso (texto plano)
  justTook: number | null; // valor de moneda recién cogida (para animar el "pop")
  done?: boolean;
};

export const COINS = [50, 20, 10, 5, 2, 1];
export const AMOUNT = 68;

export function generateSteps(): CoinStep[] {
  const coins = COINS;
  const amount = AMOUNT;
  const steps: CoinStep[] = [];
  const chosen: number[] = [];
  let remaining = amount;

  steps.push({
    remaining, cur: -1, chosen: [], justTook: null,
    desc: `Cambio voraz: devolver ${amount} con el mínimo de monedas.`,
  });

  for (let i = 0; i < coins.length; i++) {
    const c = coins[i];
    steps.push({
      remaining, cur: i, chosen: [...chosen], justTook: null,
      desc: c <= remaining
        ? `Cogemos la moneda más grande que cabe: ${c} (≤ ${remaining}).`
        : `La moneda de ${c} es mayor que ${remaining}, la saltamos.`,
    });
    while (remaining >= c) {
      remaining -= c;
      chosen.push(c);
      steps.push({
        remaining, cur: i, chosen: [...chosen], justTook: c,
        desc: `Cogemos una moneda de ${c}. Restante: ${remaining}.`,
      });
    }
  }

  steps.push({
    remaining: 0, cur: -1, chosen: [...chosen], justTook: null, done: true,
    desc: `${chosen.length} monedas: ${chosen.join(' + ')} = ${amount}.`,
  });

  return steps;
}

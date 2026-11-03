export type StockMode = 'add' | 'subtract' | 'set';

/** The stock after [mode] is applied to [current] (may be negative: the caller refuses that). */
export function nextStock(current: number, mode: StockMode, amount: number): number {
  return mode === 'add' ? current + amount : mode === 'subtract' ? current - amount : amount;
}

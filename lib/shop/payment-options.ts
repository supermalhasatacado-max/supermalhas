import type { StoreSettings } from "./types";
export function installmentTotals(total: number, s: StoreSettings) {
  return Array.from({ length: s.maxInstallments }, (_, i) => ({
    number: i + 1,
    total: i + 1 <= s.freeInstallments ? total : Math.round(total * (1 + (s.installmentInterest / 100) * (i + 1))),
  }));
}

export const fxRates = {
  updatedAt: "2026-02-03T00:00:00Z",
  pairs: {
    // 1 NGN -> 0.00055 EUR
    NGN_EUR: 0.0006,
    // 1 EUR -> 1800 NGN
    EUR_NGN: 1650.0
  }
};

export const getFxRate = (fromCurrency: string, toCurrency: string) => {
  const from = fromCurrency.toUpperCase();
  const to = toCurrency.toUpperCase();
  if (from === "NGN" && to === "EUR") {
    return fxRates.pairs.NGN_EUR;
  }
  if (from === "EUR" && to === "NGN") {
    return fxRates.pairs.EUR_NGN;
  }
  return null;
};

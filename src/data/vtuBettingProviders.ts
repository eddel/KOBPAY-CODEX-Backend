export type VtuBettingProvider = {
  id: string;
  name: string;
};

export const vtuBettingProviders: VtuBettingProvider[] = [
  { id: "bet9ja", name: "Bet9ja" },
  { id: "betking", name: "BetKing" },
  { id: "1xbet", name: "1xBet" },
  { id: "sportybet", name: "SportyBet" },
  { id: "betway", name: "Betway" },
  { id: "naijabet", name: "NaijaBet" }
];

export const vtuBettingProviderAliases: Record<string, string> = {
  "1xbet": "1xbet"
};

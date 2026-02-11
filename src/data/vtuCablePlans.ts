export type VtuCablePlan = {
  provider: "gotv" | "dstv" | "startimes" | "showmax";
  variation: string;
  name: string;
  priceNgn: number;
  status: "Active" | "Disabled";
  description?: string;
};

export const vtuCablePlans: VtuCablePlan[] = [
  {
    provider: "gotv",
    variation: "gotv_smallie",
    name: "Smallie",
    priceNgn: 1900,
    status: "Active"
  },
  {
    provider: "gotv",
    variation: "gotv_smallie_3months",
    name: "Smallie",
    priceNgn: 5100,
    status: "Active",
    description: "3 months"
  },
  {
    provider: "gotv",
    variation: "gotv_smallie_1year",
    name: "Smallie",
    priceNgn: 15000,
    status: "Active",
    description: "1 year"
  },
  {
    provider: "gotv",
    variation: "gotv_jinja",
    name: "Jinja",
    priceNgn: 3900,
    status: "Active"
  },
  {
    provider: "gotv",
    variation: "gotv_jolli",
    name: "Jolli",
    priceNgn: 5800,
    status: "Active"
  },
  {
    provider: "gotv",
    variation: "gotv_max",
    name: "Max",
    priceNgn: 8500,
    status: "Active"
  },
  {
    provider: "dstv",
    variation: "dstv_padi",
    name: "Padi",
    priceNgn: 4400,
    status: "Active"
  },
  {
    provider: "dstv",
    variation: "dstv_yanga",
    name: "Yanga",
    priceNgn: 6000,
    status: "Active"
  },
  {
    provider: "dstv",
    variation: "dstv_confam",
    name: "Confam",
    priceNgn: 11000,
    status: "Active"
  },
  {
    provider: "dstv",
    variation: "dstv_compact",
    name: "Compact",
    priceNgn: 19000,
    status: "Active"
  },
  {
    provider: "dstv",
    variation: "dstv_compact_plus",
    name: "Compact Plus",
    priceNgn: 30000,
    status: "Active"
  },
  {
    provider: "dstv",
    variation: "dstv_premium",
    name: "Premium",
    priceNgn: 44500,
    status: "Active"
  },
  {
    provider: "dstv",
    variation: "dstv_asia",
    name: "Asia",
    priceNgn: 14900,
    status: "Active"
  },
  {
    provider: "dstv",
    variation: "dstv_premium_french",
    name: "Premium French",
    priceNgn: 69000,
    status: "Active"
  },
  {
    provider: "startimes",
    variation: "startimes_nova_weekly",
    name: "Nova",
    priceNgn: 600,
    status: "Active",
    description: "Weekly"
  },
  {
    provider: "startimes",
    variation: "startimes_nova",
    name: "Nova",
    priceNgn: 1900,
    status: "Active"
  },
  {
    provider: "startimes",
    variation: "startimes_basic_weekly",
    name: "Basic",
    priceNgn: 1250,
    status: "Active",
    description: "Weekly"
  },
  {
    provider: "startimes",
    variation: "startimes_basic",
    name: "Basic",
    priceNgn: 3700,
    status: "Active"
  },
  {
    provider: "startimes",
    variation: "startimes_smart_weekly",
    name: "Smart",
    priceNgn: 1550,
    status: "Active",
    description: "Weekly"
  },
  {
    provider: "startimes",
    variation: "startimes_smart",
    name: "Smart",
    priceNgn: 4700,
    status: "Active"
  },
  {
    provider: "startimes",
    variation: "startimes_classic_weekly",
    name: "Classic",
    priceNgn: 1900,
    status: "Active",
    description: "Weekly"
  },
  {
    provider: "startimes",
    variation: "startimes_classic",
    name: "Classic",
    priceNgn: 5500,
    status: "Active"
  },
  {
    provider: "startimes",
    variation: "startimes_super_weekly",
    name: "Super",
    priceNgn: 3000,
    status: "Active",
    description: "Weekly"
  },
  {
    provider: "startimes",
    variation: "startimes_super",
    name: "Super",
    priceNgn: 9000,
    status: "Active"
  }
];

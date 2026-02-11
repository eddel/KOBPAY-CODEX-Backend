export type VtuDataPlan = {
  network: "mtn" | "airtel" | "glo" | "9mobile";
  service: string;
  dataPlan: string;
  sizeLabel: string;
  validityLabel: string;
  priceNgn: number;
  status: "Active" | "Disabled";
  displayName: string;
};

type RawPlan = Omit<VtuDataPlan, "displayName">;

const rawVtuDataPlans: RawPlan[] = [
  {
    network: "mtn",
    service: "MTNSME",
    dataPlan: "500W",
    sizeLabel: "500MB",
    validityLabel: "7-Days",
    priceNgn: 495,
    status: "Active"
  },
  {
    network: "mtn",
    service: "MTNSME",
    dataPlan: "10000",
    sizeLabel: "10GB",
    validityLabel: "30-Days",
    priceNgn: 4475,
    status: "Active"
  },
  {
    network: "mtn",
    service: "MTNSME",
    dataPlan: "1500W",
    sizeLabel: "1.5GB",
    validityLabel: "7-Days",
    priceNgn: 980,
    status: "Active"
  },
  {
    network: "mtn",
    service: "MTNSME",
    dataPlan: "6000W",
    sizeLabel: "6GB",
    validityLabel: "7-Days",
    priceNgn: 2465,
    status: "Active"
  },
  {
    network: "mtn",
    service: "MTNSME",
    dataPlan: "1000D",
    sizeLabel: "1GB",
    validityLabel: "7-Days",
    priceNgn: 785,
    status: "Active"
  },
  {
    network: "mtn",
    service: "MTNSME",
    dataPlan: "2000",
    sizeLabel: "2GB",
    validityLabel: "30-Days",
    priceNgn: 1545,
    status: "Active"
  },
  {
    network: "mtn",
    service: "MTNSME",
    dataPlan: "3000",
    sizeLabel: "3GB",
    validityLabel: "30-Days",
    priceNgn: 2315,
    status: "Active"
  },
  {
    network: "mtn",
    service: "MTNSME",
    dataPlan: "3500",
    sizeLabel: "3.5GB",
    validityLabel: "30-Days",
    priceNgn: 2455,
    status: "Active"
  },
  {
    network: "mtn",
    service: "MTNSME",
    dataPlan: "5000",
    sizeLabel: "5GB",
    validityLabel: "30-Days",
    priceNgn: 3855,
    status: "Active"
  },
  {
    network: "mtn",
    service: "MTNSME",
    dataPlan: "7000",
    sizeLabel: "7GB",
    validityLabel: "30-Days",
    priceNgn: 3455,
    status: "Active"
  },
  {
    network: "mtn",
    service: "MTNAWOOF",
    dataPlan: "500D",
    sizeLabel: "500MB",
    validityLabel: "1-Day",
    priceNgn: 695,
    status: "Active"
  },
  {
    network: "mtn",
    service: "MTNAWOOF",
    dataPlan: "1400W",
    sizeLabel: "1.4GB",
    validityLabel: "7-Days",
    priceNgn: 1761,
    status: "Active"
  },
  {
    network: "mtn",
    service: "MTNAWOOF",
    dataPlan: "7000",
    sizeLabel: "7GB",
    validityLabel: "30-Days",
    priceNgn: 6865,
    status: "Active"
  },
  {
    network: "mtn",
    service: "MTNAWOOF",
    dataPlan: "20000W",
    sizeLabel: "20GB",
    validityLabel: "7-Days",
    priceNgn: 9830,
    status: "Active"
  },
  {
    network: "mtn",
    service: "MTNAWOOF",
    dataPlan: "1800",
    sizeLabel: "1.8GB",
    validityLabel: "30-Days",
    priceNgn: 5870,
    status: "Active"
  },
  {
    network: "mtn",
    service: "MTNAWOOF",
    dataPlan: "10000",
    sizeLabel: "10GB",
    validityLabel: "30-Days",
    priceNgn: 5870,
    status: "Active"
  },
  {
    network: "mtn",
    service: "MTNAWOOF",
    dataPlan: "1000D",
    sizeLabel: "1GB",
    validityLabel: "1-Day",
    priceNgn: 495,
    status: "Active"
  },
  {
    network: "mtn",
    service: "MTNAWOOF",
    dataPlan: "1500D",
    sizeLabel: "1.5GB",
    validityLabel: "2-Days",
    priceNgn: 595,
    status: "Active"
  },
  {
    network: "mtn",
    service: "MTNAWOOF",
    dataPlan: "6000W",
    sizeLabel: "6GB",
    validityLabel: "7-Days",
    priceNgn: 2435,
    status: "Active"
  },
  {
    network: "mtn",
    service: "MTNAWOOF",
    dataPlan: "11000W",
    sizeLabel: "11GB",
    validityLabel: "7-Days",
    priceNgn: 3405,
    status: "Active"
  },
  {
    network: "mtn",
    service: "MTNAWOOF",
    dataPlan: "6750",
    sizeLabel: "6.75GB",
    validityLabel: "30-Days (XTRA SPECIAL)",
    priceNgn: 2925,
    status: "Active"
  },
  {
    network: "mtn",
    service: "MTNGIFT",
    dataPlan: "40",
    sizeLabel: "40MB",
    validityLabel: "1-Day",
    priceNgn: 57,
    status: "Active"
  },
  {
    network: "mtn",
    service: "MTNGIFT",
    dataPlan: "75",
    sizeLabel: "75MB",
    validityLabel: "1-Day",
    priceNgn: 81,
    status: "Active"
  },
  {
    network: "mtn",
    service: "MTNGIFT",
    dataPlan: "500",
    sizeLabel: "500MB",
    validityLabel: "7-Days",
    priceNgn: 495,
    status: "Active"
  },
  {
    network: "mtn",
    service: "MTNGIFT",
    dataPlan: "750",
    sizeLabel: "750MB",
    validityLabel: "3-Days",
    priceNgn: 445,
    status: "Active"
  },
  {
    network: "mtn",
    service: "MTNGIFT",
    dataPlan: "1000D",
    sizeLabel: "1GB",
    validityLabel: "1-Day",
    priceNgn: 495,
    status: "Active"
  },
  {
    network: "mtn",
    service: "MTNGIFT",
    dataPlan: "2000D",
    sizeLabel: "2GB",
    validityLabel: "2-Days",
    priceNgn: 740,
    status: "Active"
  },
  {
    network: "mtn",
    service: "MTNGIFT",
    dataPlan: "2501D",
    sizeLabel: "2.5GB",
    validityLabel: "1-Day",
    priceNgn: 740,
    status: "Active"
  },
  {
    network: "mtn",
    service: "MTNGIFT",
    dataPlan: "2500D",
    sizeLabel: "2.5GB",
    validityLabel: "2-Days",
    priceNgn: 885,
    status: "Active"
  },
  {
    network: "mtn",
    service: "MTNGIFT",
    dataPlan: "3200D",
    sizeLabel: "3.2GB",
    validityLabel: "2-Days",
    priceNgn: 985,
    status: "Active"
  },
  {
    network: "mtn",
    service: "MTNGIFT",
    dataPlan: "1000W",
    sizeLabel: "1GB",
    validityLabel: "7-Days",
    priceNgn: 785,
    status: "Active"
  },
  {
    network: "mtn",
    service: "MTNGIFT",
    dataPlan: "1500W",
    sizeLabel: "1.5GB",
    validityLabel: "7-Days",
    priceNgn: 980,
    status: "Active"
  },
  {
    network: "mtn",
    service: "MTNGIFT",
    dataPlan: "6000W",
    sizeLabel: "6GB",
    validityLabel: "7-Days",
    priceNgn: 2420,
    status: "Active"
  },
  {
    network: "mtn",
    service: "MTNGIFT",
    dataPlan: "2000",
    sizeLabel: "2GB",
    validityLabel: "30-Days",
    priceNgn: 1470,
    status: "Active"
  },
  {
    network: "mtn",
    service: "MTNGIFT",
    dataPlan: "2700",
    sizeLabel: "2.7GB",
    validityLabel: "30-Days",
    priceNgn: 1955,
    status: "Active"
  },
  {
    network: "mtn",
    service: "MTNGIFT",
    dataPlan: "3500",
    sizeLabel: "3.5GB",
    validityLabel: "30-Days",
    priceNgn: 2430,
    status: "Active"
  },
  {
    network: "mtn",
    service: "MTNGIFT",
    dataPlan: "10000",
    sizeLabel: "10GB",
    validityLabel: "30-Days",
    priceNgn: 4380,
    status: "Active"
  },
  {
    network: "mtn",
    service: "MTNGIFT",
    dataPlan: "12500",
    sizeLabel: "12.5 GB",
    validityLabel: "30-Days",
    priceNgn: 5435,
    status: "Active"
  },
  {
    network: "mtn",
    service: "MTNGIFT",
    dataPlan: "5000",
    sizeLabel: "5GB",
    validityLabel: "30-Day",
    priceNgn: 2585,
    status: "Active"
  },
  {
    network: "mtn",
    service: "MTNGIFT",
    dataPlan: "7000",
    sizeLabel: "7GB",
    validityLabel: "30-Day",
    priceNgn: 3450,
    status: "Active"
  },
  {
    network: "mtn",
    service: "MTNGIFT",
    dataPlan: "16500",
    sizeLabel: "16.5 GB",
    validityLabel: "30-Day",
    priceNgn: 6360,
    status: "Active"
  },
  {
    network: "mtn",
    service: "MTNGIFT",
    dataPlan: "20000",
    sizeLabel: "20GB",
    validityLabel: "30-Days",
    priceNgn: 7505,
    status: "Active"
  },
  {
    network: "mtn",
    service: "MTNGIFT",
    dataPlan: "25000",
    sizeLabel: "25GB",
    validityLabel: "30-Days",
    priceNgn: 8905,
    status: "Active"
  },
  {
    network: "mtn",
    service: "MTNGIFT",
    dataPlan: "36000",
    sizeLabel: "36GB",
    validityLabel: "30-Days",
    priceNgn: 10805,
    status: "Active"
  },
  {
    network: "mtn",
    service: "MTNGIFT",
    dataPlan: "75000",
    sizeLabel: "75GB",
    validityLabel: "30-Days",
    priceNgn: 17480,
    status: "Active"
  },
  {
    network: "airtel",
    service: "AIRTELSME",
    dataPlan: "150",
    sizeLabel: "150MB",
    validityLabel: "1-Day",
    priceNgn: 70,
    status: "Active"
  },
  {
    network: "airtel",
    service: "AIRTELSME",
    dataPlan: "300",
    sizeLabel: "300MB",
    validityLabel: "2-Days",
    priceNgn: 120,
    status: "Active"
  },
  {
    network: "airtel",
    service: "AIRTELSME",
    dataPlan: "600",
    sizeLabel: "600MB",
    validityLabel: "2-Days",
    priceNgn: 225,
    status: "Active"
  },
  {
    network: "airtel",
    service: "AIRTELSME",
    dataPlan: "1000D",
    sizeLabel: "1GB",
    validityLabel: "1-Day",
    priceNgn: 363,
    status: "Active"
  },
  {
    network: "airtel",
    service: "AIRTELSME",
    dataPlan: "3000W",
    sizeLabel: "3GB",
    validityLabel: "7-Days",
    priceNgn: 1075,
    status: "Active"
  },
  {
    network: "airtel",
    service: "AIRTELSME",
    dataPlan: "7000W",
    sizeLabel: "7GB",
    validityLabel: "7-Days",
    priceNgn: 2040,
    status: "Active"
  },
  {
    network: "airtel",
    service: "AIRTELSME",
    dataPlan: "4000",
    sizeLabel: "4GB",
    validityLabel: "30-Days",
    priceNgn: 2455,
    status: "Active"
  },
  {
    network: "airtel",
    service: "AIRTELSME",
    dataPlan: "10000",
    sizeLabel: "10GB",
    validityLabel: "30-Days",
    priceNgn: 3105,
    status: "Active"
  },
  {
    network: "airtel",
    service: "AIRTELSME",
    dataPlan: "13000",
    sizeLabel: "13GB",
    validityLabel: "30-Days",
    priceNgn: 4930,
    status: "Active"
  },
  {
    network: "airtel",
    service: "AIRTELCG",
    dataPlan: "100",
    sizeLabel: "100MB",
    validityLabel: "7-Days",
    priceNgn: 110,
    status: "Active"
  },
  {
    network: "airtel",
    service: "AIRTELCG",
    dataPlan: "300",
    sizeLabel: "300MB",
    validityLabel: "7-Days",
    priceNgn: 275,
    status: "Active"
  },
  {
    network: "airtel",
    service: "AIRTELCG",
    dataPlan: "500",
    sizeLabel: "500MB",
    validityLabel: "30-Days",
    priceNgn: 495,
    status: "Active"
  },
  {
    network: "airtel",
    service: "AIRTELCG",
    dataPlan: "1000",
    sizeLabel: "1GB",
    validityLabel: "30-Days",
    priceNgn: 985,
    status: "Active"
  },
  {
    network: "airtel",
    service: "AIRTELCG",
    dataPlan: "2000",
    sizeLabel: "2GB",
    validityLabel: "30-Days",
    priceNgn: 1965,
    status: "Active"
  },
  {
    network: "airtel",
    service: "AIRTELCG",
    dataPlan: "5000",
    sizeLabel: "5GB",
    validityLabel: "30-Days",
    priceNgn: 4905,
    status: "Active"
  },
  {
    network: "airtel",
    service: "AIRTELCG",
    dataPlan: "10000",
    sizeLabel: "10GB",
    validityLabel: "30-Days",
    priceNgn: 9805,
    status: "Active"
  },
  {
    network: "airtel",
    service: "AIRTELCG",
    dataPlan: "15000",
    sizeLabel: "15GB",
    validityLabel: "30-Days",
    priceNgn: 14705,
    status: "Active"
  },
  {
    network: "airtel",
    service: "AIRTELCG",
    dataPlan: "20000",
    sizeLabel: "20GB",
    validityLabel: "30-Days",
    priceNgn: 19605,
    status: "Active"
  },
  {
    network: "airtel",
    service: "AIRTELCG",
    dataPlan: "250000",
    sizeLabel: "250GB",
    validityLabel: "30-Days",
    priceNgn: 250005,
    status: "Active"
  },
  {
    network: "airtel",
    service: "AIRTELGIFT",
    dataPlan: "75",
    sizeLabel: "75MB",
    validityLabel: "1-Day",
    priceNgn: 84.9,
    status: "Active"
  },
  {
    network: "airtel",
    service: "AIRTELGIFT",
    dataPlan: "200",
    sizeLabel: "200MB",
    validityLabel: "3-DayS",
    priceNgn: 211,
    status: "Active"
  },
  {
    network: "airtel",
    service: "AIRTELGIFT",
    dataPlan: "500",
    sizeLabel: "500MB",
    validityLabel: "3-DayS",
    priceNgn: 501,
    status: "Active"
  },
  {
    network: "airtel",
    service: "AIRTELGIFT",
    dataPlan: "1000D",
    sizeLabel: "1GB",
    validityLabel: "1-Day",
    priceNgn: 500,
    status: "Active"
  },
  {
    network: "airtel",
    service: "AIRTELGIFT",
    dataPlan: "1500D",
    sizeLabel: "1.5GB",
    validityLabel: "2-Days",
    priceNgn: 600,
    status: "Active"
  },
  {
    network: "airtel",
    service: "AIRTELGIFT",
    dataPlan: "3000D",
    sizeLabel: "3GB",
    validityLabel: "2-Days",
    priceNgn: 995,
    status: "Active"
  },
  {
    network: "airtel",
    service: "AIRTELGIFT",
    dataPlan: "1000W",
    sizeLabel: "1GB",
    validityLabel: "7-Days",
    priceNgn: 795,
    status: "Active"
  },
  {
    network: "airtel",
    service: "AIRTELGIFT",
    dataPlan: "1500W",
    sizeLabel: "1.5GB",
    validityLabel: "7-Days",
    priceNgn: 1000,
    status: "Active"
  },
  {
    network: "airtel",
    service: "AIRTELGIFT",
    dataPlan: "6000W",
    sizeLabel: "6GB",
    validityLabel: "7-Days",
    priceNgn: 2498,
    status: "Active"
  },
  {
    network: "airtel",
    service: "AIRTELGIFT",
    dataPlan: "2000",
    sizeLabel: "2GB",
    validityLabel: "30-Days",
    priceNgn: 1490,
    status: "Active"
  },
  {
    network: "airtel",
    service: "AIRTELGIFT",
    dataPlan: "3000",
    sizeLabel: "3GB",
    validityLabel: "30-Days",
    priceNgn: 1985,
    status: "Active"
  },
  {
    network: "airtel",
    service: "AIRTELGIFT",
    dataPlan: "4000",
    sizeLabel: "4GB",
    validityLabel: "30-Days",
    priceNgn: 2507,
    status: "Active"
  },
  {
    network: "airtel",
    service: "AIRTELGIFT",
    dataPlan: "8000",
    sizeLabel: "8GB",
    validityLabel: "30-Days",
    priceNgn: 2998,
    status: "Active"
  },
  {
    network: "airtel",
    service: "AIRTELGIFT",
    dataPlan: "10000",
    sizeLabel: "10GB",
    validityLabel: "30-Days",
    priceNgn: 3995,
    status: "Active"
  },
  {
    network: "airtel",
    service: "AIRTELGIFT",
    dataPlan: "13000",
    sizeLabel: "13GB",
    validityLabel: "30-Days",
    priceNgn: 4978,
    status: "Active"
  },
  {
    network: "airtel",
    service: "AIRTELGIFT",
    dataPlan: "18000",
    sizeLabel: "18GB",
    validityLabel: "30-Days",
    priceNgn: 6005,
    status: "Active"
  },
  {
    network: "airtel",
    service: "AIRTELGIFT",
    dataPlan: "25000",
    sizeLabel: "25GB",
    validityLabel: "30-Days",
    priceNgn: 8060,
    status: "Active"
  },
  {
    network: "airtel",
    service: "AIRTELGIFT",
    dataPlan: "35000",
    sizeLabel: "35GB",
    validityLabel: "30-Days",
    priceNgn: 10005,
    status: "Active"
  },
  {
    network: "airtel",
    service: "AIRTELGIFT",
    dataPlan: "60000",
    sizeLabel: "60GB",
    validityLabel: "30-Days",
    priceNgn: 15280,
    status: "Active"
  },
  {
    network: "glo",
    service: "GLOSME",
    dataPlan: "50",
    sizeLabel: "50MB",
    validityLabel: "1-Day",
    priceNgn: 57,
    status: "Active"
  },
  {
    network: "glo",
    service: "GLOSME",
    dataPlan: "125",
    sizeLabel: "125MB",
    validityLabel: "1-Day",
    priceNgn: 103,
    status: "Active"
  },
  {
    network: "glo",
    service: "GLOSME",
    dataPlan: "260",
    sizeLabel: "260MB",
    validityLabel: "2-Days",
    priceNgn: 197,
    status: "Active"
  },
  {
    network: "glo",
    service: "GLOSME",
    dataPlan: "350",
    sizeLabel: "350MB",
    validityLabel: "1-Day",
    priceNgn: 105,
    status: "Active"
  },
  {
    network: "glo",
    service: "GLOSME",
    dataPlan: "750N",
    sizeLabel: "750MB",
    validityLabel: "1-Night Plan",
    priceNgn: 124,
    status: "Active"
  },
  {
    network: "glo",
    service: "GLOSME",
    dataPlan: "750",
    sizeLabel: "750MB",
    validityLabel: "1-Day",
    priceNgn: 210,
    status: "Active"
  },
  {
    network: "glo",
    service: "GLOSME",
    dataPlan: "1250D",
    sizeLabel: "1.25GB",
    validityLabel: "1 Sunday Plan",
    priceNgn: 205,
    status: "Active"
  },
  {
    network: "glo",
    service: "GLOSME",
    dataPlan: "1500D",
    sizeLabel: "1.5GB",
    validityLabel: "1-Day",
    priceNgn: 305,
    status: "Active"
  },
  {
    network: "glo",
    service: "GLOSME",
    dataPlan: "2500D",
    sizeLabel: "2.5GB",
    validityLabel: "2-Days",
    priceNgn: 505,
    status: "Active"
  },
  {
    network: "glo",
    service: "GLOSME",
    dataPlan: "10000W",
    sizeLabel: "10GB",
    validityLabel: "7-Days",
    priceNgn: 2005,
    status: "Active"
  },
  {
    network: "glo",
    service: "GLOCG",
    dataPlan: "200",
    sizeLabel: "200MB",
    validityLabel: "14-Days",
    priceNgn: 95,
    status: "Active"
  },
  {
    network: "glo",
    service: "GLOCG",
    dataPlan: "500",
    sizeLabel: "500MB",
    validityLabel: "30-Days",
    priceNgn: 215,
    status: "Active"
  },
  {
    network: "glo",
    service: "GLOCG",
    dataPlan: "1000",
    sizeLabel: "1GB",
    validityLabel: "30-Days",
    priceNgn: 415,
    status: "Active"
  },
  {
    network: "glo",
    service: "GLOCG",
    dataPlan: "2000",
    sizeLabel: "2GB",
    validityLabel: "30-Days",
    priceNgn: 820,
    status: "Active"
  },
  {
    network: "glo",
    service: "GLOCG",
    dataPlan: "3000",
    sizeLabel: "3GB",
    validityLabel: "30-Days",
    priceNgn: 1230,
    status: "Active"
  },
  {
    network: "glo",
    service: "GLOCG",
    dataPlan: "5000",
    sizeLabel: "5GB",
    validityLabel: "30-Days",
    priceNgn: 2050,
    status: "Active"
  },
  {
    network: "glo",
    service: "GLOCG",
    dataPlan: "10000",
    sizeLabel: "10GB",
    validityLabel: "30-Days",
    priceNgn: 4060,
    status: "Active"
  },
  {
    network: "glo",
    service: "GLOGIFT",
    dataPlan: "50",
    sizeLabel: "50MB",
    validityLabel: "1-Day",
    priceNgn: 56,
    status: "Active"
  },
  {
    network: "glo",
    service: "GLOGIFT",
    dataPlan: "150",
    sizeLabel: "150MB",
    validityLabel: "1-Day",
    priceNgn: 102,
    status: "Active"
  },
  {
    network: "glo",
    service: "GLOGIFT",
    dataPlan: "350",
    sizeLabel: "350MB",
    validityLabel: "1-Day",
    priceNgn: 196,
    status: "Active"
  },
  {
    network: "glo",
    service: "GLOGIFT",
    dataPlan: "1000W",
    sizeLabel: "1GB",
    validityLabel: "14-Days",
    priceNgn: 475,
    status: "Active"
  },
  {
    network: "glo",
    service: "GLOGIFT",
    dataPlan: "3900",
    sizeLabel: "3.9GB",
    validityLabel: "30-Days",
    priceNgn: 950,
    status: "Active"
  },
  {
    network: "glo",
    service: "GLOGIFT",
    dataPlan: "7500",
    sizeLabel: "7.5GB",
    validityLabel: "30-Days",
    priceNgn: 2385,
    status: "Active"
  },
  {
    network: "glo",
    service: "GLOGIFT",
    dataPlan: "9000",
    sizeLabel: "9.2GB",
    validityLabel: "30-Days",
    priceNgn: 1910,
    status: "Active"
  },
  {
    network: "glo",
    service: "GLOGIFT",
    dataPlan: "10000",
    sizeLabel: "10.8GB",
    validityLabel: "30-Days",
    priceNgn: 2870,
    status: "Active"
  },
  {
    network: "glo",
    service: "GLOGIFT",
    dataPlan: "14000",
    sizeLabel: "14GB",
    validityLabel: "30-Days",
    priceNgn: 3835,
    status: "Active"
  },
  {
    network: "glo",
    service: "GLOGIFT",
    dataPlan: "18000",
    sizeLabel: "18GB",
    validityLabel: "30-Days",
    priceNgn: 4765,
    status: "Active"
  },
  {
    network: "9mobile",
    service: "9MOBILESME",
    dataPlan: "250",
    sizeLabel: "250MB",
    validityLabel: "14-Days",
    priceNgn: 86,
    status: "Active"
  },
  {
    network: "9mobile",
    service: "9MOBILESME",
    dataPlan: "500",
    sizeLabel: "500MB",
    validityLabel: "30-Days",
    priceNgn: 140,
    status: "Active"
  },
  {
    network: "9mobile",
    service: "9MOBILESME",
    dataPlan: "3500",
    sizeLabel: "3.5GB",
    validityLabel: "30-Days",
    priceNgn: 910,
    status: "Active"
  },
  {
    network: "9mobile",
    service: "9MOBILESME",
    dataPlan: "7000",
    sizeLabel: "7GB",
    validityLabel: "30-Days",
    priceNgn: 1755,
    status: "Active"
  },
  {
    network: "9mobile",
    service: "9MOBILESME",
    dataPlan: "15000",
    sizeLabel: "15GB",
    validityLabel: "30-Days",
    priceNgn: 3105,
    status: "Active"
  },
  {
    network: "9mobile",
    service: "9MOBILECG",
    dataPlan: "500",
    sizeLabel: "500MB",
    validityLabel: "30-Days",
    priceNgn: 152,
    status: "Active"
  },
  {
    network: "9mobile",
    service: "9MOBILECG",
    dataPlan: "1000",
    sizeLabel: "1GB",
    validityLabel: "30-Days",
    priceNgn: 290,
    status: "Active"
  },
  {
    network: "9mobile",
    service: "9MOBILECG",
    dataPlan: "1500",
    sizeLabel: "1.5GB",
    validityLabel: "30-Days",
    priceNgn: 440,
    status: "Active"
  },
  {
    network: "9mobile",
    service: "9MOBILECG",
    dataPlan: "2000",
    sizeLabel: "2GB",
    validityLabel: "30-Days",
    priceNgn: 575,
    status: "Active"
  },
  {
    network: "9mobile",
    service: "9MOBILECG",
    dataPlan: "3000",
    sizeLabel: "3GB",
    validityLabel: "30-Days",
    priceNgn: 860,
    status: "Active"
  },
  {
    network: "9mobile",
    service: "9MOBILECG",
    dataPlan: "4000",
    sizeLabel: "4GB",
    validityLabel: "30-Days",
    priceNgn: 1145,
    status: "Active"
  },
  {
    network: "9mobile",
    service: "9MOBILECG",
    dataPlan: "4500",
    sizeLabel: "4.5GB",
    validityLabel: "30-Days",
    priceNgn: 1288,
    status: "Active"
  },
  {
    network: "9mobile",
    service: "9MOBILECG",
    dataPlan: "5000",
    sizeLabel: "5GB",
    validityLabel: "30-Days",
    priceNgn: 1430,
    status: "Active"
  },
  {
    network: "9mobile",
    service: "9MOBILECG",
    dataPlan: "10000",
    sizeLabel: "10GB",
    validityLabel: "30-Days",
    priceNgn: 2855,
    status: "Active"
  },
  {
    network: "9mobile",
    service: "9MOBILECG",
    dataPlan: "11000",
    sizeLabel: "11GB",
    validityLabel: "30-Days",
    priceNgn: 4130,
    status: "Active"
  },
  {
    network: "9mobile",
    service: "9MOBILECG",
    dataPlan: "15000",
    sizeLabel: "15GB",
    validityLabel: "30-Days",
    priceNgn: 4280,
    status: "Active"
  },
  {
    network: "9mobile",
    service: "9MOBILECG",
    dataPlan: "20000",
    sizeLabel: "20GB",
    validityLabel: "30-Days",
    priceNgn: 5705,
    status: "Active"
  },
  {
    network: "9mobile",
    service: "9MOBILECG",
    dataPlan: "25000",
    sizeLabel: "25GB",
    validityLabel: "30-Days",
    priceNgn: 7130,
    status: "Active"
  },
  {
    network: "9mobile",
    service: "9MOBILECG",
    dataPlan: "30000",
    sizeLabel: "30GB",
    validityLabel: "30-Days",
    priceNgn: 8555,
    status: "Active"
  },
  {
    network: "9mobile",
    service: "9MOBILECG",
    dataPlan: "40000",
    sizeLabel: "40GB",
    validityLabel: "30-Days",
    priceNgn: 11355,
    status: "Active"
  },
  {
    network: "9mobile",
    service: "9MOBILEGIFT",
    dataPlan: "25",
    sizeLabel: "25MB",
    validityLabel: "1-Day",
    priceNgn: 92,
    status: "Active"
  },
  {
    network: "9mobile",
    service: "9MOBILEGIFT",
    dataPlan: "2000D",
    sizeLabel: "2GB",
    validityLabel: "1-Day",
    priceNgn: 855,
    status: "Active"
  },
  {
    network: "9mobile",
    service: "9MOBILEGIFT",
    dataPlan: "100",
    sizeLabel: "100MB",
    validityLabel: "7-Days",
    priceNgn: 192,
    status: "Active"
  },
  {
    network: "9mobile",
    service: "9MOBILEGIFT",
    dataPlan: "250",
    sizeLabel: "250MB",
    validityLabel: "14-Days",
    priceNgn: 165,
    status: "Active"
  },
  {
    network: "9mobile",
    service: "9MOBILEGIFT",
    dataPlan: "350",
    sizeLabel: "350MB",
    validityLabel: "7-Days",
    priceNgn: 599,
    status: "Active"
  },
  {
    network: "9mobile",
    service: "9MOBILEGIFT",
    dataPlan: "1500W",
    sizeLabel: "1.5GB",
    validityLabel: "7-Days",
    priceNgn: 710,
    status: "Active"
  },
  {
    network: "9mobile",
    service: "9MOBILEGIFT",
    dataPlan: "7000W",
    sizeLabel: "7GB",
    validityLabel: "7-Days",
    priceNgn: 2520,
    status: "Active"
  },
  {
    network: "9mobile",
    service: "9MOBILEGIFT",
    dataPlan: "500",
    sizeLabel: "500MB",
    validityLabel: "14-Days",
    priceNgn: 325,
    status: "Active"
  },
  {
    network: "9mobile",
    service: "9MOBILEGIFT",
    dataPlan: "5000W",
    sizeLabel: "5GB",
    validityLabel: "14-Days",
    priceNgn: 2360,
    status: "Active"
  },
  {
    network: "9mobile",
    service: "9MOBILEGIFT",
    dataPlan: "1500",
    sizeLabel: "1.5GB",
    validityLabel: "30-Days",
    priceNgn: 1665,
    status: "Active"
  },
  {
    network: "9mobile",
    service: "9MOBILEGIFT",
    dataPlan: "2000",
    sizeLabel: "2GB",
    validityLabel: "30-Days",
    priceNgn: 1994,
    status: "Active"
  },
  {
    network: "9mobile",
    service: "9MOBILEGIFT",
    dataPlan: "3000",
    sizeLabel: "3GB",
    validityLabel: "30-Days",
    priceNgn: 2490,
    status: "Active"
  },
  {
    network: "9mobile",
    service: "9MOBILEGIFT",
    dataPlan: "4500",
    sizeLabel: "4.5GB",
    validityLabel: "30-Days",
    priceNgn: 3330,
    status: "Active"
  },
  {
    network: "9mobile",
    service: "9MOBILEGIFT",
    dataPlan: "5500",
    sizeLabel: "5.5GB",
    validityLabel: "30-Days",
    priceNgn: 6850,
    status: "Active"
  },
  {
    network: "9mobile",
    service: "9MOBILEGIFT",
    dataPlan: "11000",
    sizeLabel: "11GB",
    validityLabel: "30-Days",
    priceNgn: 6640,
    status: "Active"
  },
  {
    network: "9mobile",
    service: "9MOBILEGIFT",
    dataPlan: "15000",
    sizeLabel: "15GB",
    validityLabel: "30-Days",
    priceNgn: 8310,
    status: "Active"
  },
  {
    network: "9mobile",
    service: "9MOBILEGIFT",
    dataPlan: "25000",
    sizeLabel: "25GB",
    validityLabel: "30-Days",
    priceNgn: 17830,
    status: "Active"
  }
];

const normalizeLabel = (value: string) =>
  value.replace(/\s+/g, " ").replace(/DayS/gi, "Days").trim();

const planTypeLabel = (service: string) => {
  const upper = service.toUpperCase();
  if (upper.endsWith("AWOOF")) return "Awoof";
  if (upper.endsWith("GIFT")) return "Gifting";
  if (upper.endsWith("CG")) return "Corporate";
  if (upper.endsWith("SME")) return "SME";
  return "Data";
};

export const vtuDataPlans: VtuDataPlan[] = rawVtuDataPlans.map((plan) => {
  const sizeLabel = normalizeLabel(plan.sizeLabel);
  const validityLabel = normalizeLabel(plan.validityLabel);
  const displayName = `${sizeLabel} - ${validityLabel} (${planTypeLabel(plan.service)})`;
  return {
    ...plan,
    sizeLabel,
    validityLabel,
    displayName
  };
});

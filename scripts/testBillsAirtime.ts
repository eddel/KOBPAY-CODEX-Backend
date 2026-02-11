import "dotenv/config";

const baseUrl = process.env.API_BASE_URL ?? "http://localhost:4000";
const phone = process.env.TEST_USER_PHONE ?? "";
const password = process.env.TEST_USER_PASSWORD ?? "";
const customer = process.env.TEST_AIRTIME_CUSTOMER ?? phone;

const assertEnv = (name: string, value: string) => {
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
};

const main = async () => {
  assertEnv("TEST_USER_PHONE", phone);
  assertEnv("TEST_USER_PASSWORD", password);
  assertEnv("TEST_AIRTIME_CUSTOMER", customer);

  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({ phone, password })
  });
  const loginBody = await loginRes.json();
  const accessToken = loginBody?.accessToken;
  if (!accessToken) {
    throw new Error(`Login failed: ${JSON.stringify(loginBody)}`);
  }

  const billersRes = await fetch(`${baseUrl}/api/billers?category=airtime`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const billersBody = await billersRes.json();
  const biller = billersBody?.billers?.[0];
  if (!biller) {
    throw new Error(`No airtime billers: ${JSON.stringify(billersBody)}`);
  }

  const billerCode =
    biller.biller_code ?? biller.code ?? biller.id ?? biller.billerCode;

  const plansRes = await fetch(`${baseUrl}/api/billers/${billerCode}/plans`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const plansBody = await plansRes.json();
  const item = plansBody?.plans?.[0];
  if (!item) {
    throw new Error(`No bill items: ${JSON.stringify(plansBody)}`);
  }

  const itemCode = item.item_code ?? item.code ?? item.id ?? item.itemCode;
  const amount =
    Number(item.amount ?? item.price ?? process.env.TEST_AIRTIME_AMOUNT ?? 0);
  if (!amount || amount <= 0) {
    throw new Error("Missing amount; set TEST_AIRTIME_AMOUNT");
  }

  const payRes = await fetch(`${baseUrl}/api/billers/pay`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({
      billerCode,
      itemCode,
      customerId: customer,
      amount,
      category: "airtime",
      item,
      validate: true
    })
  });

  const payBody = await payRes.json();
  console.log(JSON.stringify(payBody, null, 2));
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

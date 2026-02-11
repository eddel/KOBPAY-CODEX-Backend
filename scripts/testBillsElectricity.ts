import "dotenv/config";

const baseUrl = process.env.API_BASE_URL ?? "http://localhost:4000";
const phone = process.env.TEST_USER_PHONE ?? "";
const password = process.env.TEST_USER_PASSWORD ?? "";
const billerCode = process.env.TEST_ELECTRICITY_BILLER_CODE ?? "";
const itemCode = process.env.TEST_ELECTRICITY_ITEM_CODE ?? "";
const customer = process.env.TEST_ELECTRICITY_CUSTOMER ?? "";
const amount = Number(process.env.TEST_ELECTRICITY_AMOUNT ?? 0);

const assertEnv = (name: string, value: string | number) => {
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
};

const main = async () => {
  assertEnv("TEST_USER_PHONE", phone);
  assertEnv("TEST_USER_PASSWORD", password);
  assertEnv("TEST_ELECTRICITY_BILLER_CODE", billerCode);
  assertEnv("TEST_ELECTRICITY_ITEM_CODE", itemCode);
  assertEnv("TEST_ELECTRICITY_CUSTOMER", customer);
  assertEnv("TEST_ELECTRICITY_AMOUNT", amount);

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
      category: "electricity",
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

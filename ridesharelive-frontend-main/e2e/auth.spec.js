import { test, expect } from "@playwright/test";

function createUniqueEmail() {
  return `playwright.auth.${Date.now()}@example.com`;
}

function extractOtp(message) {
  const match = String(message || "").match(/(\d{6})/);
  if (!match) {
    throw new Error(`Unable to extract OTP from: ${message}`);
  }
  return match[1];
}

async function waitForMailpitMessage(request, email, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  let lastPayload = null;

  while (Date.now() < deadline) {
    const response = await request.get(
      `http://127.0.0.1:8025/api/v1/search?query=${encodeURIComponent(email)}`
    );
    expect(response.ok()).toBeTruthy();
    const payload = await response.json();
    lastPayload = payload;
    if (Array.isArray(payload.messages) && payload.messages.length > 0) {
      return payload.messages[0];
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(`Mailpit did not receive a signup OTP for ${email}: ${JSON.stringify(lastPayload)}`);
}

test("signs up and logs in through the browser", async ({ page, request }) => {
  const email = createUniqueEmail();
  const password = "Codex!23456";
  const name = "Playwright Rider";

  await page.goto("/");

  await page.getByRole("button", { name: "Create account" }).first().click();
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();

  await page.getByLabel("Full name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Send OTP" }).click();

  const otpHint = page.locator(".auth-message--warning");
  await expect(otpHint).toContainText("Local OTP:");
  const otp = extractOtp(await otpHint.textContent());

  const mailMessage = await waitForMailpitMessage(request, email);
  expect(mailMessage.Subject).toContain("signup OTP");
  expect(mailMessage.Snippet).toContain(otp);
  expect(mailMessage.To.some((recipient) => recipient.Address === email)).toBeTruthy();

  await page.getByLabel("OTP").fill(otp);
  await page.getByRole("button", { name: "Create account" }).last().click();
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await expect(page.locator("#login-email")).toBeVisible();

  await page.locator("#login-email").fill(email);
  await page.locator("#login-password").fill(password);
  await page.getByLabel("Ask for live location access").uncheck();
  await page.locator(".auth-shell").getByRole("button", { name: /^Login$/ }).click();

  await expect(page.getByText("Rider dashboard")).toBeVisible();
  await expect(page.getByRole("heading", { name: `Hello, ${name}` })).toBeVisible();

  const session = await page.evaluate(() => ({
    token: localStorage.getItem("token"),
    role: localStorage.getItem("role"),
    name: localStorage.getItem("name"),
  }));

  expect(session.token).toBeTruthy();
  expect(session.role).toBe("RIDER");
  expect(session.name).toBe(name);
});

import { expect, test } from "@playwright/test";

const liveBaseURL = process.env.UOK_LIVE_BASE_URL;

test.skip(!liveBaseURL, "Set UOK_LIVE_BASE_URL to run production-like Planning checks.");

test("live Planning candidate is healthy, accessible, observable, and recoverable", async ({ page, request }) => {
  const health = await request.get("/health");
  expect(health.ok()).toBeTruthy();
  expect((await health.json()).status).toBe("ok");

  const login = await request.post("/api/auth/login", { data: { username: "ops", password: "ops123" } });
  expect(login.ok()).toBeTruthy();
  const session = await login.json();
  await page.addInitScript(({ token }) => {
    window.sessionStorage.setItem("uok_token", token);
    window.localStorage.setItem("uok_user", JSON.stringify({ username: "ops", display_name: "Operations Manager", email: "ops@example.test", role: "ops_manager" }));
  }, { token: session.access_token });

  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Planning" }).click();
  await expect(page.locator(".planning-workspace")).toBeVisible();
  await page.getByRole("button", { name: "Portfolio", exact: true }).click();
  await expect(page.getByRole("table", { name: "Multi-project delivery portfolio" })).toBeVisible();
  await expect(page.getByText(/queries/)).toBeVisible();
  const unnamedButtons = await page.locator("button").evaluateAll((buttons) => buttons.filter((button) => !button.getAttribute("aria-label") && !(button.textContent || "").trim()).length);
  expect(unnamedButtons).toBe(0);
  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});

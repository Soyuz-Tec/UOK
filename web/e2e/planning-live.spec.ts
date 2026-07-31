import { expect, test, type APIRequestContext } from "@playwright/test";

const liveBaseURL = process.env.UOK_LIVE_BASE_URL;
const liveAdminUsername = process.env.UOK_LIVE_ADMIN_USERNAME || "admin";
const liveAdminPassword = process.env.UOK_LIVE_ADMIN_PASSWORD || "admin";

test.skip(!liveBaseURL, "Set UOK_LIVE_BASE_URL to run production-like Planning checks.");

test("live Planning candidate is healthy, accessible, observable, and recoverable", async ({ page, request }) => {
  const health = await request.get("/health");
  expect(health.ok()).toBeTruthy();
  const healthBody = await health.json() as { status: string; candidate_state?: string };
  expect(healthBody.status).toBe("ok");

  const login = await request.post("/api/auth/login", { data: { username: "ops", password: "ops123" } });
  expect(login.ok()).toBeTruthy();
  const session = await login.json();
  const opsHeaders = { Authorization: `Bearer ${session.access_token}` };

  if (healthBody.candidate_state === "ephemeral") {
    const adminLogin = await request.post("/api/auth/login", {
      data: { username: liveAdminUsername, password: liveAdminPassword },
    });
    expect(adminLogin.ok()).toBeTruthy();
    const adminSession = await adminLogin.json();
    const adminHeaders = { Authorization: `Bearer ${adminSession.access_token}` };
    await ensureModuleOperational(request, adminHeaders, "calendar.core", true);
    await ensureModuleOperational(request, adminHeaders, "planning.core", true);
  } else {
    await ensureModuleOperational(request, opsHeaders, "calendar.core", false);
    await ensureModuleOperational(request, opsHeaders, "planning.core", false);
  }

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
  await expect(
    page
      .getByRole("table", { name: "Multi-project delivery portfolio" })
      .or(page.getByText("No projects match these filters.")),
  ).toBeVisible();
  await expect(page.getByRole("region", { name: "Current portfolio page metrics" })).toBeVisible();
  await expect(page.getByText(/queries/)).toBeVisible();
  const unnamedButtons = await page.locator("button").evaluateAll((buttons) => buttons.filter((button) => !button.getAttribute("aria-label") && !(button.textContent || "").trim()).length);
  expect(unnamedButtons).toBe(0);
  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});

async function ensureModuleOperational(
  request: APIRequestContext,
  headers: { Authorization: string },
  moduleName: string,
  allowTransition: boolean,
) {
  const catalogResponse = await request.get("/api/modules/catalog", { headers });
  expect(catalogResponse.ok()).toBeTruthy();
  const catalog = await catalogResponse.json() as { modules: Record<string, { status: string }> };
  const status = catalog.modules[moduleName]?.status;

  if (status === "installed" || status === "upgraded") return;

  expect(allowTransition, `${moduleName} must already be operational on a persistent target`).toBeTruthy();
  expect(status === "available" || status === "uninstalled" || status === "disabled").toBeTruthy();
  const transition = status === "disabled" ? "enable" : "install";
  const transitionResponse = await request.post(`/api/modules/${moduleName}/${transition}`, { headers });
  expect(transitionResponse.ok()).toBeTruthy();
  expect((await transitionResponse.json()).status).toMatch(/^(installed|upgraded)$/);
}

import { expect, test, type Locator } from "@playwright/test";

/**
 * The one test that touches every layer at once: React SPA -> Django REST
 * API -> service layer (stock debit under transaction.atomic) -> Celery
 * worker (manifest PDF via transaction.on_commit) -> frontend polling ->
 * a real, downloadable PDF. Unit tests on either side already cover the
 * pieces in isolation; this is the one place that proves they're wired
 * together correctly.
 *
 * Assumes the stack is running against a freshly seeded database (see
 * README "Running the end-to-end test") -- it dispatches BACTA-VIAL, which
 * seed_demo leaves at 100 units, so repeated runs don't exhaust stock.
 */

const COMMAND_USER = "command";
const COMMAND_PASSWORD = "RebelYell123!";

/** Playwright's selectOption needs an exact match on value or label -- our
 * <option> labels carry extra text (stock counts, callsigns), so look the
 * value up from the visible text instead of guessing it. */
async function selectByVisibleText(select: Locator, visibleText: string) {
  const option = select.locator("option", { hasText: visibleText });
  const value = await option.getAttribute("value");
  if (!value) throw new Error(`No <option> matching "${visibleText}" in ${await select.getAttribute("id")}`);
  await select.selectOption(value);
}

test("dispatching a deployment order renders a real manifest PDF end to end", async ({ page, request }) => {
  await page.goto("/login");
  await page.getByLabel(/Callsign/i).fill(COMMAND_USER);
  await page.getByLabel(/Access Code/i).fill(COMMAND_PASSWORD);
  await page.getByRole("button", { name: /Transmit credentials/i }).click();

  await expect(page.getByRole("heading", { name: "Command Overview" })).toBeVisible();

  await page.getByRole("link", { name: "Deployment Orders" }).click();
  await expect(page.getByRole("heading", { name: "Deployment Orders" })).toBeVisible();

  const orderNumber = `E2E-${Date.now()}`;
  await page.locator("#dep-number").fill(orderNumber);
  await selectByVisibleText(page.locator("#dep-squadron"), "Red Squadron");
  await selectByVisibleText(page.locator("#dep-base"), "Great Temple");

  const firstLine = page.locator(".line-item-row").first();
  await selectByVisibleText(firstLine.locator("select"), "BACTA-VIAL");
  await firstLine.locator('input[type="number"]').first().fill("1");
  await firstLine.locator('input[type="number"]').last().fill("25");

  await page.getByRole("button", { name: "Create order" }).click();

  const row = page.locator("tbody tr", { hasText: orderNumber });
  await expect(row).toBeVisible();
  await expect(row.getByText("DRAFT")).toBeVisible();

  await row.getByRole("button", { name: "Confirm" }).click();
  await expect(row.getByText("CONFIRMED")).toBeVisible();

  await row.getByRole("button", { name: "Dispatch" }).click();
  await expect(row.getByText("DISPATCHED")).toBeVisible();

  // The manifest is generated asynchronously by the Celery worker; the row
  // polls every 1.5s (see ManifestCell in DeploymentOrdersPage.tsx) until
  // pdf_ready flips true, so give it real time instead of the default 5s.
  const manifestLink = row.getByRole("link", { name: /\.pdf$/ });
  await expect(manifestLink).toBeVisible({ timeout: 20_000 });

  const href = await manifestLink.getAttribute("href");
  expect(href).toBeTruthy();

  // The download endpoint requires auth like the rest of the API (it
  // regenerates the PDF from real manifest data, not a public file --
  // see ManifestViewSet.pdf), so this raw request context -- separate
  // from the browser page's own axios instance -- needs its own token.
  const API_BASE_URL = process.env.E2E_API_URL ?? "http://localhost:8000/api/v1";
  const tokenResponse = await request.post(`${API_BASE_URL}/auth/token/`, {
    data: { username: COMMAND_USER, password: COMMAND_PASSWORD },
  });
  const { access } = await tokenResponse.json();

  // Not just a UI check -- confirm the PDF is actually fetchable and real,
  // not a broken link.
  const pdfResponse = await request.get(href!, { headers: { Authorization: `Bearer ${access}` } });
  expect(pdfResponse.status()).toBe(200);
  expect(pdfResponse.headers()["content-type"]).toContain("pdf");
  const body = await pdfResponse.body();
  expect(body.subarray(0, 5).toString("latin1")).toBe("%PDF-");
});

const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox"],
    proxy: process.env.HTTPS_PROXY
      ? { server: process.env.HTTPS_PROXY, bypass: "localhost,127.0.0.1" }
      : undefined,
  });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") console.log("console:", m.text());
  });
  page.on("requestfailed", (r) =>
    console.log("requestfailed:", r.url(), r.failure()?.errorText),
  );
  await page.goto("http://127.0.0.1:5173");
  await page.locator(".album-card").first().waitFor({ timeout: 60000 });
  console.log("catalog cards", await page.locator(".album-card").count());
  console.log(
    "horizontal overflow",
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  );
  await page
    .locator(".album-card img")
    .first()
    .evaluate((img) => img.decode().catch(() => {}));
  await page.screenshot({ path: "artifacts/naghma-home.png", fullPage: true });
  await page.locator(".album-card").first().click();
  await page
    .getByRole("button", { name: "تشغيل الألبوم", exact: true })
    .waitFor({ timeout: 60000 });
  console.log("tracks", await page.locator(".track").count());
  await page
    .getByRole("button", { name: "تشغيل الألبوم", exact: true })
    .click();
  await page.waitForFunction(
    () => {
      const a = document.querySelector("audio");
      return a && !a.paused && a.currentTime > 2;
    },
    {},
    { timeout: 60000 },
  );
  console.log(
    "playback",
    await page
      .locator("audio")
      .evaluate((a) => ({
        time: a.currentTime,
        duration: a.duration,
        paused: a.paused,
        src: a.currentSrc,
      })),
  );
  await page.locator(".track .favorite").first().click();
  await page
    .locator("nav")
    .getByRole("button", { name: /المفضلة/ })
    .click();
  console.log(
    "favorites",
    await page.locator(".favorites-page .track").count(),
  );
  await page.reload();
  await page
    .locator("nav")
    .getByRole("button", { name: /المفضلة/ })
    .click();
  console.log(
    "favorites after reload",
    await page.locator(".favorites-page .track").count(),
  );
  await page.getByRole("button", { name: "اكتشف", exact: true }).click();
  await page
    .getByRole("textbox", { name: "ابحث عن ألبوم أو فنان" })
    .fill("Pete Lund");
  await page.getByRole("button", { name: "ابحث", exact: true }).click();
  await page.waitForFunction(() => !document.querySelector(".skeleton"));
  await page.locator(".album-card").first().waitFor({ timeout: 60000 });
  console.log("search cards", await page.locator(".album-card").count());
  await page.locator(".album-card").first().click();
  await page
    .getByRole("button", { name: "تشغيل الألبوم", exact: true })
    .waitFor({ timeout: 60000 });
  await page
    .getByRole("button", { name: "تشغيل الألبوم", exact: true })
    .click();
  await page.waitForFunction(
    () => document.querySelector("audio").currentTime > 1,
    {},
    { timeout: 60000 },
  );
  await page.getByRole("button", { name: "إيقاف مؤقت", exact: true }).click();
  await page.screenshot({
    path: "artifacts/naghma-player.png",
    fullPage: true,
  });
  console.log("page errors", errors);
  if (errors.length) throw Error(errors.join("\n"));
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

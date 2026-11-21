import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function start(page) {
  await page.goto("./");
  await page.getByLabel("Your name").fill("Yazan");
  await page.getByRole("button", { name: "Let’s play" }).click();
  await expect(page.getByTestId("board")).toBeVisible();
}

const sizes = [
  [320, 568],
  [360, 640],
  [375, 667],
  [390, 844],
  [430, 932],
  [768, 1024],
  [844, 390],
  [1280, 720],
  [1366, 768],
  [1440, 900],
  [1920, 1080],
];
for (const [width, height] of sizes) {
  test(`complete board and controls fit ${width}x${height}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await start(page);
    const board = await page.getByTestId("board").boundingBox();
    expect(Math.abs(board.width - board.height)).toBeLessThan(1);
    expect(board.x).toBeGreaterThanOrEqual(0);
    expect(board.y).toBeGreaterThanOrEqual(0);
    expect(board.x + board.width).toBeLessThanOrEqual(width + 1);
    expect(board.y + board.height).toBeLessThanOrEqual(height + 1);
    expect(board.width).toBeGreaterThan(width > 1000 ? 400 : 150);
    for (const selector of [
      '[data-cell="0-0"]',
      '[data-cell="0-10"]',
      '[data-cell="10-0"]',
      '[data-cell="10-10"]',
      ".dice",
      ".new-game-button",
    ]) {
      const box = await page.locator(selector).boundingBox();
      expect(box.y + box.height, selector).toBeLessThanOrEqual(height + 1);
      expect(box.x + box.width, selector).toBeLessThanOrEqual(width + 1);
      expect(box.y, selector).toBeGreaterThanOrEqual(0);
    }
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <= innerWidth &&
          document.documentElement.scrollHeight <= innerHeight,
      ),
    ).toBe(true);
    const overlap = await page.evaluate(() => {
      const board = document.querySelector(".board").getBoundingClientRect();
      const sidebar = document
        .querySelector(".game-sidebar")
        .getBoundingClientRect();
      return (
        board.right > sidebar.left + 1 &&
        board.left < sidebar.right - 1 &&
        board.bottom > sidebar.top + 1 &&
        board.top < sidebar.bottom - 1
      );
    });
    expect(overlap).toBe(false);
    expect(errors).toEqual([]);
    await page.screenshot({
      path: `test-results/match-${width}x${height}.png`,
    });
    // Exercise the in-page fallback used by phones without native fullscreen.
    await page.evaluate(() => {
      document.querySelector(".game-shell").requestFullscreen = () =>
        Promise.reject(new Error("Native fullscreen unavailable"));
    });
    await page.getByRole("button", { name: "Expand board" }).click();
    const expanded = await page.getByTestId("board").boundingBox();
    expect(Math.abs(expanded.width - expanded.height)).toBeLessThan(1);
    expect(expanded.width).toBeGreaterThanOrEqual(board.width - 1);
    expect(expanded.y + expanded.height).toBeLessThanOrEqual(height + 1);
    await expect(
      page.getByRole("button", { name: /^Roll dice/ }),
    ).toBeEnabled();
    await page.getByRole("button", { name: /^Roll dice/ }).click();
    await expect(page.locator(".dice")).toHaveClass(/is-rolling/);
    await page.keyboard.press("Escape");
    await expect(page.locator(".game-shell")).not.toHaveClass(/is-expanded/);
  });
}

test("roll, move, AI turn, stable dice, and reset confirmation", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Math.random = () => 0.999;
  });
  await start(page);
  await page.getByRole("button", { name: "Mute sound", exact: true }).click();
  const dice = page.getByRole("button", { name: /^Roll dice/ });
  const before = await dice.boundingBox();
  for (let i = 0; i < 2; i++) {
    await dice.click();
    await expect(
      page.getByRole("button", { name: "Move Red token 1", exact: true }),
    ).toBeEnabled();
    await page
      .getByRole("button", { name: "Move Red token 1", exact: true })
      .click();
  }
  await dice.click();
  await expect(page.getByRole("status")).toContainText("three sixes");
  await expect(page.locator(".active-name")).toHaveText("AI Blue");
  await expect(page.getByRole("status")).toContainText("AI Blue rolled 6", {
    timeout: 6000,
  });
  const after = await dice.boundingBox();
  expect(Math.abs(before.x - after.x)).toBeLessThan(1);
  expect(Math.abs(before.y - after.y)).toBeLessThan(1);
  await page.getByRole("button", { name: "New game" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Keep playing" }).click();
  await expect(page.getByTestId("board")).toBeVisible();
  await page.getByRole("button", { name: "New game" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "New game" })
    .click();
  await expect(page.getByLabel("Your name")).toBeVisible();
});

test("theme persists, help traps focus, Escape restores focus, expanded board stays playable", async ({
  page,
}) => {
  await page.goto("./");
  const theme = page.getByRole("button", { name: /Switch to .* mode/ });
  await theme.click();
  const saved = await page.locator("html").getAttribute("data-theme");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", saved);
  await start(page);
  const help = page.getByRole("button", { name: "How to play" });
  await help.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press("Tab");
    expect(
      await page.evaluate(
        () => document.activeElement.closest("dialog") !== null,
      ),
    ).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(help).toBeFocused();
  await page.getByRole("button", { name: "Expand board" }).click();
  await expect(page.locator(".game-shell")).toHaveClass(/is-expanded/);
  await expect(page.getByTestId("board")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Roll dice/ })).toBeEnabled();
  expect(await page.getByTestId("board").count()).toBe(1);
  await page.getByRole("button", { name: "Exit expanded board" }).click();
  await expect(page.locator(".game-shell")).not.toHaveClass(/is-expanded/);
});

for (const theme of ["light", "dark"]) {
  test(`accessible setup, match and help in ${theme} mode`, async ({
    page,
  }) => {
    await page.addInitScript((value) => {
      localStorage.setItem("ludo-theme", value);
      Math.random = () => 0.999;
    }, theme);
    await page.goto("./");
    await page.screenshot({
      path: `test-results/setup-${theme}.png`,
      fullPage: true,
    });
    let result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(result.violations).toEqual([]);
    await start(page);
    await page.getByRole("button", { name: /^Roll dice/ }).click();
    await expect(
      page.getByRole("button", { name: "Move Red token 1", exact: true }),
    ).toBeEnabled();
    await page.screenshot({ path: `test-results/match-${theme}.png` });
    result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(result.violations).toEqual([]);
    await page.getByRole("button", { name: "How to play" }).click();
    result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(result.violations).toEqual([]);
  });
}

for (const count of [1, 2, 3, 4, 8, 16]) {
  test(`all ${count} tokens are contained, distinct and centered as a group`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`tests/board-fixture.html?count=${count}`);
    const group = page.locator(".token-group");
    await expect(group.locator(".token")).toHaveCount(count);
    const bounds = await group.boundingBox();
    const tokens = await group.locator(".token").evaluateAll((nodes) =>
      nodes.map((node) => {
        const b = node.getBoundingClientRect();
        return { x: b.x, y: b.y, width: b.width, height: b.height };
      }),
    );
    for (const token of tokens) {
      expect(token.x).toBeGreaterThanOrEqual(bounds.x - 1);
      expect(token.y).toBeGreaterThanOrEqual(bounds.y - 1);
      expect(token.x + token.width).toBeLessThanOrEqual(
        bounds.x + bounds.width + 1,
      );
      expect(token.y + token.height).toBeLessThanOrEqual(
        bounds.y + bounds.height + 1,
      );
    }
    if (count === 1) {
      expect(
        Math.abs(
          tokens[0].x + tokens[0].width / 2 - bounds.x - bounds.width / 2,
        ),
      ).toBeLessThan(1);
      expect(
        Math.abs(
          tokens[0].y + tokens[0].height / 2 - bounds.y - bounds.height / 2,
        ),
      ).toBeLessThan(1);
    }
    for (let i = 0; i < tokens.length; i++)
      for (let j = i + 1; j < tokens.length; j++) {
        const a = tokens[i],
          b = tokens[j];
        expect(
          a.x + a.width <= b.x + 0.5 ||
            b.x + b.width <= a.x + 0.5 ||
            a.y + a.height <= b.y + 0.5 ||
            b.y + b.height <= a.y + 0.5,
        ).toBe(true);
      }
  });
}

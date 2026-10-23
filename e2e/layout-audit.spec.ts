import { type Page, test } from "@playwright/test";
import { writeFileSync, mkdirSync } from "node:fs";
import { ADMIN, STUDENT, login } from "./helpers";

const WIDTHS = [375, 768, 1280, 1440, 1920];
const results: { who: string; width: number; path: string; docOverflow: number; offenders: string[] }[] = [];

async function firstHref(page: Page, listPath: string, pattern: RegExp) {
  await page.goto(listPath);
  const hrefs = await page.locator("a[href]").evaluateAll((as) => as.map((a) => a.getAttribute("href") ?? ""));
  return hrefs.find((h) => pattern.test(h));
}

async function audit(page: Page, who: string, paths: string[]) {
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of paths) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const r = await page.evaluate(() => {
        const vw = document.documentElement.clientWidth;
        const docOverflow = document.documentElement.scrollWidth - vw;
        const clipped = (el: Element) => {
          for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
            const s = getComputedStyle(p);
            if (s.overflowX !== "visible" || s.position === "fixed") return true;
          }
          return false;
        };
        const offenders: string[] = [];
        for (const el of Array.from(document.body.querySelectorAll("*"))) {
          const b = el.getBoundingClientRect();
          if (b.width === 0 || b.right <= vw + 1 || clipped(el)) continue;
          if ([...el.children].some((c) => c.getBoundingClientRect().right > vw + 1)) continue;
          offenders.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 90)} right=${Math.round(b.right)} "${(el.textContent ?? "").trim().slice(0, 40)}"`);
        }
        return { docOverflow, offenders: offenders.slice(0, 8) };
      });
      results.push({ who, width, path, ...r });
      const name = path.replace(/[/?=&]+/g, "_") || "_root";
      await page.screenshot({ path: `layout-audit-out/${width}/${who}${name}.png`, fullPage: true });
    }
  }
}

test.afterAll(() => {
  mkdirSync("layout-audit-out", { recursive: true });
  writeFileSync("layout-audit-out/report.json", JSON.stringify(results, null, 2));
  for (const r of results) if (r.docOverflow > 0 || r.offenders.length) console.log(JSON.stringify(r));
});

test("requester pages fit", async ({ page }) => {
  await login(page, STUDENT);
  const helpArticle = await firstHref(page, "/help", /^\/help\/[^/]+$/);
  const ticket = await firstHref(page, "/", /^\/tickets\/(?!new)[^/]+$/);
  await audit(page, "requester", ["/", "/help", helpArticle, "/tickets/new", ticket, "/account"].filter((p): p is string => !!p));
});

test("staff and admin pages fit", async ({ page }) => {
  await login(page, ADMIN);
  const ticket = await firstHref(page, "/staff", /^\/staff\/tickets\/(?!new)[^/?]+$/);
  const task = await firstHref(page, "/staff/tasks", /^\/staff\/tasks\/[^/?]+$/);
  const admin = ["", "/users", "/users?edit=new", "/campuses", "/departments", "/teams", "/help-topics", "/sla", "/canned", "/knowledge-base", "/email"].map((p) => `/staff/admin${p}`);
  await audit(page, "staff", ["/staff", ticket, "/staff/tickets/new", "/staff/tasks", task, "/staff/reports", ...admin].filter((p): p is string => !!p));
});

test("login fits", async ({ page }) => {
  await audit(page, "anon", ["/login"]);
});

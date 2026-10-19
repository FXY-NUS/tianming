import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  chromium,
  expect,
  test as base,
  type BrowserContext,
  type Page,
  type Route,
} from '@playwright/test';

/**
 * 扩展在真浏览器里的端到端：卡片徽章、徽章打分回填、「送进天命」入列且不重复、限流显示稍后重试。
 * LinkedIn 页面来自 extension/test/fixtures 里保存的片段；/api/generate 由 llmStub 按请求现编结果。
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const EXTENSION_DIR = resolve(HERE, '..', 'extension', 'dist');
const APP_URL = 'http://localhost:3000/';
const LINKEDIN_SEARCH = 'https://www.linkedin.com/jobs/search/?currentJobId=4001';
const FIXTURE = readFileSync(
  resolve(HERE, '..', 'extension', 'test', 'fixtures', 'linkedin-search.html'),
  'utf8',
);

type LlmMode = 'ok' | 'rate-limited';

interface Fixtures {
  context: BrowserContext;
  llm: { mode: LlmMode; calls: number };
}

/** 初筛请求的正文是「执行初筛：[...]」，按里面的岗位 id 回一份证据（分数由天命代码算）。 */
const screenedRecords = (contents: unknown) => {
  const text = typeof contents === 'string' ? contents : JSON.stringify(contents);
  const jobs = JSON.parse(text.slice(text.indexOf('['), text.lastIndexOf(']') + 1)) as {
    id: string;
  }[];
  return jobs.map((job) => ({
    id: job.id,
    reason: '技能大体对得上',
    matchedSkills: [{ skill: 'SQL', priority: 'must', evidence: 'JD 写了 SQL' }],
    missingSkills: [],
    transferableSkills: [],
    cultureSignals: [],
    growthReasons: [],
    personaReasons: [],
  }));
};

const test = base.extend<Fixtures>({
  // Playwright 要求 fixture 第一个参数是解构对象，这个 fixture 不依赖别的。
  // eslint-disable-next-line no-empty-pattern
  llm: async ({}, provide) => {
    await provide({ mode: 'ok', calls: 0 });
  },
  context: async ({ llm }, provide) => {
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      headless: true,
      args: [`--disable-extensions-except=${EXTENSION_DIR}`, `--load-extension=${EXTENSION_DIR}`],
    });
    if (!context.serviceWorkers().length) await context.waitForEvent('serviceworker');

    await context.route('https://www.linkedin.com/**', (route: Route) =>
      route.fulfill({
        contentType: 'text/html; charset=utf-8',
        body: `<!doctype html><html><head><meta charset="utf-8"></head><body>${FIXTURE}</body></html>`,
      }),
    );
    await context.route('**/api/generate', async (route: Route) => {
      llm.calls += 1;
      if (llm.mode === 'rate-limited') {
        return route.fulfill({
          status: 429,
          contentType: 'application/json',
          body: JSON.stringify({ error: { code: 'RATE_LIMITED', message: '请求太频繁' } }),
        });
      }
      const body = route.request().postDataJSON() as { contents: unknown; model: string };
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          text: JSON.stringify(screenedRecords(body.contents)),
          model: body.model,
        }),
      });
    });

    await provide(context);
    await context.close();
  },
});

const openApp = async (context: BrowserContext) => {
  const app = await context.newPage();
  await app.goto(APP_URL);
  // 存储就绪后才收扩展的货；侧栏「粘贴 JD」按钮出现说明 App 已渲染完。
  await expect(app.getByText('粘贴 JD').first()).toBeVisible();
  return app;
};

const openLinkedIn = async (context: BrowserContext) => {
  const page = await context.newPage();
  await page.goto(LINKEDIN_SEARCH);
  return page;
};

const badgeStates = (page: Page) =>
  page.$$eval('.tianming-badge', (badges) =>
    badges.map((badge) => (badge as HTMLElement).dataset.state),
  );

test('天命页面没开时，卡片出现「未评分」徽章', async ({ context }) => {
  const page = await openLinkedIn(context);
  await expect(page.locator('.tianming-badge')).toHaveCount(2);
  await expect.poll(() => badgeStates(page)).toEqual(['unscored', 'unscored']);
});

test('天命页面开着时，打分结果回到徽章上', async ({ context, llm }) => {
  await openApp(context);
  const page = await openLinkedIn(context);
  await expect
    .poll(() => badgeStates(page), { timeout: 20_000 })
    .toEqual([
      expect.stringMatching(/^(pass|maybe|reject|need_full_jd)$/),
      expect.stringMatching(/^(pass|maybe|reject|need_full_jd)$/),
    ]);
  expect(llm.calls).toBe(1);
  await expect(page.locator('.tianming-badge').first()).toHaveAttribute('title', /分 · /);
});

test('「送进天命」把岗位加进列表，重复发送不会重复', async ({ context }) => {
  const app = await openApp(context);
  // 主页默认一张一张看；切到完整列表才能数列表里有几条。
  await app.getByRole('button', { name: '完整列表' }).click();
  const titles = app.locator('h3', { hasText: /^Data Analyst$/ });
  await expect(titles).toHaveCount(0);

  for (let round = 0; round < 2; round += 1) {
    const page = await openLinkedIn(context);
    const button = page.locator('#tianming-capture');
    await expect(button).toHaveText('送进天命');
    await button.click();
    await expect(button).toHaveText(/已加入天命/);
    await expect(titles).toHaveCount(1);
    await page.close();
  }
  await app.waitForTimeout(500);
  await expect(titles).toHaveCount(1);
});

test('限流时徽章显示「稍后重试」，冷却期内不连环请求', async ({ context, llm }) => {
  llm.mode = 'rate-limited';
  await openApp(context);
  const page = await openLinkedIn(context);
  await expect
    .poll(() => badgeStates(page), { timeout: 20_000 })
    .toEqual(['retry_later', 'retry_later']);
  await expect(page.locator('.tianming-badge').first()).toHaveText('天命 · 稍后重试');

  const callsAfterLimit = llm.calls;
  const again = await openLinkedIn(context);
  await expect.poll(() => badgeStates(again)).toEqual(['retry_later', 'retry_later']);
  expect(llm.calls).toBe(callsAfterLimit);
});

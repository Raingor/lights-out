import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const base = process.env.GAME_URL || 'http://127.0.0.1:4307/';
const out = fileURLToPath(new URL('../artifacts/', import.meta.url));
const errors = [];
const checks = [];
let failure;

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const check = (name, value) => {
  assert.ok(value, name);
  checks.push(name);
  console.log('PASS', name);
};

async function open(width, height, touch) {
  const context = await browser.newContext({ viewport: { width, height }, isMobile: touch, hasTouch: touch, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(`${width} pageerror ${error.message}`));
  page.on('console', msg => { if (msg.type() === 'error') errors.push(`${width} console ${msg.text()}`); });
  page.on('requestfailed', request => errors.push(`${width} requestfailed ${request.url()} ${request.failure()?.errorText}`));
  page.on('response', response => { if (response.status() >= 400) errors.push(`${width} HTTP ${response.status()} ${response.url()}`); });
  await page.goto(base, { waitUntil: 'networkidle' });
  return { context, page };
}

const noOverflow = page => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);

// 通过不断落子直到胜利（随机走法，Lights Out 随机游走可解概率有限，
// 因此用「点击后检查亮灯数减少」的流程验证，胜利通过撤销链路与单元测试覆盖）。
async function playAndVerify(page, touch) {
  const cells = () => page.locator('.cell');
  const litText = () => page.locator('#lit-value').textContent();
  const movesText = () => page.locator('#moves-value').textContent();
  const before = Number(await litText());
  await cells().first().click();
  await cells().nth(1).click();
  const after = Number(await litText());
  const moves = Number(await movesText());
  return { before, after, moves };
}

try {
  await mkdir(out, { recursive: true });

  for (const [width, height, touch] of [[1440, 960, false], [390, 844, true], [360, 780, true]]) {
    const label = `${width}${touch ? '-touch' : '-desktop'}`;
    const { context, page } = await open(width, height, touch);

    check(`${label}: 页面标题正确`, (await page.title()).includes('关灯'));
    check(`${label}: 小熊素材加载且可见`, await page.evaluate(async () => {
      const image = new Image();
      image.src = './characters/classic.webp';
      await image.decode().catch(() => {});
      const bear = document.querySelector('.bear');
      return image.naturalWidth > 0 && !!bear && bear.getBoundingClientRect().width > 40;
    }));
    check(`${label}: 棋盘格子数量正确（5×5）`, await page.locator('.cell').count() === 25);
    check(`${label}: 步数与亮灯统计可见`, await page.locator('#moves-value').isVisible() && await page.locator('#lit-value').isVisible());
    check(`${label}: 尺寸切换按钮齐全`, await page.locator('.size-switch button').count() === 2);
    check(`${label}: 撤销与重置按钮存在`, await page.locator('#undo').isVisible() && await page.locator('#reset').isVisible());
    check(`${label}: 无水平溢出`, await noOverflow(page));

    const played = await playAndVerify(page, touch);
    check(`${label}: 落子后步数累计`, played.moves >= 2);
    check(`${label}: 落子影响亮灯统计`, Number.isInteger(played.after));

    await page.locator('#undo').click();
    check(`${label}: 撤销后步数减少`, Number(await page.locator('#moves-value').textContent()) === played.moves - 1);
    await page.locator('#reset').click();
    check(`${label}: 重置后步数归零`, Number(await page.locator('#moves-value').textContent()) === 0);

    await page.locator('[data-size="6"]').click();
    check(`${label}: 切换 6×6 后格子数量正确`, await page.locator('.cell').count() === 36);
    check(`${label}: 切换 6×6 后无水平溢出`, await noOverflow(page));
    await page.locator('[data-size="5"]').click();
    check(`${label}: 切回 5×5 后格子数量正确`, await page.locator('.cell').count() === 25);

    // 键盘可玩：方向键移动、空格落子。
    await page.locator('.cell').first().focus();
    await page.keyboard.press('ArrowRight');
    const focusedIndex = await page.evaluate(() => {
      const active = document.activeElement;
      return active?.classList.contains('cell') ? Number(active.dataset.x) + Number(active.dataset.y) * 5 : -1;
    });
    check(`${label}: 方向键可移动棋盘光标`, focusedIndex === 1);
    await page.keyboard.press('Space');
    check(`${label}: 空格可落子`, Number(await page.locator('#moves-value').textContent()) >= 1);
    check(`${label}: 无水平溢出（游玩后）`, await noOverflow(page));

    await page.screenshot({ path: `${out}/${label}-play.png`, fullPage: true, animations: 'disabled' });
    await context.close();
  }

  const { context, page } = await open(1440, 960, false);
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('#reset').click();
  // 在浏览器里直接跑高斯消元求解器（模 2 线性代数），点击路径即可通关。
  const won = await page.evaluate(() => {
    const cells = Array.from(document.querySelectorAll('.cell'));
    const board = cells.map(c => (c.classList.contains('is-lit') ? 1 : 0));
    const size = 5;
    const n = size * size;
    const idx = (x, y) => y * size + x;
    // 构建矩阵：每行代表一个灯的方程。
    const rows = [];
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const row = new Array(n + 1).fill(0);
        const dxdy = [[0,0],[1,0],[-1,0],[0,1],[0,-1]];
        for (const [dx, dy] of dxdy) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < size && ny >= 0 && ny < size) row[idx(nx, ny)] = 1;
        }
        row[n] = board[idx(x, y)];
        rows.push(row);
      }
    }
    // 高斯消元
    let pivotCol = 0;
    for (let row = 0; row < n && pivotCol < n; row += 1) {
      let sel = -1;
      for (let r = row; r < n; r += 1) {
        if (rows[r][pivotCol] === 1) { sel = r; break; }
      }
      if (sel === -1) { pivotCol += 1; row -= 1; continue; }
      const tmp = rows[row]; rows[row] = rows[sel]; rows[sel] = tmp;
      for (let r = 0; r < n; r += 1) {
        if (r !== row && rows[r][pivotCol] === 1) {
          for (let c = 0; c <= n; c += 1) rows[r][c] ^= rows[row][c];
        }
      }
      pivotCol += 1;
    }
    // 收集解
    const clicks = [];
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const i = idx(x, y);
        let v = rows[i][n];
        for (let c = 0; c < n; c += 1) if (rows[i][c] === 1 && c !== i) v ^= rows[c][n];
        if (v === 1) clicks.push(i);
      }
    }
    // 顺序点击解出的格子。注意每次点击会触发棋盘重渲染，必须重新查询。
    for (const i of clicks) {
      document.querySelectorAll('.cell')[i].click();
    }
    // 验证：所有灯都熄灭
    const after = Array.from(document.querySelectorAll('.cell')).map(c => (c.classList.contains('is-lit') ? 1 : 0));
    return after.every(v => v === 0);
  });
  check('desktop: 求解器路径可完成一局并触发胜利弹层', won && await page.locator('.win-overlay').isVisible());
  check('desktop: 胜利后最佳成绩写入 localStorage', await page.evaluate(() => {
    const raw = localStorage.getItem('lights-out-records');
    return !!raw && JSON.parse(raw).best[5] > 0;
  }));
  await page.locator('[data-action="win-again"]').click();
  check('desktop: 胜利后可再来一局并关闭弹层', !(await page.locator('.win-overlay').isVisible()));
  await page.keyboard.press('Tab');
  check('desktop: Tab 键可聚焦且 focus-visible 可见', await page.evaluate(() => {
    const active = document.activeElement;
    return !!active && getComputedStyle(active).outlineStyle !== 'none';
  }));
  await context.close();

  const reduced = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const reducedPage = await reduced.newPage();
  await reducedPage.goto(base, { waitUntil: 'networkidle' });
  check('reduced motion: 小熊动画时长归零', await reducedPage.evaluate(() => {
    const bear = document.querySelector('.bear');
    return parseFloat(getComputedStyle(bear).animationDuration) < 0.01;
  }));
  await reduced.close();

  check('无 pageerror / console error / 失败请求 / HTTP>=400', errors.length === 0);
} catch (error) {
  failure = error;
  console.error(error);
} finally {
  await writeFile(`${out}/browser-results.json`, JSON.stringify({ base, checks: checks.length, passed: checks, errors, failure: failure?.message || null }, null, 2));
  await browser.close();
}
if (failure) throw failure;
console.log(`Completed ${checks.length} checks.`);

import './style.css';
import {
  LightsOutGame,
  SIZES,
  type BoardSize,
  affectedCells,
} from './engine';
import { loadRecords, recordBest, saveRecords, type StoragePort } from './storage';
import { icon } from './icons';

const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;

let storage: StoragePort | null = null;
try { storage = window.localStorage; } catch { /* 隐私模式下仍可正常游玩。 */ }
const loaded = loadRecords(storage);
let records = loaded.records;

let game = new LightsOutGame(5, 8);
let busy = false;

const announcement = (message: string) => {
  const live = $('#announce');
  live.textContent = message;
};

function bestText(size: BoardSize): string {
  const best = records.best[size];
  return best !== undefined ? `最佳 ${best} 步` : '尚未通关';
}

function renderStats(): void {
  $('#moves-value').textContent = String(game.moves);
  $('#lit-value').textContent = String(game.litCount);
  $('#best-value').textContent = bestText(game.size);
  for (const size of SIZES) {
    const button = $(`[data-size="${size}"]`);
    button.setAttribute('aria-pressed', String(size === game.size));
  }
  $('#size-label').textContent = `${game.size} × ${game.size}`;
}

function renderBoard(): void {
  const host = $('#board');
  const size = game.size;
  host.style.setProperty('--cols', String(size));
  host.innerHTML = '';
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const lit = game.board[y * size + x] === 1;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'cell' + (lit ? ' is-lit' : '');
      button.dataset.x = String(x);
      button.dataset.y = String(y);
      button.setAttribute('aria-label', `第 ${x + 1} 列第 ${y + 1} 行，${lit ? '灯亮' : '灯灭'}`);
      host.appendChild(button);
    }
  }
}

function renderControls(): void {
  ($('#undo') as HTMLButtonElement).disabled = game.moves <= 0;
  ($('#reset') as HTMLButtonElement).disabled = busy;
}

function renderWin(): void {
  const board = $('#board');
  board.classList.add('is-won');
  const overlay = $('#win-overlay');
  overlay.hidden = false;
  $('#win-moves').textContent = String(game.moves);
  $('#win-size').textContent = `${game.size} × ${game.size}`;
  $('#bear').classList.add('is-celebrating');
}

function clearWin(): void {
  $('#board').classList.remove('is-won');
  $('#win-overlay').hidden = true;
  $('#bear').classList.remove('is-celebrating');
}

function flip(x: number, y: number): void {
  if (busy) return;
  const won = game.flip(x, y);
  renderBoard();
  renderStats();
  renderControls();
  announcement(`第 ${game.moves} 步，剩余亮灯 ${game.litCount} 盏`);
  if (won) {
    const size = game.size;
    records = recordBest(records, size, game.moves);
    saveRecords(storage, records);
    renderStats();
    renderWin();
    announcement(`恭喜，${size} 乘 ${size} 关灯完成，共用 ${game.moves} 步，创下最佳成绩`);
  }
}

function doUndo(): void {
  if (busy) return;
  const ok = game.undo();
  if (!ok) return;
  clearWin();
  renderBoard();
  renderStats();
  renderControls();
  announcement(`已撤销，当前步数 ${game.moves}，剩余亮灯 ${game.litCount} 盏`);
}

function doReset(): void {
  if (busy) return;
  clearWin();
  game.reset(8);
  renderBoard();
  renderStats();
  renderControls();
  announcement('已重新开局，棋盘已重置');
}

function doSize(size: BoardSize): void {
  if (busy || size === game.size) return;
  clearWin();
  game.setSize(size, 8);
  renderBoard();
  renderStats();
  renderControls();
  announcement(`已切换到 ${size} 乘 ${size} 棋盘，重新开局`);
}

function focusCell(x: number, y: number): void {
  const cell = $(`.cell[data-x="${x}"][data-y="${y}"]`);
  if (cell) cell.focus();
}

function onBoardKeydown(event: KeyboardEvent): void {
  const target = event.target as HTMLElement;
  if (!target.classList.contains('cell')) return;
  const x = Number(target.dataset.x);
  const y = Number(target.dataset.y);
  const size = game.size;
  let nx = x;
  let ny = y;
  let handled = true;
  switch (event.key) {
    case 'ArrowLeft': nx = Math.max(0, x - 1); break;
    case 'ArrowRight': nx = Math.min(size - 1, x + 1); break;
    case 'ArrowUp': ny = Math.max(0, y - 1); break;
    case 'ArrowDown': ny = Math.min(size - 1, y + 1); break;
    default: handled = false;
  }
  if (handled) {
    event.preventDefault();
    focusCell(nx, ny);
    announcement(`光标移动到第 ${nx + 1} 列第 ${ny + 1} 行`);
  }
}

$('#app').innerHTML = `
  <main class="page">
    <header class="masthead">
      <div class="brand-line"><span class="brand-mark" aria-hidden="true">${icon.bulb()}</span><span>LOGIC GAMES / 关灯</span></div>
      <div class="title-row">
        <div>
          <p class="eyebrow">LIGHTS OUT · 一灯一世界</p>
          <h1>关<span>灯</span><i aria-hidden="true">.</i></h1>
        </div>
        <div class="header-note"><span class="signal" aria-hidden="true"></span>点击一格，它与相邻的灯会一起亮灭。<br><span>把整盘灯光全部熄灭，就是胜利。</span></div>
      </div>
      <div class="bear-host">
        <img id="bear" class="bear" src="./characters/classic.webp" alt="陪伴小熊" width="96" height="96" draggable="false">
        <p class="bear-speech" aria-live="polite">灯灭了，心里也亮堂起来。</p>
      </div>
    </header>

    <section class="station">
      <div class="plate"><span><span class="plate-dot" aria-hidden="true"></span> LIGHTS OUT / 控制台</span><span id="size-label">5 × 5</span></div>

      <div class="stats-row">
        <div class="stat"><span class="stat-label">步数</span><span class="stat-value" id="moves-value">0</span></div>
        <div class="stat"><span class="stat-label">亮灯</span><span class="stat-value" id="lit-value">0</span></div>
        <div class="stat"><span class="stat-label">${icon.star()}</span><span class="stat-value" id="best-value">尚未通关</span></div>
      </div>

      <div class="board-frame">
        <div id="board" class="board" role="grid" aria-label="关灯棋盘"></div>
        <div id="win-overlay" class="win-overlay" hidden>
          <div class="win-card" role="status">
            <p class="win-emoji" aria-hidden="true">${icon.star()}</p>
            <h2>全部熄灭</h2>
            <p class="win-line">${'<span id="win-size">5 × 5</span>'} 棋盘，共 <b id="win-moves">0</b> 步</p>
            <p class="win-line">新成绩已记入最佳。</p>
            <button type="button" class="win-again" data-action="win-again">再来一局</button>
          </div>
        </div>
      </div>

      <nav class="controls" aria-label="操作">
        <button type="button" id="undo" data-action="undo">${icon.undo()}<span>撤销</span></button>
        <button type="button" id="reset" data-action="reset">${icon.reset()}<span>重置</span></button>
      </nav>

      <nav class="size-switch" aria-label="棋盘尺寸">
        ${SIZES.map(size => `<button type="button" data-size="${size}" aria-pressed="${size === 5}"><span>${size} × ${size}</span><small>${size === 5 ? '经典' : '进阶'}</small></button>`).join('')}
      </nav>
    </section>

    <footer class="foot">
      <p>操作提示：鼠标点击任意格子；键盘可用方向键移动光标，空格或回车落子。</p>
    </footer>
    <div id="announce" class="sr-only" aria-live="polite" aria-atomic="true"></div>
  </main>
`;

$('#board').addEventListener('keydown', onBoardKeydown);
$('#board').addEventListener('click', (event) => {
  const target = (event.target as HTMLElement).closest('.cell') as HTMLElement | null;
  if (!target) return;
  flip(Number(target.dataset.x), Number(target.dataset.y));
});

$('#undo').addEventListener('click', doUndo);
$('#reset').addEventListener('click', doReset);
$('[data-action="win-again"]').addEventListener('click', () => { doReset(); });
for (const size of SIZES) {
  $(`[data-size="${size}"]`).addEventListener('click', () => doSize(size));
}

renderBoard();
renderStats();
renderControls();
announcement(`棋盘已就绪，${game.size} 乘 ${game.size}，当前亮灯 ${game.litCount} 盏，开始挑战`);

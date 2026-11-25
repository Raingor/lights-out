/**
 * 关灯（Lights Out）核心引擎。
 * 棋盘用一维 Uint8Array 表示：1 = 灯亮，0 = 灯灭。
 * 点击一格会翻转自身与上下左右相邻格；目标是把全棋盘的灯全部熄灭。
 */

export type Board = Uint8Array;

export const SIZES = [5, 6] as const;
export type BoardSize = (typeof SIZES)[number];

const NEIGHBORS: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

export function isSize(value: number): value is BoardSize {
  return (SIZES as readonly number[]).includes(value);
}

export function inBounds(size: number, x: number, y: number): boolean {
  return x >= 0 && x < size && y >= 0 && y < size;
}

/** 新建棋盘：全部灯亮。 */
export function createBoard(size: number): Board {
  return new Uint8Array(size * size).fill(1);
}

export function cellIndex(size: number, x: number, y: number): number {
  return y * size + x;
}

export function readCell(board: Board, size: number, x: number, y: number): number {
  return board[cellIndex(size, x, y)];
}

/** 返回翻转 (x, y) 后的新棋盘（纯函数，不修改入参）。 */
export function flipAt(board: Board, size: number, x: number, y: number): Board {
  const next = board.slice();
  for (const [dx, dy] of NEIGHBORS) {
    const nx = x + dx;
    const ny = y + dy;
    if (inBounds(size, nx, ny)) {
      const i = cellIndex(size, nx, ny);
      next[i] = next[i] ^ 1;
    }
  }
  return next;
}

/** 返回会被 (x, y) 影响到的格子坐标列表（含自身）。 */
export function affectedCells(size: number, x: number, y: number): Array<{ x: number; y: number }> {
  const cells: Array<{ x: number; y: number }> = [];
  for (const [dx, dy] of NEIGHBORS) {
    const nx = x + dx;
    const ny = y + dy;
    if (inBounds(size, nx, ny)) cells.push({ x: nx, y: ny });
  }
  return cells;
}

export function litCount(board: Board): number {
  let count = 0;
  for (const value of board) if (value === 1) count += 1;
  return count;
}

export function isSolved(board: Board): boolean {
  for (const value of board) if (value === 1) return false;
  return true;
}

/**
 * 生成保证可解的谜题：从全亮棋盘出发，随机执行 steps 次翻转。
 * 因为棋盘由合法操作产生，沿原操作序列再走一遍即可复原，必然可解。
 */
export function generatePuzzle(size: number, steps: number): Board {
  let board = createBoard(size);
  const total = size * size;
  const positions: Array<{ x: number; y: number }> = [];
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) positions.push({ x, y });
  }
  let remaining = Math.max(0, Math.floor(steps));
  while (remaining > 0) {
    const { x, y } = positions[Math.floor(Math.random() * total)];
    board = flipAt(board, size, x, y);
    remaining -= 1;
  }
  return board;
}

/**
 * 高斯消元（模 2）求解：返回一组点击坐标，按序点击即可熄灭全部灯；
 * 无解时返回 null。用于测试与校验生成器。
 */
export function solveBoard(board: Board, size: number): Array<{ x: number; y: number }> | null {
  const n = size * size;
  const rows: Uint8Array[] = [];
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const row = new Uint8Array(n + 1);
      for (const { x: tx, y: ty } of affectedCells(size, x, y)) {
        row[cellIndex(size, tx, ty)] = 1;
      }
      row[n] = board[cellIndex(size, x, y)];
      rows.push(row);
    }
  }
  let pivotCol = 0;
  for (let row = 0; row < n && pivotCol < n; row += 1) {
    let sel = -1;
    for (let r = row; r < n; r += 1) {
      if (rows[r][pivotCol] === 1) { sel = r; break; }
    }
    if (sel === -1) { pivotCol += 1; row -= 1; continue; }
    [rows[row], rows[sel]] = [rows[sel], rows[row]];
    for (let r = 0; r < n; r += 1) {
      if (r !== row && rows[r][pivotCol] === 1) {
        for (let c = 0; c <= n; c += 1) rows[r][c] ^= rows[row][c];
      }
    }
    pivotCol += 1;
  }
  for (let r = 0; r < n; r += 1) {
    let any = false;
    for (let c = 0; c < n; c += 1) if (rows[r][c] === 1) { any = true; break; }
    if (!any && rows[r][n] === 1) return null;
  }
  const solution: Array<{ x: number; y: number }> = [];
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const row = rows[cellIndex(size, x, y)];
      let value = row[n];
      for (let c = 0; c < n; c += 1) if (row[c] === 1 && c !== cellIndex(size, x, y)) value ^= rows[c][n];
      if (value === 1) solution.push({ x, y });
    }
  }
  return solution;
}

export interface GameState {
  size: BoardSize;
  board: Board;
  moves: number;
  won: boolean;
}

/** 一局游戏的可变状态，支持落子、撤销、重置与换尺寸。 */
export class LightsOutGame {
  size: BoardSize;
  board: Board;
  moves = 0;
  won = false;
  private history: Board[] = [];

  constructor(size: BoardSize = 5, steps = 8) {
    this.size = size;
    this.board = generatePuzzle(size, steps);
    this.won = isSolved(this.board);
  }

  /** 点击 (x, y)：记录历史、翻转并判定胜负。已在胜利状态时忽略。 */
  flip(x: number, y: number): boolean {
    if (this.won) return false;
    if (!inBounds(this.size, x, y)) return false;
    this.history.push(this.board.slice());
    this.board = flipAt(this.board, this.size, x, y);
    this.moves += 1;
    this.won = isSolved(this.board);
    return this.won;
  }

  /** 撤销最近一步，没有历史时返回 false。撤销后重新判定胜负。 */
  undo(): boolean {
    if (this.history.length === 0) return false;
    this.board = this.history.pop()!;
    this.moves = Math.max(0, this.moves - 1);
    this.won = isSolved(this.board);
    return true;
  }

  /** 重新生成一局新谜题。 */
  reset(steps?: number): void {
    this.board = generatePuzzle(this.size, steps ?? 8);
    this.moves = 0;
    this.won = isSolved(this.board);
    this.history = [];
  }

  /** 切换棋盘尺寸并重开一局。 */
  setSize(size: BoardSize, steps = 8): void {
    if (!isSize(size)) return;
    this.size = size;
    this.reset(steps);
  }

  get litCount(): number {
    return litCount(this.board);
  }
}

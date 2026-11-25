import { describe, expect, it } from 'vitest';
import {
  LightsOutGame,
  affectedCells,
  createBoard,
  flipAt,
  litCount,
  isSolved,
  inBounds,
  readCell,
  solveBoard,
} from './engine';

describe('关灯引擎', () => {
  it('生成器产出的随机谜题必然可解（用消元求解器验证）', () => {
    for (let i = 0; i < 15; i += 1) {
      const game = new LightsOutGame(5, Math.floor(Math.random() * 15) + 1);
      expect(game.board.length).toBe(25);
      expect(game.litCount > 0).toBe(true);
      const solution = solveBoard(game.board, 5);
      expect(solution).not.toBeNull();
      for (const { x, y } of solution!) game.flip(x, y);
      expect(game.won).toBe(true);
      expect(game.litCount).toBe(0);
    }
  });

  it('中央落子翻转自身与上下左右四邻（共 5 格）', () => {
    const start = new Uint8Array(25).fill(1);
    const flipped = flipAt(start, 5, 2, 2);
    // (2,2) 自身 + (2,1) 上 + (2,3) 下 + (1,2) 左 + (3,2) 右
    expect(flipped[2 * 5 + 2]).toBe(0); // 自身
    expect(flipped[1 * 5 + 2]).toBe(0); // 上 (x=2,y=1)
    expect(flipped[3 * 5 + 2]).toBe(0); // 下 (x=2,y=3)
    expect(flipped[2 * 5 + 1]).toBe(0); // 左 (x=1,y=2)
    expect(flipped[2 * 5 + 3]).toBe(0); // 右 (x=3,y=2)
    // 其它格子不受影响
    expect(flipped[0]).toBe(1);
    expect(flipped[4]).toBe(1);
    expect(flipped[20]).toBe(1);
    expect(flipped[24]).toBe(1);
  });

  it('角落落子只影响自身与两个相邻格（6×6 验证）', () => {
    const start = new Uint8Array(36).fill(1);
    const flipped = flipAt(start, 6, 0, 0);
    // (0,0) 自身、(1,0) 右、(0,1) 下
    expect(flipped[0]).toBe(0);          // 自身
    expect(flipped[1]).toBe(0);          // 右 (x=1,y=0)
    expect(flipped[6]).toBe(0);          // 下 (x=0,y=1)
    // 其它格不变
    expect(flipped[2]).toBe(1);
    expect(flipped[7]).toBe(1);
    expect(flipped[8]).toBe(1);
    expect(flipped[35]).toBe(1);
  });

  it('affectedCells 返回的影响范围与几何边界一致', () => {
    expect(affectedCells(5, 0, 0).length).toBe(3);
    expect(affectedCells(5, 4, 0).length).toBe(3);
    expect(affectedCells(5, 0, 4).length).toBe(3);
    expect(affectedCells(5, 4, 4).length).toBe(3);
    expect(affectedCells(5, 0, 2).length).toBe(4);
    expect(affectedCells(5, 2, 0).length).toBe(4);
    expect(affectedCells(5, 2, 2).length).toBe(5);
    expect(affectedCells(6, 2, 2).length).toBe(5);
  });

  it('落子会统计步数并判定胜负', () => {
    const game = new LightsOutGame(5, 3);
    const before = game.moves;
    const won = game.flip(0, 0);
    expect(game.moves).toBe(before + 1);
    expect(typeof won).toBe('boolean');
    // 越界点击无效
    const movesBefore = game.moves;
    expect(game.flip(-1, 0)).toBe(false);
    expect(game.flip(5, 0)).toBe(false);
    expect(game.moves).toBe(movesBefore);
  });

  it('沿求解器路径落子能全部熄灭并触发胜利', () => {
    for (let i = 0; i < 5; i += 1) {
      const game = new LightsOutGame(5, 8);
      const solution = solveBoard(game.board, 5)!;
      for (const { x, y } of solution) game.flip(x, y);
      expect(game.won).toBe(true);
      expect(game.litCount).toBe(0);
      expect(isSolved(game.board)).toBe(true);
    }
  });

  it('litCount、readCell、inBounds 边界正确', () => {
    const board = createBoard(5);
    expect(litCount(board)).toBe(25);
    expect(readCell(board, 5, 4, 4)).toBe(1);
    expect(readCell(board, 5, 0, 0)).toBe(1);
    expect(inBounds(5, 4, 4)).toBe(true);
    expect(inBounds(5, 5, 4)).toBe(false);
    expect(inBounds(5, -1, 2)).toBe(false);
    expect(inBounds(6, 5, 5)).toBe(true);
    expect(inBounds(6, 6, 5)).toBe(false);
  });

  it('撤销一步后回到上一盘面且步数减少', () => {
    const game = new LightsOutGame(5, 4);
    const before = game.board.slice();
    game.flip(1, 1);
    expect(game.moves).toBe(1);
    expect(game.undo()).toBe(true);
    expect(game.moves).toBe(0);
    expect(Array.from(game.board)).toEqual(Array.from(before));
  });

  it('撤销到空历史时返回 false', () => {
    const game = new LightsOutGame(5, 5);
    expect(game.undo()).toBe(false);
    expect(game.moves).toBe(0);
  });

  it('重置与换尺寸都会重开且步数归零', () => {
    const game = new LightsOutGame(5, 6);
    game.flip(0, 0);
    expect(game.moves).toBe(1);
    game.reset(8);
    expect(game.moves).toBe(0);
    expect(game.board.length).toBe(25);
    game.setSize(6, 6);
    expect(game.size).toBe(6);
    expect(game.moves).toBe(0);
    expect(game.board.length).toBe(36);
  });

  it('胜利后落子被忽略，撤销可在胜利后回到未胜利局面', () => {
    const game = new LightsOutGame(5, 4);
    const solution = solveBoard(game.board, 5)!;
    for (const { x, y } of solution) game.flip(x, y);
    expect(game.won).toBe(true);
    const movesAtWin = game.moves;
    expect(game.flip(2, 2)).toBe(false);
    expect(game.moves).toBe(movesAtWin);
    expect(game.undo()).toBe(true);
    expect(game.won).toBe(false);
    expect(game.litCount).toBeGreaterThan(0);
  });

  it('6×6 生成器谜题同样可解', () => {
    for (let i = 0; i < 5; i += 1) {
      const game = new LightsOutGame(6, 10);
      expect(game.board.length).toBe(36);
      const solution = solveBoard(game.board, 6);
      expect(solution).not.toBeNull();
      for (const { x, y } of solution!) game.flip(x, y);
      expect(game.won).toBe(true);
    }
  });
});

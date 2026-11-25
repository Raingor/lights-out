import { describe, expect, it } from 'vitest';
import { loadRecords, recordBest, saveRecords, type StoragePort } from './storage';

function memoryStorage(initial: Record<string, string> = {}): StoragePort & { dump(): Record<string, string> } {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => { map.set(key, value); },
    dump: () => Object.fromEntries(map),
  };
}

describe('关灯成绩存储', () => {
  it('首次加载返回空记录且可用', () => {
    const { records, available } = loadRecords(memoryStorage());
    expect(available).toBe(true);
    expect(records.best).toEqual({});
  });

  it('保存后能重新读回最佳步数', () => {
    const storage = memoryStorage();
    saveRecords(storage, { best: { 5: 12, 6: 21 } });
    const { records } = loadRecords(storage);
    expect(records.best[5]).toBe(12);
    expect(records.best[6]).toBe(21);
  });

  it('recordBest 只保留更优成绩', () => {
    let records: { best: Partial<Record<number, number>> } = { best: {} };
    records = recordBest(records, 5, 15);
    expect(records.best[5]).toBe(15);
    records = recordBest(records, 5, 20);
    expect(records.best[5]).toBe(15);
    records = recordBest(records, 5, 10);
    expect(records.best[5]).toBe(10);
  });

  it('损坏的存储内容不会让加载崩溃', () => {
    const storage = memoryStorage({ 'lights-out-records': '{坏数据' });
    const { records, available } = loadRecords(storage);
    expect(available).toBe(true);
    expect(records.best).toEqual({});
  });

  it('null 存储（隐私模式）仍可正常游玩', () => {
    const { records, available } = loadRecords(null);
    expect(available).toBe(false);
    expect(records.best).toEqual({});
    expect(saveRecords(null, records)).toBe(false);
  });

  it('非法尺寸与步数会被忽略', () => {
    const storage = memoryStorage({ 'lights-out-records': JSON.stringify({ best: { 'x': 3, '7': -1, '5': 9 } }) });
    const { records } = loadRecords(storage);
    expect(records.best).toEqual({ 5: 9 });
  });
});

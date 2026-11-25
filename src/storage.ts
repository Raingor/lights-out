/** localStorage 最佳成绩读写（按棋盘尺寸分别记录最少步数）。 */

export interface LightsOutRecords {
  /** 各尺寸的最少通关步数；未通关的尺寸不出现在记录里。 */
  best: Partial<Record<number, number>>;
}

export interface StoragePort {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const KEY = 'lights-out-records';

export function loadRecords(storage: StoragePort | null): { records: LightsOutRecords; available: boolean } {
  if (!storage) return { records: { best: {} }, available: false };
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return { records: { best: {} }, available: true };
    const parsed = JSON.parse(raw) as Partial<LightsOutRecords>;
    const best: Partial<Record<number, number>> = {};
    if (parsed.best && typeof parsed.best === 'object') {
      for (const [size, moves] of Object.entries(parsed.best)) {
        const sizeNum = Number(size);
        const movesNum = Number(moves);
        if (Number.isInteger(sizeNum) && Number.isInteger(movesNum) && movesNum > 0) {
          best[sizeNum] = movesNum;
        }
      }
    }
    return { records: { best }, available: true };
  } catch {
    return { records: { best: {} }, available: true };
  }
}

export function saveRecords(storage: StoragePort | null, records: LightsOutRecords): boolean {
  if (!storage) return false;
  try {
    storage.setItem(KEY, JSON.stringify(records));
    return true;
  } catch {
    return false;
  }
}

/** 更新某尺寸的最佳步数，返回更新后的记录。 */
export function recordBest(
  records: LightsOutRecords,
  size: number,
  moves: number,
): LightsOutRecords {
  const current = records.best[size];
  if (current !== undefined && current <= moves) return records;
  return { best: { ...records.best, [size]: moves } };
}

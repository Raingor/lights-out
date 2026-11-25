/** 内联 SVG 图标集：全部返回完整 <svg> 字符串，不使用箭头字符。 */

const wrap = (inner: string, label: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false" role="img">${inner}</svg>`;

export const icon = {
  reset: () =>
    wrap(
      '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3-2"/>',
      '重置',
    ),
  undo: () =>
    wrap(
      '<path d="M9 8H14a4 4 0 0 1 0 8H8"/><path d="M11.5 5.5 8.5 8l3 2.5"/>',
      '撤销',
    ),
  bulb: () =>
    wrap(
      '<path d="M9 18h6"/><path d="M10 21h4"/><path d="M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.3 1 2.5h6c0-1.2.3-1.8 1-2.5A6 6 0 0 0 12 3Z"/>',
      '灯',
    ),
  bear: () =>
    wrap(
      '<circle cx="12" cy="12" r="9"/><circle cx="8.5" cy="9.5" r="1.6"/><circle cx="15.5" cy="9.5" r="1.6"/><circle cx="9.5" cy="13.5" r="1.1" fill="currentColor" stroke="none"/><circle cx="14.5" cy="13.5" r="1.1" fill="currentColor" stroke="none"/><path d="M9 17c1 1.2 2 1.8 3 1.8s2-.6 3-1.8"/>',
      '小熊',
    ),
  star: () =>
    wrap(
      '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9Z"/>',
      '最佳',
    ),
  close: () =>
    wrap('<path d="M6 6l12 12M18 6L6 18"/>', '关闭'),
} as const;

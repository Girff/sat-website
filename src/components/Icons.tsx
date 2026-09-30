// Small inline icon set (stroke icons, 20px grid). Decorative by default:
// callers give the surrounding button an aria-label.
import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement>;
const base = (p: P) => ({
  width: 20, height: 20, viewBox: '0 0 20 20', fill: 'none', stroke: 'currentColor',
  strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true, ...p,
});

export const IconSun = (p: P) => (<svg {...base(p)}><circle cx="10" cy="10" r="3.5" /><path d="M10 1.8v2M10 16.2v2M1.8 10h2M16.2 10h2M4.2 4.2l1.4 1.4M14.4 14.4l1.4 1.4M4.2 15.8l1.4-1.4M14.4 5.6l1.4-1.4" /></svg>);
export const IconMoon = (p: P) => (<svg {...base(p)}><path d="M16.5 12.2A7 7 0 017.8 3.5a7 7 0 108.7 8.7z" /></svg>);
export const IconSearch = (p: P) => (<svg {...base(p)}><circle cx="8.5" cy="8.5" r="5.5" /><path d="M12.6 12.6L17 17" /></svg>);
export const IconX = (p: P) => (<svg {...base(p)}><path d="M5 5l10 10M15 5L5 15" /></svg>);
export const IconCheck = (p: P) => (<svg {...base(p)}><path d="M4 10.5l4 4 8-9" /></svg>);
export const IconFlag = (p: P) => (<svg {...base(p)}><path d="M5 18V3M5 3.5h9l-2 3.5 2 3.5H5" /></svg>);
export const IconChevron = (p: P) => (<svg {...base(p)}><path d="M6 8l4 4 4-4" /></svg>);
export const IconArrowUp = (p: P) => (<svg {...base(p)}><path d="M10 16V4M5 9l5-5 5 5" /></svg>);
export const IconArrowDown = (p: P) => (<svg {...base(p)}><path d="M10 4v12M5 11l5 5 5-5" /></svg>);
export const IconSort = (p: P) => (<svg {...base(p)}><path d="M7 8l3-3 3 3M7 12l3 3 3-3" /></svg>);
export const IconDot = (p: P) => (<svg {...base(p)}><path d="M6 10h8" /></svg>);

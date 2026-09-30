// The SAT Math reference sheet (the formulas given on the test), as a dialog.
import type { ReactNode } from 'react';
import { Dialog } from '../../components/Dialog';
import { TeX } from '../../components/RichContent';

const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.5 } as const;
const L = ({ x, y, children }: { x: number; y: number; children: string }) => (
  <text x={x} y={y} fontSize="13" fontStyle="italic" fontFamily="var(--font-serif)" fill="currentColor" textAnchor="middle">{children}</text>
);

const FIGURES: { title: string; tex: string[]; svg: ReactNode }[] = [
  {
    title: 'Circle', tex: ['A = \\pi r^2', 'C = 2\\pi r'],
    svg: <><circle cx="50" cy="40" r="30" {...S} /><circle cx="50" cy="40" r="1.8" fill="currentColor" /><path d="M50 40h30" {...S} /><L x={66} y={35}>r</L></>,
  },
  {
    title: 'Rectangle', tex: ['A = \\ell w'],
    svg: <><rect x="15" y="18" width="70" height="42" {...S} /><L x={50} y={74}>ℓ</L><L x={93} y={44}>w</L></>,
  },
  {
    title: 'Triangle', tex: ['A = \\tfrac{1}{2} bh'],
    svg: <><path d="M12 62h76L34 14z" {...S} /><path d="M34 14v48" {...S} strokeDasharray="3 3" /><path d="M34 56h6v6" {...S} /><L x={50} y={76}>b</L><L x={28} y={44}>h</L></>,
  },
  {
    title: 'Right triangle', tex: ['c^2 = a^2 + b^2'],
    svg: <><path d="M18 62h64V14z" {...S} /><path d="M76 62v-6h6" {...S} /><L x={50} y={76}>b</L><L x={92} y={42}>a</L><L x={43} y={34}>c</L></>,
  },
  {
    title: 'Special right triangles', tex: [],
    svg: (
      <>
        <path d="M6 64h44V20z" {...S} /><path d="M44 64v-6h6" {...S} />
        <L x={28} y={78}>x√3</L><L x={58} y={46}>x</L><L x={20} y={38}>2x</L>
        <text x="16" y="60" fontSize="10" fill="currentColor">30°</text><text x="40" y="32" fontSize="10" fill="currentColor">60°</text>
        <path d="M66 64h40V24z" {...S} /><path d="M100 64v-6h6" {...S} />
        <L x={86} y={78}>s</L><L x={114} y={46}>s</L><L x={80} y={40}>s√2</L>
        <text x="75" y="60" fontSize="10" fill="currentColor">45°</text><text x="94" y="36" fontSize="10" fill="currentColor">45°</text>
      </>
    ),
  },
  {
    title: 'Rectangular prism', tex: ['V = \\ell wh'],
    svg: <><path d="M14 30h52v36H14zM14 30l18-14h52L66 30M84 16v36L66 66" {...S} /><L x={40} y={78}>ℓ</L><L x={82} y={70}>w</L><L x={92} y={36}>h</L></>,
  },
  {
    title: 'Cylinder', tex: ['V = \\pi r^2 h'],
    svg: <><ellipse cx="50" cy="18" rx="28" ry="8" {...S} /><path d="M22 18v44M78 18v44" {...S} /><path d="M22 62a28 8 0 0 0 56 0" {...S} /><path d="M50 18h28" {...S} /><L x={64} y={14}>r</L><L x={88} y={44}>h</L></>,
  },
  {
    title: 'Sphere', tex: ['V = \\tfrac{4}{3}\\pi r^3'],
    svg: <><circle cx="50" cy="40" r="30" {...S} /><ellipse cx="50" cy="40" rx="30" ry="8" {...S} strokeDasharray="3 3" /><path d="M50 40h30" {...S} /><L x={66} y={35}>r</L></>,
  },
  {
    title: 'Cone', tex: ['V = \\tfrac{1}{3}\\pi r^2 h'],
    svg: <><path d="M22 60L50 10l28 50" {...S} /><ellipse cx="50" cy="60" rx="28" ry="8" {...S} /><path d="M50 10v50h28" {...S} strokeDasharray="3 3" /><L x={64} y={56}>r</L><L x={43} y={40}>h</L></>,
  },
  {
    title: 'Pyramid', tex: ['V = \\tfrac{1}{3}\\ell wh'],
    svg: <><path d="M14 58h50l20-14M14 58l40-46 10 46M54 12l30 32" {...S} /><path d="M14 58l20-14h50M54 12v38" {...S} strokeDasharray="3 3" /><L x={40} y={72}>ℓ</L><L x={82} y={58}>w</L><L x={47} y={36}>h</L></>,
  },
];

export function ReferenceSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="Reference" className="max-w-4xl">
      <div className="px-5 py-4">
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {FIGURES.map((f) => (
            <li key={f.title} className="flex flex-col items-center rounded-lg border border-line p-3 text-center">
              <svg viewBox={f.title === 'Special right triangles' ? '0 0 122 84' : '0 0 104 84'} className="h-20 w-full max-w-32 text-ink" role="img" aria-label={f.title}>{f.svg}</svg>
              <span className="mt-1 text-xs font-semibold text-muted">{f.title}</span>
              {f.tex.map((t) => <span key={t} className="mt-0.5"><TeX tex={t} /></span>)}
            </li>
          ))}
        </ul>
        <ul className="mt-4 grid gap-1.5 text-sm">
          <li>The number of degrees of arc in a circle is 360.</li>
          <li>The number of radians of arc in a circle is <TeX tex="2\pi" />.</li>
          <li>The sum of the measures in degrees of the angles of a triangle is 180.</li>
        </ul>
      </div>
    </Dialog>
  );
}

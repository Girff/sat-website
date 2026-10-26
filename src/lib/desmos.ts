// Desmos regression practice: the question kinds that scripts/lib/desmos.py tags,
// and how to set each one up in Desmos.
import type { DesmosPattern } from './types';

export const DESMOS_LABEL = 'Desmos regression';

export const DESMOS_PATTERNS: Record<DesmosPattern, { label: string; how: string }> = {
  table: {
    label: 'Table of values',
    how: 'Enter the table as x₁ and y₁, then fit the model: y₁ ~ mx₁ + b, y₁ ~ ax₁² + bx₁ + c or y₁ ~ ab^x₁. Read the constants, or evaluate the fitted model.',
  },
  points: {
    label: 'Points and function values',
    how: 'Put the points the graph passes through (and values such as f(3) = 7, which is the point (3, 7)) in a table, then fit the given form, e.g. y₁ ~ a^x₁ + b.',
  },
  identity: {
    label: 'Equivalent expressions',
    how: 'Type x₁ = [1...10], then the left side ~ the right side with x written as x₁. Desmos finds the constants that make them equal for every x.',
  },
  infinite: {
    label: 'Infinitely many solutions',
    how: 'Infinitely many solutions means both sides are the same graph. Type x₁ = [1...10], then left side ~ right side, e.g. 2x₁ + 16 ~ a(x₁ + 8). For a system, write both lines as y = … first.',
  },
  fit: {
    label: 'Line or curve of best fit',
    how: 'Read the points off the scatterplot into a table, fit y₁ ~ mx₁ + b (or y₁ ~ ab^x₁ for a curve), and pick the choice closest to the fitted equation.',
  },
};

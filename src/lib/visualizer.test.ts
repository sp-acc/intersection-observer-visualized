import { describe, expect, it } from 'vitest';
import { normalizeThresholds, parseRootMargin } from './visualizer';

const box = { top: 100, left: 50, right: 850, bottom: 700 }; // 800 × 600

describe('parseRootMargin', () => {
  it('defaults to zero margins for an empty string', () => {
    expect(parseRootMargin('', box)).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
  });

  it('expands one value to all four sides', () => {
    expect(parseRootMargin('10px', box)).toEqual({ top: 10, right: 10, bottom: 10, left: 10 });
  });

  it('expands two values to vertical/horizontal', () => {
    expect(parseRootMargin('10px 20px', box)).toEqual({ top: 10, right: 20, bottom: 10, left: 20 });
  });

  it('expands three values to top/horizontal/bottom', () => {
    expect(parseRootMargin('10px 20px 30px', box)).toEqual({ top: 10, right: 20, bottom: 30, left: 20 });
  });

  it('keeps four values as top/right/bottom/left', () => {
    expect(parseRootMargin('1px 2px 3px 4px', box)).toEqual({ top: 1, right: 2, bottom: 3, left: 4 });
  });

  it('resolves percentages against height for top/bottom and width for left/right', () => {
    expect(parseRootMargin('10% 25%', box)).toEqual({ top: 60, right: 200, bottom: 60, left: 200 });
  });

  it('supports negative values', () => {
    expect(parseRootMargin('-20% 0px', box)).toEqual({ top: -120, right: 0, bottom: -120, left: 0 });
  });

  it('treats unparseable values as zero', () => {
    expect(parseRootMargin('garbage 10px', box)).toEqual({ top: 0, right: 10, bottom: 0, left: 10 });
  });
});

describe('normalizeThresholds', () => {
  it('defaults to [0]', () => {
    expect(normalizeThresholds(undefined)).toEqual([0]);
  });

  it('wraps a single number', () => {
    expect(normalizeThresholds(0.5)).toEqual([0.5]);
  });

  it('copies an array without aliasing it', () => {
    const input = [0, 0.5, 1];
    const result = normalizeThresholds(input);
    expect(result).toEqual([0, 0.5, 1]);
    expect(result).not.toBe(input);
  });
});

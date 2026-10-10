import { describe, expect, it } from 'vitest'
import { barPath, labelStride, niceMax } from './chart'

describe('niceMax', () => {
  const cases: [number, number][] = [
    [0, 1],
    [1, 1],
    [3, 5],
    [7, 10],
    [12, 20],
    [50, 50],
    [51, 100],
    [1234, 2000],
    [0.3, 0.5],
  ]
  for (const [n, want] of cases) {
    it(`niceMax(${n}) = ${want}`, () => expect(niceMax(n)).toBeCloseTo(want))
  }
})

describe('barPath', () => {
  it('is empty for a zero bar', () => expect(barPath(0, 10, 0, 100)).toBe(''))
  it('rounds the top corners only', () => {
    expect(barPath(10, 10, 50, 100)).toBe('M10,100V54Q10,50 14,50H16Q20,50 20,54V100Z')
  })
  it('shrinks the radius for a short bar', () => {
    expect(barPath(0, 10, 2, 100)).toBe('M0,100V100Q0,98 2,98H8Q10,98 10,100V100Z')
  })
})

describe('labelStride', () => {
  const cases: [number, number, number][] = [
    [12, 12, 1],
    [13, 12, 2],
    [30, 8, 4],
    [0, 8, 1],
  ]
  for (const [count, max, want] of cases) {
    it(`labelStride(${count}, ${max}) = ${want}`, () => expect(labelStride(count, max)).toBe(want))
  }
})

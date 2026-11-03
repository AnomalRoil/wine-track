import { fireEvent, render, screen } from '@testing-library/svelte'
import { expect, it } from 'vitest'
import PriceInput from './PriceInput.svelte'

it('splits a case price per bottle and shows the rounded result on change', async () => {
  const seen: (number | null)[] = []
  render(PriceInput, { id: 'p', value: null, onchange: (v: number | null) => seen.push(v) })
  const input = screen.getByRole('textbox') as HTMLInputElement
  await fireEvent.input(input, { target: { value: '100/6' } })
  await fireEvent.change(input)
  expect(input.value).toBe('16.67')
  expect(seen).toEqual([16.67])
})

it('flags an invalid price and does not report it', async () => {
  const seen: (number | null)[] = []
  render(PriceInput, { id: 'p', value: 12, onchange: (v: number | null) => seen.push(v) })
  const input = screen.getByRole('textbox') as HTMLInputElement
  expect(input.value).toBe('12')
  await fireEvent.input(input, { target: { value: '10/0' } })
  await fireEvent.change(input)
  expect(input.getAttribute('aria-invalid')).toBe('true')
  expect(seen).toEqual([])
})

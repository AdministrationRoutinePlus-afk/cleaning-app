import { cn } from '../../utils'

describe('cn', () => {
  it('returns empty string for no arguments', () => {
    expect(cn()).toBe('')
  })

  it('returns a single class unchanged', () => {
    expect(cn('text-red-500')).toBe('text-red-500')
  })

  it('merges multiple classes', () => {
    expect(cn('p-4', 'm-2')).toBe('p-4 m-2')
  })

  it('resolves conflicting tailwind classes (last wins)', () => {
    expect(cn('p-4', 'p-2')).toBe('p-2')
  })

  it('resolves conflicting text color classes', () => {
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500')
  })

  it('handles conditional classes via clsx', () => {
    expect(cn('base', false && 'hidden', 'extra')).toBe('base extra')
    expect(cn('base', true && 'visible', 'extra')).toBe('base visible extra')
  })

  it('handles undefined and null inputs', () => {
    expect(cn('base', undefined, null, 'extra')).toBe('base extra')
  })

  it('handles array inputs', () => {
    expect(cn(['p-4', 'm-2'])).toBe('p-4 m-2')
  })

  it('handles object inputs', () => {
    expect(cn({ 'text-red-500': true, 'bg-blue-500': false })).toBe('text-red-500')
  })

  it('merges complex conflicting classes', () => {
    // bg-red-500 should be overridden by bg-blue-500
    expect(cn('bg-red-500 text-white', 'bg-blue-500')).toBe('text-white bg-blue-500')
  })

  it('handles mixed input types', () => {
    const result = cn('base', ['array-class'], { 'obj-class': true })
    expect(result).toBe('base array-class obj-class')
  })

  it('resolves conflicting margin classes', () => {
    expect(cn('mt-2', 'mt-4')).toBe('mt-4')
  })

  it('preserves non-conflicting classes from different groups', () => {
    expect(cn('p-4 text-white bg-black', 'rounded-lg border')).toBe(
      'p-4 text-white bg-black rounded-lg border'
    )
  })
})

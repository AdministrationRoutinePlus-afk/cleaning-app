import { sanitizeText } from '../sanitize'

describe('sanitizeText', () => {
  it('returns plain text unchanged', () => {
    expect(sanitizeText('Hello world')).toBe('Hello world')
  })

  it('strips simple HTML tags', () => {
    expect(sanitizeText('<b>bold</b>')).toBe('bold')
    expect(sanitizeText('<i>italic</i>')).toBe('italic')
    expect(sanitizeText('<p>paragraph</p>')).toBe('paragraph')
  })

  it('strips self-closing tags', () => {
    expect(sanitizeText('line<br/>break')).toBe('linebreak')
    expect(sanitizeText('line<br />break')).toBe('linebreak')
    expect(sanitizeText('image<img src="x.png" />here')).toBe('imagehere')
  })

  it('strips tags with attributes', () => {
    expect(sanitizeText('<a href="https://example.com">link</a>')).toBe('link')
    expect(sanitizeText('<div class="foo" id="bar">content</div>')).toBe('content')
  })

  it('strips script tags and their content markers', () => {
    expect(sanitizeText('<script>alert("xss")</script>')).toBe('alert("xss")')
  })

  it('strips nested tags', () => {
    expect(sanitizeText('<div><span>nested</span></div>')).toBe('nested')
  })

  it('strips multiple tags in sequence', () => {
    expect(sanitizeText('<b>one</b> <i>two</i> <u>three</u>')).toBe('one two three')
  })

  it('handles empty string', () => {
    expect(sanitizeText('')).toBe('')
  })

  it('handles string with no tags', () => {
    expect(sanitizeText('no tags here 123!')).toBe('no tags here 123!')
  })

  it('handles angle brackets that are not tags', () => {
    // The regex strips anything that looks like <...>
    expect(sanitizeText('5 > 3 and 2 < 4')).toBe('5 > 3 and 2 < 4')
  })

  it('handles multiline HTML', () => {
    const input = '<div>\n  <p>Hello</p>\n</div>'
    expect(sanitizeText(input)).toBe('\n  Hello\n')
  })

  it('strips tags with data attributes', () => {
    expect(sanitizeText('<div data-testid="foo">text</div>')).toBe('text')
  })

  it('handles style tags', () => {
    expect(sanitizeText('<style>.foo{color:red}</style>')).toBe('.foo{color:red}')
  })

  it('preserves special characters outside of tags', () => {
    expect(sanitizeText('Hello & "world" \'test\'')).toBe('Hello & "world" \'test\'')
  })

  it('preserves unicode text', () => {
    expect(sanitizeText('<p>Bonjour le monde</p>')).toBe('Bonjour le monde')
  })
})

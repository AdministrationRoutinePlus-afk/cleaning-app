import { fr } from '../translations'

describe('French translations dictionary', () => {
  const entries = Object.entries(fr)
  const keys = Object.keys(fr)

  it('should have a reasonable number of entries (> 500)', () => {
    expect(keys.length).toBeGreaterThan(500)
  })

  it('should have all values as non-empty strings', () => {
    const emptyEntries = entries.filter(
      ([, value]) => typeof value !== 'string' || value.trim() === ''
    )
    expect(emptyEntries).toEqual([])
  })

  describe('important UI keys exist', () => {
    const requiredKeys = [
      'Dashboard',
      'Jobs',
      'Save',
      'Cancel',
      'Delete',
      'Submit',
      'Edit',
      'Close',
      'Search',
      'Loading...',
      'Login',
      'Logout',
      'Error',
      'Success',
      'Confirm',
      'Back',
      'Next',
      'View',
      'Add',
      'Remove',
      'Update',
      'Send',
    ]

    it.each(requiredKeys)('should contain key "%s"', (key) => {
      expect(fr[key]).toBeDefined()
      expect(fr[key].length).toBeGreaterThan(0)
    })
  })

  it('should have a significant percentage of keys translated (value differs from key)', () => {
    // Short words (<=3 chars) and certain proper nouns are allowed to match
    const longEntries = entries.filter(([key]) => key.length > 3)
    const untranslated = longEntries.filter(([key, value]) => key === value)

    const translatedPercentage =
      ((longEntries.length - untranslated.length) / longEntries.length) * 100

    // At least 90% of keys longer than 3 characters should have different translations
    expect(translatedPercentage).toBeGreaterThan(90)

    if (untranslated.length > 0) {
      // Log untranslated entries for visibility but don't fail on a few
      // eslint-disable-next-line no-console
      console.log(
        `Found ${untranslated.length} potentially untranslated entries (key === value):`,
        untranslated.map(([k]) => k)
      )
    }
  })

  it('should have no duplicate values that are identical to many different keys', () => {
    // This catches cases where someone pasted the key as the value by accident
    const valueCounts = new Map<string, number>()
    for (const [, value] of entries) {
      valueCounts.set(value, (valueCounts.get(value) || 0) + 1)
    }

    // No single translation value should be shared by more than 10 different keys
    // (some short translations like 'de' or 'à' might appear multiple times)
    const overUsed = [...valueCounts.entries()].filter(
      ([val, count]) => count > 10 && val.length > 3
    )
    expect(overUsed).toEqual([])
  })

  it('should have all keys as non-empty strings', () => {
    const emptyKeys = keys.filter((key) => key.trim() === '')
    expect(emptyKeys).toEqual([])
  })

  it('should have specific French translations for well-known words', () => {
    // Verify actual translation quality for a few known pairs
    expect(fr['Cancel']).toBe('Annuler')
    expect(fr['Save']).toBe('Enregistrer')
    expect(fr['Delete']).toBe('Supprimer')
    expect(fr['Search']).toBe('Rechercher')
    expect(fr['Dashboard']).toBe('Tableau de bord')
    expect(fr['Yes']).toBe('Oui')
    expect(fr['No']).toBe('Non')
  })
})

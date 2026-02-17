import { format as dateFnsFormat, type FormatOptions } from 'date-fns'
import { fr } from 'date-fns/locale/fr'
import { useLanguage } from './LanguageContext'

/**
 * Returns a locale-aware date format function.
 * When language is 'fr', dates use French locale (e.g., "lundi, 14 février").
 * When language is 'en', dates use default English locale.
 */
export function useDateFormat() {
  const { language } = useLanguage()

  const formatDate = (date: Date | number, formatStr: string, options?: FormatOptions): string => {
    return dateFnsFormat(date, formatStr, {
      ...options,
      locale: language === 'fr' ? fr : undefined,
    })
  }

  return { formatDate }
}

import { useLanguage } from './LanguageContext'
import { fr } from './translations'

export function useTranslation() {
  const { language, setLanguage, toggleLanguage } = useLanguage()

  const t = (key: string): string => {
    if (language === 'en') return key
    return fr[key] || key
  }

  return { t, language, setLanguage, toggleLanguage }
}

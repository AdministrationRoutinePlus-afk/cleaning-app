'use client'

import { useTranslation } from '@/lib/i18n/useTranslation'

export function LanguageToggle() {
  const { language, toggleLanguage } = useTranslation()

  return (
    <button
      onClick={toggleLanguage}
      className="fixed top-3 right-3 z-50 bg-white/10 hover:bg-white/20 text-white text-xs font-bold px-2.5 py-1.5 rounded-lg border border-white/20 backdrop-blur-sm transition-all active:scale-95"
      aria-label={language === 'fr' ? 'Switch to English' : 'Passer en fran\u00e7ais'}
    >
      {language === 'fr' ? 'EN' : 'FR'}
    </button>
  )
}

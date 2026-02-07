'use client'

import { LanguageProvider } from '@/lib/i18n/LanguageContext'
import { LanguageToggle } from '@/components/LanguageToggle'

export default function LanguageProviderWrapper({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      <LanguageToggle />
      {children}
    </LanguageProvider>
  )
}

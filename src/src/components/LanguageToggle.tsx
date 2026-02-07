'use client'

import { useTranslation } from '@/lib/i18n/useTranslation'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'

export function LanguageToggle() {
  const { language, toggleLanguage } = useTranslation()
  const router = useRouter()

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="fixed top-3 right-3 z-50 flex items-center gap-1.5">
      <button
        onClick={toggleLanguage}
        className="bg-white/10 hover:bg-white/20 text-white text-xs font-bold px-2.5 py-1.5 rounded-lg border border-white/20 backdrop-blur-sm transition-all active:scale-95"
        aria-label={language === 'fr' ? 'Switch to English' : 'Passer en français'}
      >
        {language === 'fr' ? 'EN' : 'FR'}
      </button>
      <button
        onClick={handleLogout}
        className="bg-white/10 hover:bg-red-500/30 text-white text-xs font-bold p-1.5 rounded-lg border border-white/20 backdrop-blur-sm transition-all active:scale-95"
        aria-label={language === 'fr' ? 'Déconnexion' : 'Log out'}
      >
        <LogOut className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

'use client'

import { useTranslation } from '@/lib/i18n/useTranslation'

interface InvalidReviewPageProps {
  messageKey: string
}

export function InvalidReviewPage({ messageKey }: InvalidReviewPageProps) {
  const { t } = useTranslation()

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
          <div className="text-4xl mb-4">&#128683;</div>
          <h1 className="text-xl font-bold text-white mb-2">{t('Review Unavailable')}</h1>
          <p className="text-gray-400">{t(messageKey)}</p>
        </div>
      </div>
    </div>
  )
}

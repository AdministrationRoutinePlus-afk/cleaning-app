import type { FC } from 'react'

interface ProgressBarProps {
  current: number
  total: number
  label?: string
}

export const ProgressBar: FC<ProgressBarProps> = ({ current, total, label }) => {
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0

  return (
    <div className="w-full">
      {label && (
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-300">{label}</span>
          <span className="text-sm text-gray-400">{current}/{total}</span>
        </div>
      )}
      <div className="w-full bg-white/10 rounded-full h-3 overflow-hidden">
        <div
          className="bg-blue-500 h-3 rounded-full transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="text-center mt-1">
        <span className="text-xs font-semibold text-blue-400">{percentage}%</span>
      </div>
    </div>
  )
}

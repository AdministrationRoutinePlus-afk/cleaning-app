import { BottomNav } from '@/components/BottomNav'

export default function EmployerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      {children}
      <BottomNav profile="EMPLOYER" />
    </>
  )
}

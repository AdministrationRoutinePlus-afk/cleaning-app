import { BottomNav } from '@/components/BottomNav'

export default function CustomerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      {children}
      <BottomNav profile="CUSTOMER" />
    </>
  )
}

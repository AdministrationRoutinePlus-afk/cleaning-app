import { BottomNav } from '@/components/BottomNav'

export default function EmployeeLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      {children}
      <BottomNav profile="EMPLOYEE" />
    </>
  )
}

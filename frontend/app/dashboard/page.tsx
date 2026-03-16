import { currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { DashboardClient } from './dashboard-client'

export const metadata = { title: 'Dashboard' }
export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const user = await currentUser()
  if (!user) redirect('/')

  return (
    <DashboardClient
      firstName={user.firstName}
      imageUrl={user.imageUrl}
    />
  )
}

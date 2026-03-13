// app/politicians/[id]/page.tsx
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Disclaimer } from '@/components/disclaimer'
import { PoliticianDashboard } from '@/components/politician-dashboard'
import { PoliticianSectorRadar } from '@/components/politician-sector-radar'
import { apiFetch } from '@/lib/api'
import type { PoliticianProfile, PoliticianSectorsResponse } from '@/lib/types'

export const revalidate = 3600

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  try {
    const profile = await apiFetch<PoliticianProfile>(`/politicians/${id}`, {
      tags: [`politician-${id}`],
      revalidate: 3600,
    })
    return {
      title: `${profile.full_name} — Congress Trades`,
      alternates: { canonical: `/politicians/${id}` },
    }
  } catch {
    return { title: 'Congress Member — Congress Trades' }
  }
}

export default async function PoliticianPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  let profile: PoliticianProfile
  try {
    profile = await apiFetch<PoliticianProfile>(`/politicians/${id}`, {
      tags: [`politician-${id}`, 'politicians'],
      revalidate: 3600,
    })
  } catch {
    notFound()
  }

  let sectorData: PoliticianSectorsResponse | null = null
  try {
    sectorData = await apiFetch<PoliticianSectorsResponse>(`/politicians/${id}/sectors`, {
      tags: [`politician-sectors-${id}`],
      revalidate: 3600,
    })
  } catch {
    // sector radar is additive — render profile without it if fetch fails
  }

  return (
    <>
      <Disclaimer />
      <PoliticianDashboard profile={profile} />
      {sectorData && sectorData.sectors.length > 0 && (
        <div className="container mx-auto px-4 max-w-4xl pb-10">
          <h2 className="text-xl font-semibold mb-4">Trading Activity by Sector</h2>
          <PoliticianSectorRadar sectors={sectorData.sectors} />
        </div>
      )}
    </>
  )
}

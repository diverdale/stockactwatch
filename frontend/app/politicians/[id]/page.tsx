// app/politicians/[id]/page.tsx
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Disclaimer } from '@/components/disclaimer'
import { PoliticianDashboard } from '@/components/politician-dashboard'
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
      title: profile.full_name,
      description: `Stock trades disclosed by ${profile.full_name} (${profile.party ?? 'Congress'}) under the STOCK Act. Full trade history, returns, and suspicion scoring.`,
      alternates: { canonical: `/politicians/${id}` },
      openGraph: {
        title: `${profile.full_name} — Congressional Stock Trades`,
        description: `STOCK Act disclosures, estimated returns, and trading patterns for ${profile.full_name}.`,
      },
    }
  } catch {
    return { title: 'Congress Member' }
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
    // sector radar is additive — render without it if fetch fails
  }

  return (
    <>
      <Disclaimer />
      <PoliticianDashboard
        profile={profile}
        sectors={sectorData?.sectors}
      />
    </>
  )
}

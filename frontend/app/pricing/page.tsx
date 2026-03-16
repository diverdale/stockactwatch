import type { Metadata } from 'next'
import { PricingClient } from './pricing-client'

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'Full access to congressional stock trade data, AI-powered analysis, and real-time watchlists. Built for the 2026 midterm election cycle.',
  alternates: { canonical: '/pricing' },
}

export default function PricingPage() {
  return <PricingClient />
}

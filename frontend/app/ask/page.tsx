import type { Metadata } from 'next'
import { AskClient } from './ask-client'

export const metadata: Metadata = {
  title: 'Ask the Data — Congress Trades',
  description: 'Ask natural language questions about congressional stock trading activity.',
  alternates: { canonical: '/ask' },
}

export default function AskPage() {
  return <AskClient />
}

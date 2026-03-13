'use client'
import { useQueryState } from 'nuqs'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

export function FeedFilters() {
  const [chamber, setChamber] = useQueryState('chamber', { defaultValue: '' })
  const [party, setParty] = useQueryState('party', { defaultValue: '' })

  return (
    <div className="flex flex-wrap gap-3">
      <Select
        value={chamber}
        onValueChange={(val) => setChamber(val === 'all' ? null : val)}
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="All chambers" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All chambers</SelectItem>
          <SelectItem value="House">House</SelectItem>
          <SelectItem value="Senate">Senate</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={party}
        onValueChange={(val) => setParty(val === 'all' ? null : val)}
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="All parties" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All parties</SelectItem>
          <SelectItem value="Republican">Republican</SelectItem>
          <SelectItem value="Democrat">Democrat</SelectItem>
          <SelectItem value="Independent">Independent</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}

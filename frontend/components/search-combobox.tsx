'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useDebouncedCallback } from 'use-debounce'
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Search } from 'lucide-react'

interface PoliticianResult {
  id: string
  full_name: string
  party: string | null
  chamber: string | null
}
interface TickerResult {
  ticker: string
}

export function SearchCombobox() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [politicians, setPoliticians] = useState<PoliticianResult[]>([])
  const [tickers, setTickers] = useState<TickerResult[]>([])
  const router = useRouter()

  const fetchResults = useDebouncedCallback(async (q: string) => {
    if (q.length < 2) {
      setPoliticians([])
      setTickers([])
      return
    }
    const [polRes, tickRes] = await Promise.all([
      fetch(`/api/search?q=${encodeURIComponent(q)}&type=politicians`),
      fetch(`/api/search?q=${encodeURIComponent(q)}&type=tickers`),
    ])
    const [polData, tickData] = await Promise.all([polRes.json(), tickRes.json()])
    setPoliticians(polData.results ?? [])
    setTickers(tickData.results ?? [])
  }, 300)

  const handleSelect = (href: string) => {
    setOpen(false)
    setQuery('')
    setPoliticians([])
    setTickers([])
    router.push(href)
  }

  const hasResults = politicians.length > 0 || tickers.length > 0

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="inline-flex h-9 w-48 items-center justify-start gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground">
        <Search className="h-4 w-4 shrink-0" />
        <span>Search...</span>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-72" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search members or tickers..."
            value={query}
            onValueChange={(val) => {
              setQuery(val)
              fetchResults(val)
            }}
          />
          <CommandList>
            {query.length >= 2 && !hasResults && (
              <CommandEmpty>No results found.</CommandEmpty>
            )}
            {politicians.length > 0 && (
              <CommandGroup heading="Members">
                {politicians.map((p) => (
                  <CommandItem
                    key={p.id}
                    value={p.id}
                    onSelect={() => handleSelect(`/politicians/${p.id}`)}
                  >
                    <span>{p.full_name}</span>
                    {p.party && p.chamber && (
                      <span className="ml-auto text-xs text-muted-foreground">
                        {p.party} · {p.chamber}
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {tickers.length > 0 && (
              <CommandGroup heading="Tickers">
                {tickers.map((t) => (
                  <CommandItem
                    key={t.ticker}
                    value={t.ticker}
                    onSelect={() => handleSelect(`/tickers/${t.ticker}`)}
                  >
                    {t.ticker}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

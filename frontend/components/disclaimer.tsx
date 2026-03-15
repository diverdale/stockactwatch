// components/disclaimer.tsx
import { Info } from 'lucide-react'

export function Disclaimer() {
  return (
    <div
      role="note"
      className="fixed bottom-0 left-0 right-0 z-50 flex items-center gap-3 border-t border-border bg-background/90 backdrop-blur-sm px-6 py-2.5 text-xs text-muted-foreground"
    >
      <Info className="h-3.5 w-3.5 shrink-0 text-primary" />
      <span>
        Data from public STOCK Act disclosures. Estimated returns are illustrative only and not
        guaranteed. Not financial advice.
      </span>
    </div>
  )
}

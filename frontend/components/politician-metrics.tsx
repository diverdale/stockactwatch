'use client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { PoliticianProfile } from '@/lib/types'

interface PoliticianMetricsProps {
  profile: PoliticianProfile
}

function computeAvgReturn(profile: PoliticianProfile): string {
  const calculable = profile.trades.filter(
    (t) => t.return_calculable && t.avg_return_pct !== null
  )
  if (calculable.length === 0) return 'N/A'
  const avg =
    calculable.reduce((sum, t) => sum + (t.avg_return_pct ?? 0), 0) / calculable.length
  const sign = avg >= 0 ? '+' : ''
  return `${sign}${avg.toFixed(1)}%`
}

function computeTopAssetTypes(profile: PoliticianProfile): { type: string; count: number }[] {
  const counts: Record<string, number> = {}
  for (const trade of profile.trades) {
    const key = trade.asset_type ?? 'other'
    counts[key] = (counts[key] ?? 0) + 1
  }
  return Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([type, count]) => ({
      type: type.charAt(0).toUpperCase() + type.slice(1),
      count,
    }))
}

export function PoliticianMetrics({ profile }: PoliticianMetricsProps) {
  const avgReturn = computeAvgReturn(profile)
  const calculableCount = profile.trades.filter((t) => t.return_calculable).length
  const topAssetTypes = computeTopAssetTypes(profile)

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-muted-foreground text-sm font-medium">Total Trades</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{profile.total_trades}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-muted-foreground text-sm font-medium">
            Est. Avg Return
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className={`text-2xl font-bold font-mono ${
              avgReturn === 'N/A'
                ? 'text-muted-foreground text-base'
                : avgReturn.startsWith('+')
                ? 'text-green-600'
                : 'text-red-600'
            }`}
          >
            {avgReturn}
          </div>
          {avgReturn !== 'N/A' && (
            <p className="text-muted-foreground text-xs mt-1">
              Based on {calculableCount} equity trades
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-muted-foreground text-sm font-medium">Options Trades</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {profile.trades.filter((t) => !t.return_calculable).length}
          </div>
          <p className="text-muted-foreground text-xs mt-1">return not calculable</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-muted-foreground text-sm font-medium">Top Asset Types</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {topAssetTypes.length === 0 ? (
              <p className="text-muted-foreground text-sm">No trades</p>
            ) : (
              topAssetTypes.map(({ type, count }) => (
                <div key={type} className="flex items-center justify-between text-sm">
                  <span>{type}</span>
                  <span className="font-mono text-muted-foreground">{count}</span>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

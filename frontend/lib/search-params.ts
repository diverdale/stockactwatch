import { parseAsString, createSerializer } from 'nuqs/server'

export const leaderboardParams = {
  chamber: parseAsString.withDefault(''),
  party: parseAsString.withDefault(''),
}

export const serializeLeaderboard = createSerializer(leaderboardParams)
// serializeLeaderboard({ chamber: 'Senate', party: '' }) → '?chamber=Senate'
// Omits params at their default value ('')

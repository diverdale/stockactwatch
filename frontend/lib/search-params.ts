import { parseAsString, createSerializer } from 'nuqs'

export const leaderboardParams = {
  chamber: parseAsString.withDefault(''),
  party: parseAsString.withDefault(''),
}

export const serializeLeaderboard = createSerializer(leaderboardParams)
// serializeLeaderboard({ chamber: 'Senate', party: '' }) → '?chamber=Senate'
// Omits params at their default value ('')

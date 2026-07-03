export function scoreRoute(route, elevationProfile) {
  const climb = route.totalClimb || 0, distKm = route.totalDistance / 1000
  const maxSlope = route.maxSlope || 0, steepKm4 = route.steepKm4 || 0, steepKm6 = route.steepKm6 || 0, steepKm8 = route.steepKm8 || 0, steepKm10 = route.steepKm10 || 0, uninhabitedKm = route.uninhabitedKm || 0
  const slopeScore = maxSlope * 5 + steepKm4 * 3 + steepKm6 * 6 + steepKm8 * 12 + steepKm10 * 20
  const safetyScore = uninhabitedKm * 8, climbScore = climb / 15, distScore = distKm * 0.05
  return slopeScore * 0.50 + safetyScore * 0.35 + climbScore * 0.10 + distScore * 0.05
}
export function rateDifficulty(totalDistance, totalClimb) {
  const km = totalDistance / 1000, climb = totalClimb || 0, ratio = km > 0 ? climb / km : 0
  if (km >= 120 || ratio > 15) return { label: '★★★★★ 极限', color: '#ef4444' }
  if (km >= 80 || ratio > 10) return { label: '★★★★ 困难', color: '#f97316' }
  if (km >= 50 || ratio > 6) return { label: '★★★ 中等', color: '#eab308' }
  if (km >= 25 || ratio > 3) return { label: '★★ 进阶', color: '#22c55e' }
  return { label: '★ 休闲', color: '#3b82f6' }
}

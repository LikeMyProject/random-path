export function rateDifficulty(totalDistance, totalClimb) {
  const km = totalDistance / 1000, climb = totalClimb || 0, ratio = km > 0 ? climb / km : 0
  if (km >= 120 || ratio > 15) return { label: '★★★★★ 极限', color: '#ef4444' }
  if (km >= 80 || ratio > 10) return { label: '★★★★ 困难', color: '#f97316' }
  if (km >= 50 || ratio > 6) return { label: '★★★ 中等', color: '#eab308' }
  if (km >= 25 || ratio > 3) return { label: '★★ 进阶', color: '#22c55e' }
  return { label: '★ 休闲', color: '#3b82f6' }
}

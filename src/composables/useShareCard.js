import { parsePolyline } from '../utils/math.js'

const W = 720, H = 540, P = 36

export function drawRouteMap(ctx, { segments, waypoints, home, work, supplyPoints }, { x = 0, y = 0, w = W, h = H } = {}) {
  const allPts = []
  if (home) allPts.push(home)
  if (work) allPts.push(work)
  if (waypoints) allPts.push(...waypoints)
  if (segments) segments.forEach(s => allPts.push(...parsePolyline(s.polyline)))
  if (allPts.length < 2) { ctx.fillStyle = '#a898b8'; ctx.font = '14px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('No route data', x + w/2, y + h/2); return }

  const lngs = allPts.map(p => p.lng), lats = allPts.map(p => p.lat)
  const minL = Math.min(...lngs), maxL = Math.max(...lngs), minA = Math.min(...lats), maxA = Math.max(...lats)
  const pad = Math.max((maxA - minA) * 0.15, (maxL - minL) * 0.15, 0.005)
  const mnLa = minA - pad, mxLa = maxA + pad, mnLo = minL - pad, mxLo = maxL + pad
  const rL = mxLo - mnLo || 0.01, rA = mxLa - mnLa || 0.01
  const sc = Math.min((w - P * 2) / rL, (h - P * 2) / rA)
  const ox = x + (w - rL * sc) / 2, oy = y + (h - rA * sc) / 2
  const tx = l => ox + (l - mnLo) * sc, ty = a => oy + (mxLa - a) * sc

  // Map background
  ctx.fillStyle = '#faf7fc'
  ctx.fillRect(x + 4, y + 4, w - 8, h - 8)

  // Route polylines
  if (segments) segments.forEach(s => {
    const pts = parsePolyline(s.polyline); if (pts.length < 2) return
    ctx.strokeStyle = 'rgba(240,140,164,0.25)'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    ctx.beginPath(); ctx.moveTo(tx(pts[0].lng), ty(pts[0].lat)); for (let i = 1; i < pts.length; i++) ctx.lineTo(tx(pts[i].lng), ty(pts[i].lat)); ctx.stroke()
    ctx.strokeStyle = '#f08ca4'; ctx.lineWidth = 2.5
    ctx.beginPath(); ctx.moveTo(tx(pts[0].lng), ty(pts[0].lat)); for (let i = 1; i < pts.length; i++) ctx.lineTo(tx(pts[i].lng), ty(pts[i].lat)); ctx.stroke()
  })

  // Waypoints
  if (waypoints) waypoints.forEach((w, i) => {
    const cx = tx(w.lng), cy = ty(w.lat)
    ctx.beginPath(); ctx.arc(cx, cy, 4.5, 0, Math.PI * 2)
    ctx.fillStyle = '#8cb8a8'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke()
  })

  // Home
  if (home) {
    const cx = tx(home.lng), cy = ty(home.lat)
    ctx.beginPath(); ctx.arc(cx, cy, 6.5, 0, Math.PI * 2); ctx.fillStyle = '#22c55e'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke()
  }

  // Work
  if (work) {
    const cx = tx(work.lng), cy = ty(work.lat)
    ctx.beginPath(); ctx.arc(cx, cy, 6.5, 0, Math.PI * 2); ctx.fillStyle = '#f0a870'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke()
  }

  // Supply points
  if (supplyPoints) supplyPoints.forEach(sp => {
    const cx = tx(sp.lng), cy = ty(sp.lat)
    ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.fillStyle = '#7c3aed'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke()
  })
}

export function generateShareImage(routeData) {
  const { title, subtitle, stats, segments, waypoints, home, work } = routeData
  const W = 720, H = 960, P = 36

  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')

  // Background gradient
  const bg = ctx.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, '#fef6f8'); bg.addColorStop(0.5, '#faf1f5'); bg.addColorStop(1, '#f3f0f7')
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H)

  // Top card
  ctx.fillStyle = '#fff'
  roundRect(ctx, P, P, W - P * 2, H - P * 2, 20)
  ctx.fill()

  // Border
  ctx.strokeStyle = '#f2eaf4'; ctx.lineWidth = 2
  roundRect(ctx, P, P, W - P * 2, H - P * 2, 20); ctx.stroke()

  // Header
  ctx.fillStyle = '#d48195'; ctx.font = 'bold 28px "Segoe UI", sans-serif'; ctx.textAlign = 'center'
  ctx.fillText('🚴 ' + (title || 'RandomPath'), W / 2, P + 42)

  if (subtitle) {
    ctx.fillStyle = '#a898b8'; ctx.font = '16px "Segoe UI", sans-serif'
    ctx.fillText(subtitle, W / 2, P + 66)
  }

  // Route map
  const mapY = P + 90, mapH = 400
  ctx.fillStyle = '#faf7fc'
  ctx.fillRect(P + 12, mapY, W - (P + 12) * 2, mapH)
  ctx.strokeStyle = '#e5dcec'; ctx.lineWidth = 1
  ctx.strokeRect(P + 12, mapY, W - (P + 12) * 2, mapH)

  drawRouteMap(ctx, { segments, waypoints, home, work }, { x: P + 12, y: mapY, w: W - (P + 12) * 2, h: mapH })

  // Stats
  const statY = mapY + mapH + 24
  const statsData = stats || [
    { label: '总距离', value: (routeData.totalDistance / 1000).toFixed(1) + ' km' },
    { label: '预计', value: Math.round(routeData.totalDuration / 60) + ' 分钟' },
    { label: '途经点', value: (waypoints?.length || 0) + ' 个' },
  ]

  const statW = (W - P * 2) / statsData.length
  statsData.forEach((st, i) => {
    const sx = P + i * statW
    ctx.fillStyle = '#fef6f8'
    roundRect(ctx, sx + 4, statY - 2, statW - 8, 60, 10); ctx.fill()
    ctx.strokeStyle = '#fce8ee'; ctx.lineWidth = 1
    roundRect(ctx, sx + 4, statY - 2, statW - 8, 60, 10); ctx.stroke()

    ctx.fillStyle = '#e27790'; ctx.font = 'bold 22px "Segoe UI", sans-serif'; ctx.textAlign = 'center'
    ctx.fillText(st.value, sx + statW / 2, statY + 22)
    ctx.fillStyle = '#a898b8'; ctx.font = '12px "Segoe UI", sans-serif'
    ctx.fillText(st.label, sx + statW / 2, statY + 44)
  })

  // Footer
  const footerY = statY + 80
  ctx.fillStyle = '#a898b8'; ctx.font = '11px "Segoe UI", sans-serif'; ctx.textAlign = 'center'
  ctx.fillText('RandomPath · 随机骑行路线生成器', W / 2, footerY)
  ctx.fillText('likemyproject.github.io/random-path', W / 2, footerY + 18)

  return canvas
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

export async function shareImage(canvas, filename = 'RandomPath_route.png') {
  // Try Web Share API first (mobile)
  if (navigator.canShare) {
    const blob = await new Promise(r => canvas.toBlob(r, 'image/png'))
    const file = new File([blob], filename, { type: 'image/png' })
    if (navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: 'RandomPath 骑行路线' }); return 'shared' } catch(e) {}
    }
  }
  // Fallback: download
  canvas.toBlob(blob => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = filename
    a.click(); URL.revokeObjectURL(url)
  }, 'image/png')
  return 'downloaded'
}

export async function copyShareImage(canvas) {
  const blob = await new Promise(r => canvas.toBlob(r, 'image/png'))
  try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); return true } catch(e) { return false }
}

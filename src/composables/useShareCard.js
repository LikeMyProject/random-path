import { parsePolyline } from '../utils/math.js'

const W = 720, H = 1000

export function drawRouteMap(ctx, { segments, waypoints, home, work, uphillSections, downhillSections }, opts = {}) {
  const { x = 0, y = 0, w = W, h = 400 } = opts
  const P = 20
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

  ctx.fillStyle = '#f8f9fb'; ctx.fillRect(x + 2, y + 2, w - 4, h - 4)

  if (segments) segments.forEach(s => {
    const pts = parsePolyline(s.polyline); if (pts.length < 2) return
    ctx.strokeStyle = 'rgba(240,140,164,0.3)'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    ctx.beginPath(); ctx.moveTo(tx(pts[0].lng), ty(pts[0].lat)); for (let i = 1; i < pts.length; i++) ctx.lineTo(tx(pts[i].lng), ty(pts[i].lat)); ctx.stroke()
    ctx.strokeStyle = '#f08ca4'; ctx.lineWidth = 2.5
    ctx.beginPath(); ctx.moveTo(tx(pts[0].lng), ty(pts[0].lat)); for (let i = 1; i < pts.length; i++) ctx.lineTo(tx(pts[i].lng), ty(pts[i].lat)); ctx.stroke()
  })

  // uphill/downhill overlays
  const drawSlope = (sections, color) => {
    if (!sections) return
    for (const sec of sections) {
      const path = sec.path && sec.path.length >= 2 ? sec.path : [sec.startCoord, sec.endCoord]
      if (!path || path.length < 2) continue
      ctx.strokeStyle = color; ctx.lineWidth = 5; ctx.lineCap = 'round'
      ctx.beginPath(); ctx.moveTo(tx(path[0].lng), ty(path[0].lat))
      for (let k = 1; k < path.length; k++) ctx.lineTo(tx(path[k].lng), ty(path[k].lat))
      ctx.stroke()
    }
  }
  drawSlope(uphillSections, 'rgba(220,38,38,0.5)')
  drawSlope(downhillSections, 'rgba(22,163,74,0.5)')

  if (waypoints) waypoints.forEach((w, i) => {
    const cx = tx(w.lng), cy = ty(w.lat)
    ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.fillStyle = '#6366f1'; ctx.fill()
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke()
  })
  if (home) { const cx = tx(home.lng), cy = ty(home.lat); ctx.beginPath(); ctx.arc(cx, cy, 7, 0, Math.PI * 2); ctx.fillStyle = '#22c55e'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke() }
  if (work) { const cx = tx(work.lng), cy = ty(work.lat); ctx.beginPath(); ctx.arc(cx, cy, 7, 0, Math.PI * 2); ctx.fillStyle = '#f97316'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke() }
}

export function generateShareImage(routeData) {
  const { title, subtitle, totalDistance, totalDuration, totalClimb, segments, waypoints, home, work, uphillSections, downhillSections } = routeData
  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')

  // Background
  const bg = ctx.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, '#1e1b4b'); bg.addColorStop(1, '#312e81')
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H)

  // Header
  ctx.fillStyle = '#fff'; ctx.font = 'bold 32px "Segoe UI", sans-serif'; ctx.textAlign = 'center'
  ctx.fillText('🚴 RandomPath', W / 2, 56)
  ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = '15px "Segoe UI", sans-serif'
  ctx.fillText(title || '骑行路线', W / 2, 82)

  // Main card
  const cardTop = 110, cardH = H - cardTop - 40
  ctx.fillStyle = '#fff'; roundRect(ctx, 24, cardTop, W - 48, cardH, 18); ctx.fill()

  // Route map inside card
  const mapTop = cardTop + 28, mapH = 380
  ctx.fillStyle = '#f8f9fb'; roundRect(ctx, 40, mapTop, W - 80, mapH, 12); ctx.fill()
  ctx.strokeStyle = '#e5e7eb'; ctx.lineWidth = 1
  roundRect(ctx, 40, mapTop, W - 80, mapH, 12); ctx.stroke()
  drawRouteMap(ctx, { segments, waypoints, home, work, uphillSections, downhillSections }, { x: 40, y: mapTop, w: W - 80, h: mapH })

  // Big stats
  const stY = mapTop + mapH + 30, stW = (W - 80) / 3
  const bigStats = [
    { val: (totalDistance / 1000).toFixed(1), unit: 'km', label: '总距离' },
    { val: Math.round(totalDuration / 60), unit: 'min', label: '预计时间' },
    { val: totalClimb || 0, unit: 'm', label: '总爬升' },
  ]
  bigStats.forEach((st, i) => {
    const sx = 52 + i * stW
    // Value
    ctx.fillStyle = '#1e1b4b'; ctx.font = 'bold 36px "Segoe UI", sans-serif'; ctx.textAlign = 'center'
    ctx.fillText(st.val, sx + stW / 2, stY + 20)
    // Unit
    ctx.fillStyle = '#6366f1'; ctx.font = 'bold 16px "Segoe UI", sans-serif'
    ctx.fillText(st.unit, sx + stW / 2 + ctx.measureText(String(st.val)).width / 2 + 10, stY + 22)
    // Label
    ctx.fillStyle = '#9ca3af'; ctx.font = '13px "Segoe UI", sans-serif'
    ctx.fillText(st.label, sx + stW / 2, stY + 50)
  })

  // Secondary stats row
  const ssY = stY + 72, ssW = (W - 80) / 4
  const secStats = [
    { val: (waypoints?.length || 0) + '个', label: '途经点' },
    { val: (uphillSections?.length || 0) + '段', label: '上坡' },
    { val: (downhillSections?.length || 0) + '段', label: '下坡' },
    { val: subtitle?.split('·')[0]?.trim() || '', label: '速度' },
  ]
  secStats.forEach((st, i) => {
    const sx = 52 + i * ssW
    ctx.fillStyle = '#374151'; ctx.font = 'bold 18px "Segoe UI", sans-serif'; ctx.textAlign = 'center'
    ctx.fillText(st.val, sx + ssW / 2, ssY + 12)
    ctx.fillStyle = '#9ca3af'; ctx.font = '11px "Segoe UI", sans-serif'
    ctx.fillText(st.label, sx + ssW / 2, ssY + 32)
  })

  // Footer
  const ftY = cardTop + cardH - 30
  ctx.fillStyle = '#9ca3af'; ctx.font = '11px "Segoe UI", sans-serif'; ctx.textAlign = 'center'
  ctx.fillText('RandomPath · 随机骑行路线生成器 · radom-path-vue.vercel.app', W / 2, ftY)

  return canvas
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath()
}

export async function shareImage(canvas, filename = 'RandomPath_route.png') {
  if (navigator.canShare) {
    const blob = await new Promise(r => canvas.toBlob(r, 'image/png'))
    const file = new File([blob], filename, { type: 'image/png' })
    if (navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: 'RandomPath 骑行路线' }); return 'shared' } catch(e) {}
    }
  }
  canvas.toBlob(blob => { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url) }, 'image/png')
  return 'downloaded'
}

export async function copyShareImage(canvas) {
  const blob = await new Promise(r => canvas.toBlob(r, 'image/png'))
  try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); return true } catch(e) { return false }
}

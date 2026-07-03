<script setup>
import { ref, onMounted, watch, nextTick } from 'vue'
import { parsePolyline } from '../utils/math.js'
const props = defineProps({ segments: Array, waypoints: Array, home: Object, work: Object })
const cvs = ref(null)
const W = 720, H = 440, P = 40
function draw() {
  const cv = cvs.value; if (!cv) return
  const dpr = window.devicePixelRatio || 1
  const w = cv.clientWidth || 360, h = 220
  cv.width = w * dpr; cv.height = h * dpr; cv.style.width = w + 'px'; cv.style.height = h + 'px'
  const ctx = cv.getContext('2d'); ctx.scale(dpr, dpr)
  const allPts = []
  if (props.home) allPts.push(props.home)
  if (props.work) allPts.push(props.work)
  if (props.waypoints) allPts.push(...props.waypoints)
  if (props.segments) props.segments.forEach(s => allPts.push(...parsePolyline(s.polyline)))
  if (allPts.length < 2) { ctx.fillStyle = '#a898b8'; ctx.font = '14px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('No route data', w/2, h/2); return }
  const lngs = allPts.map(p => p.lng), lats = allPts.map(p => p.lat)
  const minL = Math.min(...lngs), maxL = Math.max(...lngs), minA = Math.min(...lats), maxA = Math.max(...lats)
  const padLat = Math.max((maxA - minA) * 0.12, 0.003), padLng = Math.max((maxL - minL) * 0.12, 0.003)
  const mnLa = minA - padLat, mxLa = maxA + padLat, mnLo = minL - padLng, mxLo = maxL + padLng
  const rL = mxLo - mnLo || 0.01, rA = mxLa - mnLa || 0.01
  const sc = Math.min((w-P*2)/rL, (h-P*2)/rA)
  const ox = (w - rL * sc) / 2, oy = (h - rA * sc) / 2
  const tx = l => ox + (l - mnLo) * sc, ty = a => oy + (mxLa - a) * sc
  ctx.fillStyle = '#faf7fc'; ctx.fillRect(0, 0, w, h)
  if (props.segments) props.segments.forEach(s => {
    const pts = parsePolyline(s.polyline); if (pts.length < 2) return
    ctx.strokeStyle = 'rgba(240,140,164,0.2)'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    ctx.beginPath(); ctx.moveTo(tx(pts[0].lng), ty(pts[0].lat)); for (let i = 1; i < pts.length; i++) ctx.lineTo(tx(pts[i].lng), ty(pts[i].lat)); ctx.stroke()
    ctx.strokeStyle = '#f08ca4'; ctx.lineWidth = 2.8
    ctx.beginPath(); ctx.moveTo(tx(pts[0].lng), ty(pts[0].lat)); for (let i = 1; i < pts.length; i++) ctx.lineTo(tx(pts[i].lng), ty(pts[i].lat)); ctx.stroke()
  })
  if (props.waypoints) props.waypoints.forEach(w => {
    ctx.beginPath(); ctx.arc(tx(w.lng), ty(w.lat), 4.5, 0, Math.PI*2)
    ctx.fillStyle = '#8cb8a8'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke()
  })
  if (props.home) { ctx.beginPath(); ctx.arc(tx(props.home.lng), ty(props.home.lat), 6, 0, Math.PI*2); ctx.fillStyle = '#22c55e'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke() }
  if (props.work) { ctx.beginPath(); ctx.arc(tx(props.work.lng), ty(props.work.lat), 6, 0, Math.PI*2); ctx.fillStyle = '#f0a870'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke() }
  ctx.fillStyle = '#a898b8'; ctx.font = 'bold 11px sans-serif'; ctx.fillText('↑ N', w - P + 4, P - 4)
}
onMounted(draw)
watch(() => [props.segments, props.waypoints], () => nextTick(draw), { deep: true })
</script>
<template>
  <canvas ref="cvs" class="route-thumb" />
</template>
<style scoped>
.route-thumb { width: 100%; border-radius: 12px; background: #faf7fc; border: 1.5px solid #f2eaf4; display: block; }
</style>

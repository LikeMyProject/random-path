<script setup>
import { ref, onMounted, watch, nextTick } from 'vue'
import { parsePolyline } from '../utils/math.js'

const props = defineProps({
  segments: Array, waypoints: Array, home: Object, work: Object,
  supplyPoints: Array, highlightIndex: { type: Number, default: -1 }
})
const emit = defineEmits(['supply-click'])

const cvs = ref(null)
const W = 960, H = 640, P = 44
const supplyPositions = ref([])
let flashTimer = null, flashCount = 0

// zoom & pan state
const zoom = ref(1), panX = ref(0), panY = ref(0)
let dragging = false, lastX = 0, lastY = 0

function zoomIn() {
  const r = Math.min(20, zoom.value * 2) / zoom.value
  panX.value *= r; panY.value *= r; zoom.value *= r
}
function zoomOut() {
  const r = Math.max(1, zoom.value / 2) / zoom.value
  panX.value *= r; panY.value *= r; zoom.value *= r
  if (zoom.value <= 1) { panX.value = 0; panY.value = 0 }
}
function resetView() { zoom.value = 1; panX.value = 0; panY.value = 0 }

// flash states: -1=hidden, 0=normal, 1=big, 2=bigger
function flashMarker(index) {
  if (flashTimer) { clearInterval(flashTimer); flashCount = 0 }
  if (index < 0) { draw(); return }
  // auto-reset zoom and scroll into view
  resetView()
  nextTick(() => { cvs.value?.scrollIntoView?.({ behavior: 'smooth', block: 'center' }) })
  flashCount = 0
  const steps = [1, 2, 1, 2, 1, 2, 0] // big→bigger→big→bigger→big→bigger→normal
  flashTimer = setInterval(() => {
    draw(flashCount < steps.length ? { index, flash: steps[flashCount] } : { index: -1, flash: 0 })
    flashCount++
    if (flashCount > steps.length) { clearInterval(flashTimer); flashTimer = null; draw() }
  }, 200)
}

watch(() => props.highlightIndex, (idx) => flashMarker(idx))

function draw(flashInfo = { index: -1, flash: 0 }) {
  const cv = cvs.value; if (!cv) return
  const dpr = window.devicePixelRatio || 1
  // 用 parent 宽度，不用 clientWidth（避免回流循环）
  const w = 360, h = 320
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
  const padLat = Math.max((maxA - minA) * 0.15, 0.005), padLng = Math.max((maxL - minL) * 0.15, 0.005)
  const mnLa = minA - padLat, mxLa = maxA + padLat, mnLo = minL - padLng, mxLo = maxL + padLng
  const rL = mxLo - mnLo || 0.01, rA = mxLa - mnLa || 0.01
  const sc = Math.min((w-P*2)/rL, (h-P*2)/rA)
  const ox = (w - rL * sc) / 2, oy = (h - rA * sc) / 2
  const tx = l => ox + (l - mnLo) * sc, ty = a => oy + (mxLa - a) * sc

  // fixed background (always full size)
  ctx.fillStyle = '#faf7fc'; ctx.fillRect(0, 0, w, h)

  // apply zoom/pan as canvas transform (only affects route content)
  ctx.save()
  const z = zoom.value
  ctx.translate(w/2 + panX.value, h/2 + panY.value)
  ctx.scale(z, z)
  ctx.translate(-w/2, -h/2)

  // route polylines
  if (props.segments) props.segments.forEach(s => {
    const pts = parsePolyline(s.polyline); if (pts.length < 2) return
    ctx.strokeStyle = 'rgba(240,140,164,0.25)'; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    ctx.beginPath(); ctx.moveTo(tx(pts[0].lng), ty(pts[0].lat)); for (let i = 1; i < pts.length; i++) ctx.lineTo(tx(pts[i].lng), ty(pts[i].lat)); ctx.stroke()
    ctx.strokeStyle = '#f08ca4'; ctx.lineWidth = 3
    ctx.beginPath(); ctx.moveTo(tx(pts[0].lng), ty(pts[0].lat)); for (let i = 1; i < pts.length; i++) ctx.lineTo(tx(pts[i].lng), ty(pts[i].lat)); ctx.stroke()
  })

  // waypoints
  if (props.waypoints) props.waypoints.forEach((w, i) => {
    const x = tx(w.lng), y = ty(w.lat)
    ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI*2)
    ctx.fillStyle = '#8cb8a8'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke()
    ctx.fillStyle = '#5e5468'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'
    ctx.fillText('途经' + (i+1), x + 7, y - 2)
  })

  // start
  if (props.home) {
    const x = tx(props.home.lng), y = ty(props.home.lat)
    ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI*2); ctx.fillStyle = '#22c55e'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.stroke()
    ctx.fillStyle = '#166534'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'
    ctx.fillText('起', x + 9, y + 4)
  }

  // end
  if (props.work) {
    const x = tx(props.work.lng), y = ty(props.work.lat)
    ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI*2); ctx.fillStyle = '#f0a870'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.stroke()
    ctx.fillStyle = '#9a3412'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'
    ctx.fillText('终', x + 9, y + 4)
  }

  // supply points - purple circles
  const pos = []
  if (props.supplyPoints) props.supplyPoints.forEach((sp, i) => {
    const x = tx(sp.lng), y = ty(sp.lat)
    pos.push({ x, y })
    const isFlashing = flashInfo.index === i
    const flashScale = isFlashing ? (flashInfo.flash === 1 ? 1.8 : flashInfo.flash === 2 ? 2.5 : 1) : 1
    const r = 6.5 * flashScale
    if (isFlashing) {
      ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 16
      ctx.beginPath(); ctx.arc(x, y, r + 4, 0, Math.PI*2)
      ctx.fillStyle = 'rgba(251,191,36,0.3)'; ctx.fill()
      ctx.shadowBlur = 0
    }
    ctx.shadowColor = isFlashing ? '#f59e0b' : '#7c3aed'; ctx.shadowBlur = isFlashing ? 12 : 8
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2)
    ctx.fillStyle = isFlashing ? '#f59e0b' : '#7c3aed'; ctx.fill()
    ctx.shadowBlur = 0
    ctx.strokeStyle = '#fff'; ctx.lineWidth = isFlashing ? 3 : 2; ctx.stroke()
    ctx.fillStyle = '#fff'; ctx.font = `bold ${Math.max(9, 10 * flashScale)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(i + 1, x, y)
  })
  supplyPositions.value = pos

  // restore transform (back to fixed coordinates)
  ctx.restore()

  // north arrow (fixed position, outside zoom/pan)
  ctx.fillStyle = '#a898b8'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'right'
  ctx.fillText('↑ 北', w - P + 4, P - 4)
}

// click on supply markers (account for zoom/pan transform)
function onCanvasClick(e) {
  const cv = cvs.value; if (!cv) return
  const rect = cv.getBoundingClientRect()
  const dpr = window.devicePixelRatio || 1
  const cx = (e.clientX - rect.left) * dpr
  const cy = (e.clientY - rect.top) * dpr
  const w = 360, h = 320
  const z = zoom.value
  // inverse transform: screen → drawing coords
  const dx = (cx - w/2 - panX.value) / z + w/2
  const dy = (cy - h/2 - panY.value) / z + h/2
  for (let i = 0; i < supplyPositions.value.length; i++) {
    const { x, y } = supplyPositions.value[i]
    if (Math.sqrt((dx - x) ** 2 + (dy - y) ** 2) < 14) {
      emit('supply-click', i)
      return
    }
  }
}

// drag to pan
function onMouseDown(e) {
  if (zoom.value <= 1) return
  dragging = true; lastX = e.clientX; lastY = e.clientY
}
function onMouseMove(e) {
  if (!dragging) return
  panX.value += e.clientX - lastX
  panY.value += e.clientY - lastY
  lastX = e.clientX; lastY = e.clientY
}
function onMouseUp() { dragging = false }
function onTouchStart(e) {
  if (zoom.value <= 1) return
  if (e.touches.length !== 1) { dragging = false; return }
  dragging = true; lastX = e.touches[0].clientX; lastY = e.touches[0].clientY
}
function onTouchMove(e) {
  if (!dragging) return
  panX.value += e.touches[0].clientX - lastX
  panY.value += e.touches[0].clientY - lastY
  lastX = e.touches[0].clientX; lastY = e.touches[0].clientY
}
function onTouchEnd() { dragging = false }

onMounted(draw)
watch(() => [props.segments, props.waypoints, props.supplyPoints, props.highlightIndex, zoom.value, panX.value, panY.value],
  () => nextTick(draw), { deep: true })
</script>
<template>
  <div class="thumb-wrap">
    <canvas ref="cvs" class="route-thumb" :class="{zoomable: zoom>1}"
      @click="onCanvasClick"
      @mousedown="onMouseDown" @mousemove="onMouseMove" @mouseup="onMouseUp" @mouseleave="onMouseUp"
      @touchstart.prevent="onTouchStart" @touchmove.prevent="onTouchMove" @touchend="onTouchEnd" />
    <div class="zoom-btns">
      <button class="zbtn" @click="zoomIn" :disabled="zoom>=20" title="放大">＋</button>
      <button class="zbtn" @click="zoomOut" :disabled="zoom<=1" title="缩小">－</button>
      <button v-if="zoom>1" class="zbtn reset" @click="resetView" title="重置">↺</button>
    </div>
  </div>
</template>
<style scoped>
.thumb-wrap { position: relative; }
.route-thumb { width: 360px; max-width: 100%; border-radius: 12px; background: #faf7fc; border: 1.5px solid #f2eaf4; display: block; }
.route-thumb.zoomable { cursor: grab; }
.thumb-wrap { }
.zoom-btns { position: absolute; top: 6px; right: 6px; display: flex; gap: 3px; z-index: 5; }
.zbtn { width: 26px; height: 26px; border-radius: 6px; border: 1px solid #ddd6fe; background: rgba(255,255,255,0.9); color: #7c3aed; font-size: 16px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0; line-height: 1; }
.zbtn:disabled { opacity: 0.3; cursor: default; }
.zbtn.reset { font-size: 14px; }
</style>

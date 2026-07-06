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
let dragging = false, dragStart = { x: 0, y: 0 }, panStart = { x: 0, y: 0 }

function zoomIn() { zoom.value = Math.min(20, zoom.value * 2) }
function zoomOut() { zoom.value = Math.max(1, zoom.value / 2); if (zoom.value <= 1) { panX.value = 0; panY.value = 0 } }
function resetView() { zoom.value = 1; panX.value = 0; panY.value = 0 }

function flashMarker(index) {
  if (flashTimer) { clearInterval(flashTimer); flashCount = 0 }
  if (index < 0) { draw(); return }
  flashCount = 0
  flashTimer = setInterval(() => {
    flashCount++
    draw(flashCount % 2 === 0 ? index : -1)
    if (flashCount >= 6) { clearInterval(flashTimer); flashTimer = null; draw() }
  }, 160)
}

watch(() => props.highlightIndex, (idx) => flashMarker(idx))

function draw(hideIndex = -1) {
  const cv = cvs.value; if (!cv) return
  const dpr = window.devicePixelRatio || 1
  const w = cv.clientWidth || 360, h = 320
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

  const z = zoom.value
  const sc = Math.min((w-P*2)/rL, (h-P*2)/rA) * z
  const ox = (w - rL * sc) / 2 + panX.value, oy = (h - rA * sc) / 2 + panY.value
  const tx = l => ox + (l - mnLo) * sc, ty = a => oy + (mxLa - a) * sc

  ctx.fillStyle = '#faf7fc'; ctx.fillRect(0, 0, w, h)

  // route polylines
  if (props.segments) props.segments.forEach(s => {
    const pts = parsePolyline(s.polyline); if (pts.length < 2) return
    ctx.strokeStyle = 'rgba(240,140,164,0.25)'; ctx.lineWidth = 7 * z; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    ctx.beginPath(); ctx.moveTo(tx(pts[0].lng), ty(pts[0].lat)); for (let i = 1; i < pts.length; i++) ctx.lineTo(tx(pts[i].lng), ty(pts[i].lat)); ctx.stroke()
    ctx.strokeStyle = '#f08ca4'; ctx.lineWidth = 3 * z
    ctx.beginPath(); ctx.moveTo(tx(pts[0].lng), ty(pts[0].lat)); for (let i = 1; i < pts.length; i++) ctx.lineTo(tx(pts[i].lng), ty(pts[i].lat)); ctx.stroke()
  })

  const mrkR = 5 * z, lblFont = Math.max(9, 10 * z)

  // waypoints
  if (props.waypoints) props.waypoints.forEach((w, i) => {
    const x = tx(w.lng), y = ty(w.lat)
    ctx.beginPath(); ctx.arc(x, y, mrkR, 0, Math.PI*2)
    ctx.fillStyle = '#8cb8a8'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke()
    if (z < 2.5) {
      ctx.fillStyle = '#5e5468'; ctx.font = `bold ${lblFont}px sans-serif`; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'
      ctx.fillText('途经' + (i+1), x + 7, y - 2)
    }
  })

  // start
  if (props.home) {
    const x = tx(props.home.lng), y = ty(props.home.lat)
    ctx.beginPath(); ctx.arc(x, y, 7 * z, 0, Math.PI*2); ctx.fillStyle = '#22c55e'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.stroke()
    ctx.fillStyle = '#166534'; ctx.font = `bold ${lblFont}px sans-serif`; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'
    ctx.fillText('起', x + 9, y + 4)
  }

  // end
  if (props.work) {
    const x = tx(props.work.lng), y = ty(props.work.lat)
    ctx.beginPath(); ctx.arc(x, y, 7 * z, 0, Math.PI*2); ctx.fillStyle = '#f0a870'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.stroke()
    ctx.fillStyle = '#9a3412'; ctx.font = `bold ${lblFont}px sans-serif`; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'
    ctx.fillText('终', x + 9, y + 4)
  }

  // supply points - purple circles
  const pos = []
  const supR = 6.5 * z
  if (props.supplyPoints) props.supplyPoints.forEach((sp, i) => {
    const x = tx(sp.lng), y = ty(sp.lat)
    pos.push({ x, y })
    if (hideIndex === i) return
    ctx.shadowColor = '#7c3aed'; ctx.shadowBlur = 8 * z
    ctx.beginPath(); ctx.arc(x, y, supR, 0, Math.PI*2)
    ctx.fillStyle = '#7c3aed'; ctx.fill()
    ctx.shadowBlur = 0
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke()
    ctx.fillStyle = '#fff'; ctx.font = `bold ${lblFont}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(i + 1, x, y)
  })
  supplyPositions.value = pos

  // north arrow
  ctx.fillStyle = '#a898b8'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'right'
  ctx.fillText('↑ 北', w - P + 4, P - 4)
}

// click on supply markers
function onCanvasClick(e) {
  const cv = cvs.value; if (!cv) return
  const rect = cv.getBoundingClientRect()
  const sx = cv.width / (cv.clientWidth * (window.devicePixelRatio || 1))
  const sy = cv.height / (cv.clientHeight * (window.devicePixelRatio || 1))
  const cx = (e.clientX - rect.left) * sx, cy = (e.clientY - rect.top) * sy
  const hitR = 14 * zoom.value
  for (let i = 0; i < supplyPositions.value.length; i++) {
    const { x, y } = supplyPositions.value[i]
    if (Math.sqrt((cx - x) ** 2 + (cy - y) ** 2) < hitR) {
      emit('supply-click', i)
      return
    }
  }
}

// drag to pan
function onMouseDown(e) {
  if (zoom.value <= 1) return
  dragging = true
  dragStart = { x: e.clientX, y: e.clientY }
  panStart = { x: panX.value, y: panY.value }
}
function onMouseMove(e) {
  if (!dragging) return
  panX.value = panStart.x - (e.clientX - dragStart.x)
  panY.value = panStart.y - (e.clientY - dragStart.y)
}
function onMouseUp() { dragging = false }
function onTouchStart(e) {
  if (zoom.value <= 1 || e.touches.length !== 1) return
  dragging = true
  dragStart = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  panStart = { x: panX.value, y: panY.value }
}
function onTouchMove(e) {
  if (!dragging) return
  panX.value = panStart.x - (e.touches[0].clientX - dragStart.x)
  panY.value = panStart.y - (e.touches[0].clientY - dragStart.y)
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
.route-thumb { width: 100%; border-radius: 12px; background: #faf7fc; border: 1.5px solid #f2eaf4; display: block; }
.route-thumb.zoomable { cursor: grab; }
.zoom-btns { position: absolute; top: 6px; right: 6px; display: flex; gap: 3px; z-index: 5; }
.zbtn { width: 26px; height: 26px; border-radius: 6px; border: 1px solid #ddd6fe; background: rgba(255,255,255,0.9); color: #7c3aed; font-size: 16px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0; line-height: 1; }
.zbtn:disabled { opacity: 0.3; cursor: default; }
.zbtn.reset { font-size: 14px; }
</style>

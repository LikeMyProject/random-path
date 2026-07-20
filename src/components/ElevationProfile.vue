<script setup>
import { ref, onMounted, watch, nextTick } from 'vue'

const props = defineProps({ elevationProfile: Array, uphillSections: Array, downhillSections: Array })
const cvs = ref(null)
const W = 330, H = 120, PAD = { top: 16, bottom: 22, left: 32, right: 8 }

function draw() {
  const cv = cvs.value; const profile = props.elevationProfile
  if (!cv || !profile || profile.length < 2) return
  const dpr = window.devicePixelRatio || 1
  cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px'
  const ctx = cv.getContext('2d'); ctx.scale(dpr, dpr)

  const pw = W - PAD.left - PAD.right, ph = H - PAD.top - PAD.bottom
  const eles = profile.map(p => p.ele)
  const minE = Math.min(...eles), maxE = Math.max(...eles)
  const rE = maxE - minE || 1

  const x = i => PAD.left + (i / (profile.length - 1)) * pw
  const y = e => PAD.top + (1 - (e - minE) / rE) * ph

  // bg
  ctx.fillStyle = '#faf7fc'; ctx.fillRect(0, 0, W, H)

  // grid lines
  ctx.strokeStyle = '#e5dcec'; ctx.lineWidth = 0.5
  for (let i = 0; i <= 4; i++) { const gy = PAD.top + (ph / 4) * i; ctx.beginPath(); ctx.moveTo(PAD.left, gy); ctx.lineTo(W - PAD.right, gy); ctx.stroke() }

  // fill area under curve
  ctx.beginPath()
  ctx.moveTo(x(0), PAD.top + ph)
  for (let i = 0; i < profile.length; i++) ctx.lineTo(x(i), y(profile[i].ele))
  ctx.lineTo(x(profile.length - 1), PAD.top + ph)
  ctx.closePath()
  ctx.fillStyle = 'rgba(240,140,164,0.15)'; ctx.fill()

  // colored segments based on grade
  for (let i = 1; i < profile.length; i++) {
    const g = profile[i].grade || 0
    ctx.strokeStyle = g >= 5 ? 'rgba(239,68,68,0.6)' : g <= -5 ? 'rgba(34,197,94,0.6)' : 'rgba(148,163,184,0.4)'
    ctx.lineWidth = g >= 8 || g <= -8 ? 2.5 : 1.5
    ctx.beginPath(); ctx.moveTo(x(i - 1), y(profile[i - 1].ele)); ctx.lineTo(x(i), y(profile[i].ele)); ctx.stroke()
  }

  // axis labels
  ctx.fillStyle = '#a898b8'; ctx.font = '9px sans-serif'
  ctx.textAlign = 'right'; ctx.textBaseline = 'middle'
  ctx.fillText(Math.round(maxE) + 'm', PAD.left - 4, PAD.top)
  ctx.fillText(Math.round(minE) + 'm', PAD.left - 4, PAD.top + ph)
  ctx.textAlign = 'center'; ctx.textBaseline = 'top'
  ctx.fillText('0', PAD.left, PAD.top + ph + 4)
  const distKm = (profile[profile.length - 1].dist - profile[0].dist) / 1000
  ctx.fillText(distKm.toFixed(1) + 'km', W - PAD.right, PAD.top + ph + 4)

  // uphill/downhill indicators
  if (props.uphillSections?.length) { ctx.fillStyle = '#dc2626'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText('🔴上坡 ' + props.uphillSections.length + '段', PAD.left, 2) }
  if (props.downhillSections?.length) { ctx.fillStyle = '#16a34a'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'right'; ctx.textBaseline = 'top'; ctx.fillText(props.downhillSections.length + '段下坡🟢', W - PAD.right, 2) }
}

onMounted(draw)
watch(() => [props.elevationProfile, props.uphillSections, props.downhillSections], () => nextTick(draw), { deep: true })
</script>
<template>
  <canvas v-if="elevationProfile?.length >= 2" ref="cvs" class="elevation-chart" />
</template>
<style scoped>
.elevation-chart { width: 330px; max-width: 100%; height: 120px; border-radius: 10px; background: #faf7fc; border: 1px solid #f2eaf4; display: block; margin: 10px 0 }
</style>

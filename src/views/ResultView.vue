<script setup>
import { computed } from 'vue'
import { rateDifficulty } from '../composables/useScoring.js'
import { scoreRouteQuality, calcCalories, buildNavUrl } from '../composables/useRouteEngine.js'
import RouteThumbnail from '../components/RouteThumbnail.vue'
import ElevationProfile from '../components/ElevationProfile.vue'

const props = defineProps({
  result: Object,
  homeObj: Object,
  workObj: Object,
  hasDest: Boolean,
  collapseOpen: Boolean,
  loading: Boolean,
  villages: Array,
  supplyPoints: Array,
})

const emit = defineEmits([
  'update:collapseOpen',
  'openNav',
  'copyNav',
  'downloadGpx',
  'doShare',
  'regenerate',
])

const diffObj = computed(() => props.result ? rateDifficulty(props.result.totalDistance, props.result.totalClimb) : null)

const summaryHTML = computed(() => {
  if (!props.result) return ''
  const parts = []
  if (props.homeObj?.name) parts.push(`<strong>${props.homeObj.name}</strong>`)
  if (props.result.waypoints?.length) {
    parts.push(...props.result.waypoints.map((w, i) => w.poiName || `途经点${i + 1}`))
  }
  if (props.workObj?.name) parts.push(`<strong>${props.workObj.name}</strong>`)
  return parts.join(' → ')
})

// 沿途信息条
const routeContext = computed(() => {
  if (!props.result) return []
  const ctx = []
  const wp = props.result.waypoints || []
  if (wp.length > 0) ctx.push({ icon: '📍', text: `${wp.length} 个途经点` })
  if (props.result.uphillSections?.length) ctx.push({ icon: '🔴', text: `${props.result.uphillSections.length} 段上坡` })
  if (props.result.downhillSections?.length) ctx.push({ icon: '🟢', text: `${props.result.downhillSections.length} 段下坡` })
  if (props.villages?.length) ctx.push({ icon: '🏘', text: `经${props.villages.length}村` })
  if (props.supplyPoints?.length) ctx.push({ icon: '🟣', text: `${props.supplyPoints.length} 补给点` })
  if (props.result.totalClimb) ctx.push({ icon: '⛰', text: `爬升 ${props.result.totalClimb}m` })
  const tags = props.result.waypoints?.length ? scoreRouteQuality(props.result.waypoints).tags : []
  if (tags.length) ctx.push({ icon: '🏷', text: tags.join(' · ') })
  return ctx
})
</script>

<template>
  <div v-if="result" class="result-view card" style="animation:cardIn .4s cubic-bezier(.34,1.56,.64,1)">
    <!-- 标题栏 -->
    <div class="result-header">
      <div class="result-title">
        <span class="result-icon">{{ hasDest ? '📍' : '🔄' }}</span>
        <span>{{ hasDest ? '骑行路线' : '环线骑行' }}</span>
        <span v-if="diffObj" class="diff-badge" :style="{ background: diffObj.color }">{{ diffObj.label }}</span>
      </div>
      <div class="result-subtitle">{{ homeObj?.name || '起点' }}{{ hasDest ? ' → ' + (workObj?.name || '终点') : ' 出发兜一圈' }}</div>
    </div>

    <!-- 三大指标 -->
    <div class="stats">
      <div class="stat">
        <div class="val">{{ (result.totalDistance / 1000).toFixed(1) }}</div>
        <div class="lbl">总距离 km</div>
      </div>
      <div class="stat">
        <div class="val">{{ Math.round(result.totalDuration / 60) }}</div>
        <div class="lbl">预计 分钟</div>
      </div>
      <div class="stat">
        <div class="val small" :style="{ color: diffObj?.color }">{{ diffObj?.label }}</div>
        <div class="lbl">难度</div>
      </div>
    </div>

    <!-- 缩略图 -->
    <RouteThumbnail
      :segments="result.segments"
      :waypoints="result.waypoints"
      :home="homeObj"
      :work="workObj"
      :uphillSections="result.uphillSections"
      :downhillSections="result.downhillSections"
      :villages="villages"
      :supplyPoints="supplyPoints"
    />

    <!-- 图例 -->
    <div class="route-thumb-legend">
      <span>🟢 起点</span><span>🟠 终点</span><span>🔵 途经点</span>
      <span v-if="villages?.length">🏘 村庄</span>
      <span v-if="supplyPoints?.length">🟣 补给</span>
      <span>🔴 上坡</span><span>🟢 下坡</span><span>⬆ 北</span>
    </div>

    <!-- 沿途信息条 -->
    <div v-if="routeContext.length" class="route-context-strip">
      <span v-for="(ctx, i) in routeContext" :key="i" class="context-chip">
        {{ ctx.icon }} {{ ctx.text }}
      </span>
    </div>

    <!-- 路线文字描述 -->
    <div class="route-summary" v-html="summaryHTML" />

    <!-- 质量标签 -->
    <div v-if="scoreRouteQuality(result.waypoints || []).tags.length" class="quality-tags">
      <span v-for="t in scoreRouteQuality(result.waypoints || []).tags" :key="t" class="qtag">{{ t }}</span>
    </div>

    <!-- 高程图 -->
    <ElevationProfile
      v-if="result.elevationProfile"
      :elevationProfile="result.elevationProfile"
      :uphillSections="result.uphillSections"
      :downhillSections="result.downhillSections"
    />

    <!-- 详细数据折叠 -->
    <div class="collapse-toggle" :class="{ open: collapseOpen }" @click="emit('update:collapseOpen', !collapseOpen)">
      <span class="arrow">▶</span> 详细数据
    </div>
    <div class="collapse-body" :class="{ open: collapseOpen }">
      <div class="stats" style="margin-top:8px">
        <div class="stat">
          <div class="val small">{{ result.totalClimb != null ? result.totalClimb + 'm' : '--' }}</div>
          <div class="lbl">爬升 m</div>
        </div>
        <div class="stat">
          <div class="val small">{{ calcCalories(result.totalDistance, result.totalDuration) }}kcal</div>
          <div class="lbl">消耗</div>
        </div>
        <div class="stat">
          <div class="val small">{{ (result.waypoints || []).length }}</div>
          <div class="lbl">途经点</div>
        </div>
      </div>

      <!-- 分段详情 -->
      <div class="segments" v-if="result.segments?.length">
        <div class="seg" v-for="(seg, i) in result.segments" :key="i">
          <span class="seg-detail">
            第{{ i + 1 }}段: {{ i === 0 ? homeObj?.name : (result.waypoints?.[i - 1]?.poiName || '途经点' + i) }}
            → {{ i === result.segments.length - 1 ? workObj?.name : (result.waypoints?.[i]?.poiName || '途经点' + (i + 1)) }}
          </span>
          <span class="seg-nums">{{ (seg.distance / 1000).toFixed(1) }}km · {{ Math.round(seg.duration / 60) }}min</span>
        </div>
      </div>

      <!-- 途经点坐标 -->
      <div class="waypoints-info" v-if="result.waypoints?.length">
        <span v-for="(wp, i) in result.waypoints" :key="i">
          途经点{{ i + 1 }}: {{ wp.lng.toFixed(5) }}, {{ wp.lat.toFixed(5) }} {{ wp.poiName || '' }}
        </span>
      </div>

      <!-- 上坡 -->
      <div v-if="result.uphillSections?.length" class="slope-box uphill">
        <div class="slope-title">🔴 上坡路段 (坡度≥5%)</div>
        <div class="slope-item" v-for="(sec, i) in result.uphillSections" :key="'u' + i">
          <span class="slope-badge" :class="sec.avgGrade >= 8 ? 'steep' : 'moderate'">
            {{ sec.avgGrade >= 8 ? '🔴' : '🟠' }} 第{{ i + 1 }}段
          </span>
          <span class="slope-data">{{ sec.length }}km ↗{{ sec.climb }}m</span>
          <span class="slope-grade">均{{ sec.avgGrade }}% / 最{{ sec.maxGrade }}%</span>
        </div>
      </div>

      <!-- 下坡 -->
      <div v-if="result.downhillSections?.length" class="slope-box downhill">
        <div class="slope-title">🟢 下坡路段 (坡度≥5%)</div>
        <div class="slope-item" v-for="(sec, i) in result.downhillSections" :key="'d' + i">
          <span class="slope-badge">{{ sec.avgGrade >= 8 ? '🟢' : '🟢' }} 第{{ i + 1 }}段</span>
          <span class="slope-data">{{ sec.length }}km ↘{{ sec.descent }}m</span>
          <span class="slope-grade">均{{ sec.avgGrade }}% / 最{{ sec.maxGrade }}%</span>
        </div>
      </div>
    </div>

    <!-- 操作按钮 -->
    <button class="btn btn-primary" style="margin-top:10px" @click="emit('openNav')">🧭 开始导航</button>
    <div class="nav-link-box">
      <div class="label">高德导航链接（可复制）：</div>
      <div class="url">{{ buildNavUrl(homeObj || {}, workObj || {}, result.waypoints || []) }}</div>
    </div>
    <div style="display:flex;gap:8px;margin-top:8px">
      <button class="btn btn-sm btn-secondary" style="flex:1" @click="emit('copyNav')">📋 复制</button>
      <button class="btn btn-sm btn-secondary" style="flex:1" @click="emit('downloadGpx')">📥 GPX</button>
      <button class="btn btn-sm btn-secondary" style="flex:1;background:linear-gradient(135deg,#7c3aed,#a855f7);color:#fff" @click="emit('doShare')">📤 分享</button>
    </div>
    <button class="btn btn-secondary" style="margin-top:8px;width:100%" @click="emit('regenerate')">🔄 换一条</button>
  </div>
</template>

<style scoped>
.result-view {
  /* card class provides base styles */
}

.result-header {
  margin-bottom: 12px;
}
.result-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 16px;
  font-weight: 700;
  color: #4a3f55;
}
.result-icon { font-size: 20px; }
.result-subtitle {
  font-size: 11px;
  color: #a898b8;
  margin-top: 2px;
}

.diff-badge {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 8px;
  color: #fff;
  font-weight: 700;
  margin-left: auto;
}

.route-thumb-legend {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin: 8px 0 4px;
  font-size: 10px;
  color: #8a8098;
}

/* 沿途信息条 */
.route-context-strip {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin: 8px 0;
  padding: 10px 12px;
  background: linear-gradient(135deg, #f8f4fb, #fdf2f8);
  border-radius: 12px;
  border: 1px solid #f2eaf4;
}
.context-chip {
  font-size: 11px;
  font-weight: 600;
  color: #5e5468;
  white-space: nowrap;
}

.route-summary {
  font-size: 12px;
  color: #8a8098;
  line-height: 1.6;
  margin: 8px 0;
  padding: 8px 12px;
  background: #fdfbff;
  border-radius: 8px;
  border: 1px dashed #ece0ec;
}

.quality-tags {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  margin: 6px 0;
}
.qtag {
  font-size: 10px;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 6px;
  background: #f0fdf4;
  color: #166534;
  border: 1px solid #bbf7d0;
}

.nav-link-box {
  margin-top: 8px;
  padding: 8px 10px;
  background: #faf7fc;
  border-radius: 8px;
  border: 1px dashed #ece0ec;
}
.nav-link-box .label {
  font-size: 10px;
  color: #a898b8;
  margin-bottom: 4px;
}
.nav-link-box .url {
  font-size: 10px;
  color: #7c3aed;
  word-break: break-all;
  line-height: 1.4;
}

/* collapse styles */
.collapse-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 0;
  font-size: 12px;
  font-weight: 600;
  color: #8a8098;
  cursor: pointer;
  user-select: none;
}
.collapse-toggle .arrow {
  transition: transform .2s;
  font-size: 9px;
}
.collapse-toggle.open .arrow {
  transform: rotate(90deg);
}
.collapse-body {
  display: none;
}
.collapse-body.open {
  display: block;
}

.segments {
  margin-top: 8px;
}
.seg {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 5px 0;
  border-bottom: 1px dashed #f2eaf4;
  font-size: 11px;
}
.seg:last-child { border: none; }
.seg-detail { color: #8a8098; flex: 1; }
.seg-nums { color: #a898b8; white-space: nowrap; margin-left: 8px; font-weight: 600; }

.waypoints-info {
  margin-top: 8px;
  font-size: 10px;
  color: #a898b8;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.slope-box {
  margin-top: 10px;
  padding: 10px 12px;
  border-radius: 10px;
}
.slope-box.uphill {
  background: linear-gradient(135deg, #fff7ed, #fef2f2);
  border: 1px solid #fed7aa;
}
.slope-box.downhill {
  background: linear-gradient(135deg, #ecfdf5, #f0fdf4);
  border: 1px solid #bbf7d0;
}
.slope-title {
  font-size: 12px;
  font-weight: 700;
  margin-bottom: 6px;
}
.slope-box.uphill .slope-title { color: #c2410c; }
.slope-box.downhill .slope-title { color: #166534; }
.slope-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 0;
  font-size: 11px;
}
.slope-box.uphill .slope-item { border-bottom: 1px dashed #fce4d0; }
.slope-box.downhill .slope-item { border-bottom: 1px dashed #bbf7d0; }
.slope-item:last-child { border-bottom: none; }
.slope-badge {
  font-weight: 700;
  white-space: nowrap;
  font-size: 11px;
}
.slope-badge.moderate { color: #ea580c; }
.slope-badge.steep { color: #dc2626; }
.slope-data {
  font-weight: 600;
  color: #5e5468;
  white-space: nowrap;
}
.slope-grade {
  color: #a898b8;
  font-size: 10px;
  white-space: nowrap;
  margin-left: auto;
}

/* stat overrides for collapsed section */
.stats {
  display: flex;
  gap: 4px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}
.stat {
  flex: 1;
  min-width: 60px;
  background: linear-gradient(135deg, #fef6f8, #faf1f5);
  border-radius: 10px;
  padding: 10px 4px;
  text-align: center;
  border: 1.5px solid #fce8ee;
}
.stat .val {
  font-size: 18px;
  font-weight: 800;
  color: #e27790;
}
.stat .val.small {
  font-size: 14px;
}
.stat .lbl {
  font-size: 10px;
  color: #a898b8;
  margin-top: 2px;
  font-weight: 600;
}

.btn {
  display: block;
  width: 100%;
  border: none;
  border-radius: 12px;
  padding: 12px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  text-align: center;
  transition: all .2s;
}
.btn:active { transform: scale(.95); }
.btn-primary {
  background: linear-gradient(135deg, #f08ca4, #e27790);
  color: #fff;
  box-shadow: 0 3px 12px rgba(240, 140, 164, 0.3);
}
.btn-secondary {
  background: #f3f0f7;
  color: #8a7a98;
}
.btn-sm {
  display: inline-block;
  padding: 6px 12px;
  font-size: 11px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: all .2s;
  text-align: center;
}
.btn-sm:active { transform: scale(.95); }
</style>

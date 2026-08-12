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
  routeTags: Array,
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
        <span class="result-icon">{{ result.isRoundTrip ? '🎯' : hasDest ? '📍' : '🔄' }}</span>
        <span>{{ result.isRoundTrip ? `去 ${result.destName || '目的地'}` : hasDest ? '骑行路线' : '环线骑行' }}</span>
        <span v-if="diffObj" class="diff-badge" :style="{ background: diffObj.color }">{{ diffObj.label }}</span>
      </div>
      <div class="result-subtitle">{{ result.isRoundTrip ? `${homeObj?.name || '起点'} ⇄ ${result.destName || '目的地'}` : (homeObj?.name || '起点') + (hasDest ? ' → ' + (workObj?.name || '终点') : ' 出发兜一圈') }}</div>
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

    <!-- 路线属性标签 -->
    <div v-if="routeTags?.length || scoreRouteQuality(result.waypoints || []).tags.length" class="quality-tags">
      <span v-for="t in (routeTags || [])" :key="t.text" :class="['qtag', 'qtag-' + (t.category || 'nature')]">{{ t.text }}</span>
      <span v-for="t in scoreRouteQuality(result.waypoints || []).tags" :key="t" class="qtag qtag-quality">{{ t }}</span>
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
      <button class="btn-sm" style="flex:1;background:#f0edf5;color:#7a6c8a;border:none" @click="emit('copyNav')">📋 复制</button>
      <button class="btn-sm" style="flex:1;background:#f0edf5;color:#7a6c8a;border:none" @click="emit('downloadGpx')">📥 GPX</button>
      <button class="btn-sm" style="flex:1;background:linear-gradient(135deg,#7c3aed,#a855f7);color:#fff;border:none" @click="emit('doShare')">📤 分享</button>
    </div>
    <button class="btn-sm" style="margin-top:8px;width:100%;background:var(--accent-soft);color:var(--accent);border:none;padding:10px" @click="emit('regenerate')">🔄 换一条</button>
  </div>
</template>

<style scoped>
.result-header {
  margin-bottom: 14px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(0,0,0,.04);
}
.result-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 17px;
  font-weight: 800;
  color: #3a3045;
  letter-spacing: -.3px;
}
.result-icon { font-size: 22px; }
.result-subtitle {
  font-size: 12px;
  color: #a898b8;
  margin-top: 3px;
  font-weight: 500;
}

.diff-badge {
  font-size: 10px;
  padding: 3px 10px;
  border-radius: 10px;
  color: #fff;
  font-weight: 700;
  margin-left: auto;
  box-shadow: 0 2px 6px rgba(0,0,0,.12);
}

.route-thumb-legend {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin: 8px 0 4px;
  font-size: 10px;
  color: #a898b8;
}

/* 沿途信息条 */
.route-context-strip {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin: 10px 0;
  padding: 10px 14px;
  background: var(--accent-soft);
  border-radius: 12px;
  border: none;
}
.context-chip {
  font-size: 11px;
  font-weight: 600;
  color: var(--accent);
  white-space: nowrap;
}

.route-summary {
  font-size: 12px;
  color: #7a6c8a;
  line-height: 1.6;
  margin: 8px 0;
  padding: 10px 14px;
  background: #f7f5fa;
  border-radius: 10px;
  border: none;
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
  border: 1px solid rgba(187,247,208,.6);
}
.qtag-nature { background: #ecfdf5; color: #065f46; border-color: #a7f3d0; }
.qtag-cycling { background: #fff7ed; color: #9a3412; border-color: #fed7aa; }
.qtag-quality { background: #f0fdf4; color: #166534; border-color: #bbf7d0; }

.nav-link-box {
  margin-top: 8px;
  padding: 10px 12px;
  background: #f7f5fa;
  border-radius: 10px;
  border: none;
}
.nav-link-box .label {
  font-size: 10px;
  color: #b0a3bc;
  margin-bottom: 4px;
}
.nav-link-box .url {
  font-size: 10px;
  color: var(--accent);
  word-break: break-all;
  line-height: 1.4;
}
</style>

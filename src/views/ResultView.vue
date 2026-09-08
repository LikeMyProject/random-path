<script setup>
import { computed } from 'vue'
import { rateDifficulty } from '../composables/useScoring.js'
import { scoreRouteQuality, calcCalories, buildNavUrl } from '../composables/useRouteEngine.js'
import Icon from '../components/Icon.vue'
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

// 数据源标签可能带 emoji，统一剥离，保持界面克制
function stripEmoji(s) {
  return String(s || '').replace(/[\u{1F300}-\u{1FAFF}\u{2B00}-\u{2BFF}\uFE0F]/gu, '').trim()
}
// 难度标签数据源形如「★★★★★ 极限」，只留段位文字
const diffLabel = computed(() => String(diffObj.value?.label || '').replace(/[\u2605\u2606]/g, '').trim() || diffObj.value?.label || '--')

const qualityTags = computed(() => {
  const wps = props.result?.waypoints || []
  return (wps.length ? scoreRouteQuality(wps).tags : []).map(stripEmoji).filter(Boolean)
})

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
  if (wp.length > 0) ctx.push({ text: `${wp.length} 个途经点` })
  if (props.result.uphillSections?.length) ctx.push({ text: `${props.result.uphillSections.length} 段上坡`, cls: 'up' })
  if (props.result.downhillSections?.length) ctx.push({ text: `${props.result.downhillSections.length} 段下坡`, cls: 'down' })
  if (props.villages?.length) ctx.push({ text: `经${props.villages.length}村` })
  if (props.supplyPoints?.length) ctx.push({ text: `${props.supplyPoints.length} 补给点` })
  if (props.result.totalClimb) ctx.push({ text: `爬升 ${props.result.totalClimb}m` })
  if (qualityTags.value.length) ctx.push({ text: qualityTags.value.join(' · ') })
  return ctx
})
</script>

<template>
  <div v-if="result" class="result-view card">
    <!-- 标题栏 -->
    <div class="result-header">
      <div class="result-title">
        <span class="result-icon"><Icon :name="result.isRoundTrip ? 'target' : hasDest ? 'pin' : 'refresh'" :size="16" /></span>
        <span>{{ result.isRoundTrip ? `去 ${result.destName || '目的地'}` : hasDest ? '骑行路线' : '环线骑行' }}</span>
        <span v-if="diffObj" class="diff-badge" :style="{ background: diffObj.color }">{{ diffLabel }}</span>
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
        <div class="val small" :style="{ color: diffObj?.color }">{{ diffLabel }}</div>
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
      <span><i class="legend-dot" style="--dot:#16a34a"></i>起点</span>
      <span><i class="legend-dot" style="--dot:#ea580c"></i>终点</span>
      <span><i class="legend-dot" style="--dot:#2563eb"></i>途经</span>
      <span v-if="villages?.length"><i class="legend-dot" style="--dot:#78716c"></i>村庄</span>
      <span v-if="supplyPoints?.length"><i class="legend-dot" style="--dot:#7c3aed"></i>补给</span>
      <span><i class="legend-dot" style="--dot:#dc2626"></i>上坡</span>
      <span><i class="legend-dot" style="--dot:#16a34a"></i>下坡</span>
      <span><Icon name="arrowUp" :size="10" />北</span>
    </div>

    <!-- 沿途信息条 -->
    <div v-if="routeContext.length" class="route-context-strip">
      <span v-for="(ctx, i) in routeContext" :key="i" class="context-chip" :class="ctx.cls">
        {{ ctx.text }}
      </span>
    </div>

    <!-- 路线文字描述 -->
    <div class="route-summary" v-html="summaryHTML" />

    <!-- 路线属性标签 -->
    <div v-if="routeTags?.length || qualityTags.length" class="quality-tags">
      <span v-for="t in (routeTags || [])" :key="t.text" :class="['qtag', 'qtag-' + (t.category || 'nature')]">{{ t.text }}</span>
      <span v-for="t in qualityTags" :key="t" class="qtag qtag-quality">{{ t }}</span>
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
      <span class="arrow"><Icon name="chevronRight" :size="12" /></span> 详细数据
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
        <div class="slope-title"><Icon name="trendingUp" :size="13" />上坡路段（坡度≥5%）</div>
        <div class="slope-item" v-for="(sec, i) in result.uphillSections" :key="'u' + i">
          <span class="slope-badge" :class="sec.avgGrade >= 8 ? 'steep' : 'moderate'">第{{ i + 1 }}段</span>
          <span class="slope-data">{{ sec.length }}km ↗{{ sec.climb }}m</span>
          <span class="slope-grade">均{{ sec.avgGrade }}% / 最{{ sec.maxGrade }}%</span>
        </div>
      </div>

      <!-- 下坡 -->
      <div v-if="result.downhillSections?.length" class="slope-box downhill">
        <div class="slope-title"><Icon name="trendingDown" :size="13" />下坡路段（坡度≥5%）</div>
        <div class="slope-item" v-for="(sec, i) in result.downhillSections" :key="'d' + i">
          <span class="slope-badge">第{{ i + 1 }}段</span>
          <span class="slope-data">{{ sec.length }}km ↘{{ sec.descent }}m</span>
          <span class="slope-grade">均{{ sec.avgGrade }}% / 最{{ sec.maxGrade }}%</span>
        </div>
      </div>
    </div>

    <!-- 操作按钮 -->
    <button class="btn btn-primary" style="margin-top:12px;padding:14px;font-size:15px" @click="emit('openNav')">
      <span style="display:inline-flex;align-items:center;gap:7px;justify-content:center"><Icon name="navigation" :size="16" />开始导航</span>
    </button>
    <div class="action-row">
      <button class="action-btn" @click="emit('regenerate')">
        <Icon name="refresh" :size="17" />
        <span class="action-label">换一条</span>
      </button>
      <button class="action-btn" @click="emit('copyNav')">
        <Icon name="copy" :size="17" />
        <span class="action-label">复制链接</span>
      </button>
      <button class="action-btn" @click="emit('downloadGpx')">
        <Icon name="download" :size="17" />
        <span class="action-label">GPX</span>
      </button>
      <button class="action-btn" @click="emit('doShare')">
        <Icon name="share" :size="17" />
        <span class="action-label">分享</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.result-header {
  margin-bottom: 14px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--line);
}
.result-title {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 16px;
  font-weight: 700;
  color: var(--ink-900);
}
.result-icon {
  width: 28px; height: 28px;
  border-radius: 8px;
  background: var(--accent-soft);
  color: var(--accent);
  display: flex; align-items: center; justify-content: center;
}
.result-subtitle {
  font-size: 12px;
  color: var(--ink-400);
  margin-top: 4px;
  margin-left: 35px;
}

.diff-badge {
  font-size: 10px;
  padding: 3px 10px;
  border-radius: 5px;
  color: #fff;
  font-weight: 600;
  margin-left: auto;
}

.route-thumb-legend span { display: inline-flex; align-items: center; }

/* 沿途信息条 */
.route-context-strip {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  margin: 10px 0;
}
.context-chip {
  font-size: 11px;
  font-weight: 500;
  color: var(--ink-600);
  background: var(--surface-2);
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 3px 9px;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.context-chip.up { color: #b45309; }
.context-chip.down { color: var(--ok); }

.quality-tags { display: flex; gap: 4px; flex-wrap: wrap; margin: 6px 0; }
.qtag {
  font-size: 10px; font-weight: 600;
  padding: 3px 8px; border-radius: 5px;
  background: var(--surface-2); color: var(--ink-600); border: 1px solid var(--line);
}
.qtag-nature { background: #eef6f2; color: #0d7a57; border-color: #d3ecdd; }
.qtag-cycling { background: #fef6f3; color: #b45309; border-color: #f5dccd; }
.qtag-quality { background: var(--surface-2); color: var(--ink-600); border-color: var(--line); }

.action-row {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}
.action-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  padding: 11px 4px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface);
  color: var(--ink-600);
  cursor: pointer;
  font-family: inherit;
  transition: all .15s;
}
.action-btn:hover { border-color: var(--line-strong); color: var(--ink-900); background: var(--surface-2); }
.action-btn:active { transform: scale(.95); }
.action-label { font-size: 11px; font-weight: 500; }
</style>

<script setup>
// 每日行程时间轴组件：D1/D2/D3 + 上午/午餐/下午/晚餐/晚上
import { computed } from 'vue'
const props = defineProps({
  city: Object,          // cityPlan 对象
  activeDay: { type: Number, default: 0 },
})
const emit = defineEmits(['update:activeDay'])

const PERIOD_COLOR = { breakfast: '#d97706', morning: '#b45309', lunch: '#be4a73', afternoon: '#c2620a', dinner: '#993556', evening: '#6d28d9', free: '#8a919e' }
const TYPE_LABEL = { nature: '自然', culture: '人文', food: '美食', family: '亲子', urban: '地标', local: '本地' }
// 当日景点相对质心的最大半径超过此值（50km），提示"跨区较远"
const SPAN_WARN_KM = 50

const currentDay = computed(() => props.city?.daily?.[props.activeDay] || null)
function typeLabel(t) { return TYPE_LABEL[t] || t }
function mustSeeStars(n) { return '★'.repeat(Math.max(0, n || 0)) }
</script>

<template>
  <div class="itimeline">
    <!-- 天数切换（自动换行，不截断） -->
    <div class="day-tabs">
      <button
        v-for="(d, i) in city.daily"
        :key="i"
        :class="['day-tab', { active: activeDay === i }]"
        @click="emit('update:activeDay', i)"
      >
        D{{ i + 1 }}<span class="day-date">{{ (d.dateLabel || '').split(' ')[1] || '' }}</span>
      </button>
    </div>

    <!-- 当前天详情 -->
    <div v-if="currentDay" class="day-detail">
      <div class="day-head">
        <span class="day-title">{{ currentDay.dateLabel }}</span>
        <span class="day-weather">
          {{ city.monthly[activeDay]?.low }}~{{ city.monthly[activeDay]?.high }}°C
        </span>
        <span v-if="currentDay.geoSpanKm > SPAN_WARN_KM" class="day-span-warn">
          今日景点相距约 {{ Math.round(currentDay.geoSpanKm) }}km
        </span>
      </div>

      <div v-if="currentDay.slots.length === 0" class="free-day">
        自由活动 / 机动时间 — 可逛城市、探店或休息
      </div>

      <div v-for="(s, i) in currentDay.slots" :key="i" :class="['slot-row', { meal: s.meal, local: s.local }]">
        <div class="slot-time">
          <i class="slot-dot" :style="{ background: PERIOD_COLOR[s.period] }"></i>
          <span class="slot-label" :style="{ color: PERIOD_COLOR[s.period] }">{{ s.periodLabel }}</span>
        </div>
        <div class="slot-body">
          <!-- 餐食槽位（真实餐厅） -->
          <template v-if="s.meal">
            <div class="slot-name meal-name">
              {{ s.meal.name }}
              <span v-if="s.meal.rating" class="meal-rating">★ {{ s.meal.rating }}</span>
              <span class="meal-tag">当地推荐</span>
            </div>
            <div class="slot-meta">
              <span v-if="s.meal.price" class="meta-item meal-price">{{ s.meal.price }}</span>
              <span v-if="s.meal.tag" class="meta-item rest-type-tag">{{ s.meal.tag }}</span>
            </div>
            <div v-if="s.meal.address" class="slot-desc">{{ s.meal.address }}</div>
          </template>
          <!-- 本地小众地点槽位 -->
          <template v-else-if="s.local">
            <div class="slot-name local-name">
              {{ s.spot.name }}
              <span class="local-badge">{{ s.spot.label }}</span>
            </div>
            <div class="slot-meta">
              <span v-if="s.spot.tag" class="meta-item local-tag">{{ s.spot.tag }}</span>
            </div>
            <div v-if="s.spot.address" class="slot-desc">{{ s.spot.address }}</div>
          </template>
          <!-- 景点槽位 -->
          <template v-else>
            <div class="slot-name">
              {{ s.attraction.name }}
              <span v-if="s.attraction.mustSee >= 4" class="slot-must" :style="{ color: PERIOD_COLOR[s.period] }">{{ mustSeeStars(s.attraction.mustSee) }}</span>
              <span v-if="s.attraction.poi" class="poi-badge">实时</span>
            </div>
            <div class="slot-meta">
              <span v-if="s.attraction.ticket" class="meta-item">{{ s.attraction.ticket }}</span>
              <span v-if="s.attraction.duration" class="meta-item">{{ s.attraction.duration }}</span>
              <span class="meta-item type-chip" :class="'t-' + s.attraction.type">{{ typeLabel(s.attraction.type) }}</span>
            </div>
            <div v-if="s.attraction.desc" class="slot-desc">{{ s.attraction.desc }}</div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.itimeline { margin-top: 4px; }
.day-tabs { display: flex; gap: 4px; flex-wrap: wrap; padding-bottom: 8px; }
.day-tab {
  flex-shrink: 0; display: flex; flex-direction: column; align-items: center; gap: 1px;
  padding: 7px 14px; border-radius: 8px; border: 1px solid var(--line); background: var(--surface);
  font-size: 12px; font-weight: 600; color: var(--ink-600); cursor: pointer; font-family: inherit;
  transition: all .15s;
}
.day-tab .day-date { font-size: 9px; font-weight: 400; color: var(--ink-300); }
.day-tab:hover { border-color: var(--line-strong); color: var(--ink-900); }
.day-tab.active { background: var(--accent); border-color: var(--accent); color: #fff; }
.day-tab.active .day-date { color: rgba(255,255,255,.75); }
.day-detail { background: var(--surface-2); border: 1px solid var(--line); border-radius: 10px; padding: 14px; }
.day-head { display: flex; justify-content: space-between; align-items: center; gap: 6px; flex-wrap: wrap; margin-bottom: 10px; }
.day-span-warn { font-size: 10px; color: #b45309; background: #fdf3e3; padding: 3px 8px; border-radius: 5px; font-weight: 600; }
.day-title { font-size: 14px; font-weight: 700; color: var(--ink-900); }
.day-weather { font-size: 11px; color: var(--ink-600); font-weight: 500; background: var(--surface); border: 1px solid var(--line); padding: 3px 8px; border-radius: 5px; font-variant-numeric: tabular-nums; }
.free-day { text-align: center; padding: 20px; color: var(--ink-300); font-size: 12px; }
.slot-row { display: flex; gap: 10px; padding: 10px 0; border-bottom: 1px solid var(--line); }
.slot-row:last-child { border-bottom: none; }
.slot-row.meal { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 10px 12px; margin: 4px 0; }
.slot-row.local { background: var(--surface); border: 1px solid var(--line); border-left: 3px solid #d97706; border-radius: 8px; padding: 10px 12px; margin: 4px 0; }
.slot-time { width: 52px; flex-shrink: 0; text-align: center; }
.slot-dot { display: block; width: 7px; height: 7px; border-radius: 50%; margin: 3px auto 4px; }
.slot-label { font-size: 11px; font-weight: 600; }
.slot-body { flex: 1; min-width: 0; }
.slot-name { font-size: 13px; font-weight: 600; color: var(--ink-900); display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.meal-name { color: var(--ink-900); }
.local-name { color: var(--ink-900); }
.local-badge { font-size: 9px; background: #fdf3e3; color: #b45309; border-radius: 4px; padding: 2px 7px; font-weight: 600; }
.local-tag { background: #fdf3e3; color: #b45309; padding: 2px 7px; border-radius: 4px; font-weight: 500; }
.meal-tag { font-size: 9px; background: var(--surface-2); border: 1px solid var(--line); color: var(--ink-600); border-radius: 4px; padding: 2px 7px; font-weight: 500; }
.meal-price { color: var(--ink-700); font-weight: 600; font-variant-numeric: tabular-nums; }
.meal-rating { font-size: 10px; color: #b45309; font-weight: 600; font-variant-numeric: tabular-nums; }
.rest-type-tag { background: var(--surface-2); padding: 2px 7px; border-radius: 4px; font-weight: 500; color: var(--ink-600); }
.slot-must { font-size: 10px; }
.poi-badge { font-size: 9px; background: var(--surface-2); border: 1px solid var(--line); color: var(--ink-600); border-radius: 4px; padding: 2px 6px; font-weight: 500; }
.slot-meta { display: flex; gap: 8px; margin-top: 3px; flex-wrap: wrap; }
.meta-item { font-size: 10px; color: var(--ink-400); }
.type-chip { background: var(--surface-2); border: 1px solid var(--line); padding: 2px 7px; border-radius: 4px; font-weight: 500; }
.type-chip.t-nature { background: #eef6f2; color: #0d7a57; border-color: #d3ecdd; }
.type-chip.t-culture { background: #fbeef3; color: #993556; border-color: transparent; }
.type-chip.t-food { background: #fdf3e3; color: #b45309; border-color: transparent; }
.type-chip.t-family { background: #eff4fd; color: #1d4ed8; border-color: transparent; }
.type-chip.t-urban { background: #f0eefc; color: #4f46e5; border-color: transparent; }
.type-chip.t-local { background: #fdf3e3; color: #b45309; border-color: transparent; }
.slot-desc { font-size: 11px; color: var(--ink-400); margin-top: 3px; line-height: 1.5; }
</style>

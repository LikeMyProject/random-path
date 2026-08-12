<script setup>
// 每日行程时间轴组件：D1/D2/D3 + 上午/下午/晚上时段
import { computed } from 'vue'
const props = defineProps({
  city: Object,          // cityPlan 对象
  activeDay: { type: Number, default: 0 },
})
const emit = defineEmits(['update:activeDay'])

const PERIOD_ICON = { morning: '🌅', afternoon: '☀️', evening: '🌙' }
const PERIOD_COLOR = { morning: '#f0a870', afternoon: '#f08ca4', evening: '#8b5cf6' }
const TYPE_LABEL = { nature: '自然', culture: '人文', food: '美食', family: '亲子', urban: '地标' }

const currentDay = computed(() => props.city?.daily?.[props.activeDay] || null)
const dayDate = computed(() => {
  const d = currentDay.value
  if (!d) return ''
  const parts = (d.dateLabel || '').split(' ')
  return parts.length > 1 ? parts[1] : ''
})
function typeLabel(t) { return TYPE_LABEL[t] || t }
function mustSeeStars(n) { return '★'.repeat(Math.max(0, n || 0)) }
</script>

<template>
  <div class="itimeline">
    <!-- 天数切换 -->
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
      </div>

      <div v-if="currentDay.slots.length === 0" class="free-day">
        🚶 自由活动 / 机动时间 — 可逛城市、探店或休息
      </div>

      <div v-for="(s, i) in currentDay.slots" :key="i" class="slot-row">
        <div class="slot-time">
          <span class="slot-icon">{{ PERIOD_ICON[s.period] }}</span>
          <span class="slot-label" :style="{ color: PERIOD_COLOR[s.period] }">{{ s.periodLabel }}</span>
        </div>
        <div class="slot-body">
          <div class="slot-name">
            {{ s.attraction.name }}
            <span v-if="s.attraction.mustSee >= 4" class="slot-must" :style="{ color: PERIOD_COLOR[s.period] }">{{ mustSeeStars(s.attraction.mustSee) }}</span>
            <span v-if="s.attraction.poi" class="poi-badge">实时</span>
          </div>
          <div class="slot-meta">
            <span v-if="s.attraction.ticket" class="meta-item">🎫 {{ s.attraction.ticket }}</span>
            <span v-if="s.attraction.duration" class="meta-item">⏱ {{ s.attraction.duration }}</span>
            <span class="meta-item type-chip" :class="'t-' + s.attraction.type">{{ typeLabel(s.attraction.type) }}</span>
          </div>
          <div v-if="s.attraction.desc" class="slot-desc">{{ s.attraction.desc }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.itimeline { margin-top: 4px; }
.day-tabs { display: flex; gap: 4px; overflow-x: auto; padding-bottom: 6px; -webkit-overflow-scrolling: touch; }
.day-tab {
  flex-shrink: 0; display: flex; flex-direction: column; align-items: center; gap: 1px;
  padding: 7px 14px; border-radius: 10px; border: 2px solid #e5dcec; background: #fff;
  font-size: 12px; font-weight: 700; color: #8a7a98; cursor: pointer; font-family: inherit;
  transition: all .2s;
}
.day-tab .day-date { font-size: 9px; font-weight: 400; color: #b0a3bc; }
.day-tab.active { background: linear-gradient(135deg, #f08ca4, #e27790); color: #fff; border-color: #f08ca4; }
.day-tab.active .day-date { color: rgba(255,255,255,0.8); }
.day-detail { background: #fdfbff; border: 1px solid #f2eaf4; border-radius: 12px; padding: 12px; }
.day-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.day-title { font-size: 13px; font-weight: 700; color: #4a3f55; }
.day-weather { font-size: 11px; color: #f0a870; font-weight: 700; }
.free-day { text-align: center; padding: 18px; color: #a898b8; font-size: 12px; }
.slot-row { display: flex; gap: 10px; padding: 9px 0; border-bottom: 1px dashed #f2eaf4; }
.slot-row:last-child { border-bottom: none; }
.slot-time { width: 52px; flex-shrink: 0; text-align: center; }
.slot-icon { font-size: 16px; display: block; }
.slot-label { font-size: 11px; font-weight: 700; }
.slot-body { flex: 1; min-width: 0; }
.slot-name { font-size: 13px; font-weight: 700; color: #5e5468; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.slot-must { font-size: 10px; }
.poi-badge { font-size: 9px; background: #e6f1fb; color: #185fa5; border-radius: 4px; padding: 1px 5px; font-weight: 600; }
.slot-meta { display: flex; gap: 8px; margin-top: 3px; flex-wrap: wrap; }
.meta-item { font-size: 10px; color: #a898b8; }
.type-chip { background: #f3f0f7; padding: 1px 6px; border-radius: 4px; font-weight: 600; }
.type-chip.t-nature { background: #e1f5ee; color: #0f6e56; }
.type-chip.t-culture { background: #fbeaf0; color: #993556; }
.type-chip.t-food { background: #faeeda; color: #854f0b; }
.type-chip.t-family { background: #e6f1fb; color: #185fa5; }
.type-chip.t-urban { background: #eeedfe; color: #534ab7; }
.slot-desc { font-size: 11px; color: #a898b8; margin-top: 3px; line-height: 1.5; }
</style>

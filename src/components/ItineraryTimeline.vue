<script setup>
// 每日行程时间轴组件：D1/D2/D3 + 上午/午餐/下午/晚餐/晚上
import { computed } from 'vue'
const props = defineProps({
  city: Object,          // cityPlan 对象
  activeDay: { type: Number, default: 0 },
})
const emit = defineEmits(['update:activeDay'])

const PERIOD_ICON = { breakfast: '🍳', morning: '🌅', lunch: '🍜', afternoon: '☀️', dinner: '🍽️', evening: '🌙', free: '🚶' }
const PERIOD_COLOR = { breakfast: '#f59e0b', morning: '#f0a870', lunch: '#d4537e', afternoon: '#f08ca4', dinner: '#e27790', evening: '#8b5cf6', free: '#a898b8' }
const TYPE_LABEL = { nature: '自然', culture: '人文', food: '美食', family: '亲子', urban: '地标' }

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
      </div>

      <div v-if="currentDay.slots.length === 0" class="free-day">
        🚶 自由活动 / 机动时间 — 可逛城市、探店或休息
      </div>

      <div v-for="(s, i) in currentDay.slots" :key="i" :class="['slot-row', { meal: s.meal }]">
        <div class="slot-time">
          <span class="slot-icon">{{ PERIOD_ICON[s.period] }}</span>
          <span class="slot-label" :style="{ color: PERIOD_COLOR[s.period] }">{{ s.periodLabel }}</span>
        </div>
        <div class="slot-body">
          <!-- 餐食槽位（真实餐厅） -->
          <template v-if="s.meal">
            <div class="slot-name meal-name">
              🍽 {{ s.meal.name }}
              <span v-if="s.meal.rating" class="meal-rating">⭐ {{ s.meal.rating }}</span>
              <span class="meal-tag">当地推荐</span>
            </div>
            <div class="slot-meta">
              <span v-if="s.meal.price" class="meta-item meal-price">💴 {{ s.meal.price }}</span>
              <span v-if="s.meal.tag" class="meta-item rest-type-tag">{{ s.meal.tag }}</span>
            </div>
            <div v-if="s.meal.address" class="slot-desc">📍 {{ s.meal.address }}</div>
          </template>
          <!-- 景点槽位 -->
          <template v-else>
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
  padding: 7px 14px; border-radius: 12px; border: none; background: #f7f5fa;
  font-size: 12px; font-weight: 700; color: #7a6c8a; cursor: pointer; font-family: inherit;
  transition: all .2s;
  box-shadow: 0 1px 3px rgba(0,0,0,.03);
}
.day-tab .day-date { font-size: 9px; font-weight: 400; color: #b0a3bc; }
.day-tab:hover { background: var(--accent-soft); color: var(--accent); }
.day-tab.active { background: linear-gradient(135deg, var(--accent), var(--accent-2)); color: #fff; box-shadow: 0 3px 10px rgba(var(--accent-rgb),.25); }
.day-tab.active .day-date { color: rgba(255,255,255,0.8); }
.day-detail { background: #f7f5fa; border: none; border-radius: 14px; padding: 14px; }
.day-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.day-title { font-size: 14px; font-weight: 800; color: #3a3045; }
.day-weather { font-size: 11px; color: #f0a870; font-weight: 700; background: #fff7ed; padding: 3px 8px; border-radius: 8px; }
.free-day { text-align: center; padding: 20px; color: #b0a3bc; font-size: 12px; }
.slot-row { display: flex; gap: 10px; padding: 10px 0; border-bottom: 1px solid rgba(0,0,0,.04); }
.slot-row:last-child { border-bottom: none; }
.slot-row.meal { background: #fff8fb; border-radius: 10px; padding: 10px 12px; border: none; margin: 4px 0; }
.slot-time { width: 52px; flex-shrink: 0; text-align: center; }
.slot-icon { font-size: 16px; display: block; }
.slot-label { font-size: 11px; font-weight: 700; }
.slot-body { flex: 1; min-width: 0; }
.slot-name { font-size: 13px; font-weight: 700; color: #4a3f55; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.meal-name { color: #c2415e; }
.meal-tag { font-size: 9px; background: #fbeaf0; color: #993556; border-radius: 6px; padding: 2px 7px; font-weight: 700; }
.meal-price { color: #c2415e; font-weight: 700; }
.meal-rating { font-size: 10px; color: #f59e0b; font-weight: 700; }
.rest-type-tag { background: #f0edf5; padding: 2px 7px; border-radius: 6px; font-weight: 600; color: #7c6fd8; }
.slot-must { font-size: 10px; }
.poi-badge { font-size: 9px; background: #e6f1fb; color: #185fa5; border-radius: 6px; padding: 2px 6px; font-weight: 600; }
.slot-meta { display: flex; gap: 8px; margin-top: 3px; flex-wrap: wrap; }
.meta-item { font-size: 10px; color: #b0a3bc; }
.type-chip { background: #f0edf5; padding: 2px 7px; border-radius: 6px; font-weight: 600; }
.type-chip.t-nature { background: #e1f5ee; color: #0f6e56; }
.type-chip.t-culture { background: #fbeaf0; color: #993556; }
.type-chip.t-food { background: #faeeda; color: #854f0b; }
.type-chip.t-family { background: #e6f1fb; color: #185fa5; }
.type-chip.t-urban { background: #eeedfe; color: #534ab7; }
.slot-desc { font-size: 11px; color: #a898b8; margin-top: 3px; line-height: 1.5; }
</style>

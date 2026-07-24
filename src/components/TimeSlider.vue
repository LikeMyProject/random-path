<script setup>
import { computed } from 'vue'

const props = defineProps({
  modelValue: { type: Number, default: 90 }
})
const emit = defineEmits(['update:modelValue'])

const MIN = 30, MAX = 300

function formatTime(min) {
  if (min < 60) return `${min} 分钟`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m > 0 ? `${h}.${Math.round(m / 6)} 小时` : `${h} 小时`
}

const pct = computed(() => ((props.modelValue - MIN) / (MAX - MIN)) * 100)
const label = computed(() => formatTime(props.modelValue))
</script>

<template>
  <div class="time-slider-wrap">
    <div class="time-slider-label">
      <span>多长时间？</span>
      <span class="time-val">~{{ label }}</span>
    </div>
    <div class="time-slider-track">
      <div class="time-slider-fill" :style="{ width: pct + '%' }"></div>
      <input
        type="range"
        class="time-slider-input"
        :min="MIN"
        :max="MAX"
        :step="10"
        :value="modelValue"
        @input="emit('update:modelValue', Number($event.target.value))"
      />
    </div>
    <div class="time-slider-ticks">
      <span v-for="t in [{m:30,l:'30m'},{m:60,l:'1h'},{m:90,l:'1.5h'},{m:120,l:'2h'},{m:180,l:'3h'},{m:300,l:'半天'}]"
        :key="t.m"
        :class="['tick', { active: Math.abs(modelValue - t.m) <= 15 }]"
        @click="emit('update:modelValue', t.m)"
      >{{ t.l }}</span>
    </div>
  </div>
</template>

<style scoped>
.time-slider-wrap {
  margin: 18px 0 12px;
}
.time-slider-label {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: 13px;
  color: #8a8098;
  font-weight: 600;
  margin-bottom: 12px;
}
.time-val {
  font-size: 18px;
  font-weight: 700;
  color: #f08ca4;
}
.time-slider-track {
  position: relative;
  height: 8px;
  border-radius: 4px;
  background: #ece0ec;
}
.time-slider-fill {
  position: absolute;
  top: 0; left: 0;
  height: 100%;
  border-radius: 4px;
  background: linear-gradient(90deg, #f08ca4, #f97316);
  pointer-events: none;
}
.time-slider-input {
  position: absolute;
  top: 50%; left: 0;
  width: 100%;
  height: 28px;
  transform: translateY(-50%);
  -webkit-appearance: none;
  appearance: none;
  background: transparent;
  cursor: pointer;
  margin: 0;
}
.time-slider-input::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 22px; height: 22px;
  border-radius: 50%;
  background: #fff;
  border: 3px solid #f08ca4;
  box-shadow: 0 2px 8px rgba(240,140,164,.35);
}
.time-slider-input::-moz-range-thumb {
  width: 22px; height: 22px;
  border-radius: 50%;
  background: #fff;
  border: 3px solid #f08ca4;
  box-shadow: 0 2px 8px rgba(240,140,164,.35);
}
.time-slider-ticks {
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
}
.tick {
  font-size: 10px;
  color: #a898b8;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 8px;
  transition: all .15s;
}
.tick:hover { color: #8a8098; }
.tick.active { color: #f08ca4; font-weight: 700; background: #fff0f5; }
</style>
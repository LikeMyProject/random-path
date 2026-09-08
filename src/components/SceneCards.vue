<script setup>
import Icon from './Icon.vue'
defineProps({
  modelValue: { type: String, default: 'destination' }
})
defineEmits(['update:modelValue'])

const SCENES = [
  { key: 'destination', icon: 'navigation', label: '指定目的地', desc: '选地点 · 单程/往返 · 最优/随机', dist: '看目的地', time: '看路线', tag: '导航' },
  { key: 'loop', icon: 'refresh', label: '指定距离环线', desc: '设距离 · 当前定位出发 · 随机圆环', dist: '5-200 km', time: '随心调', tag: '自由' },
]
</script>

<template>
  <div class="scene-grid">
    <button
      v-for="s in SCENES"
      :key="s.key"
      :class="['scene-card', { active: modelValue === s.key }]"
      @click="$emit('update:modelValue', s.key)"
    >
      <div class="scene-top">
        <span class="scene-icon"><Icon :name="s.icon" :size="18" /></span>
        <span class="scene-label">{{ s.label }}</span>
        <span v-if="modelValue === s.key" class="scene-check"><Icon name="check" :size="12" /></span>
      </div>
      <div class="scene-desc">{{ s.desc }}</div>
      <div class="scene-stats">
        <span class="scene-stat">{{ s.dist }}</span>
        <span class="scene-stat-sep">·</span>
        <span class="scene-stat">{{ s.time }}</span>
      </div>
    </button>
  </div>
</template>

<style scoped>
.scene-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: 12px;
}
.scene-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 14px;
  border-radius: 12px;
  border: 1px solid var(--line);
  background: var(--surface);
  cursor: pointer;
  transition: all .15s;
  font-family: inherit;
  color: var(--ink-600);
  text-align: left;
  box-shadow: 0 1px 2px rgba(22,24,29,.03);
}
.scene-card:hover { border-color: var(--line-strong); }
.scene-card:active { transform: scale(.98); }
.scene-card.active {
  border-color: var(--accent);
  color: var(--ink-900);
  box-shadow: 0 0 0 3px var(--accent-tint);
  background: var(--accent-soft);
}
.scene-top { display: flex; align-items: center; gap: 8px; }
.scene-icon { color: var(--ink-400); display: flex; }
.scene-card.active .scene-icon { color: var(--accent); }
.scene-label { font-size: 14px; font-weight: 600; }
.scene-check {
  margin-left: auto;
  width: 18px; height: 18px;
  border-radius: 50%;
  background: var(--accent);
  color: #fff;
  display: flex; align-items: center; justify-content: center;
}
.scene-desc { font-size: 11px; color: var(--ink-400); line-height: 1.4; }
.scene-stats { display: flex; align-items: center; gap: 4px; margin-top: 2px; }
.scene-stat { font-size: 11px; font-weight: 500; color: var(--ink-400); font-variant-numeric: tabular-nums; }
.scene-stat-sep { font-size: 11px; color: var(--ink-300); }
</style>

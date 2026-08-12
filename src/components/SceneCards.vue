<script setup>
defineProps({
  modelValue: { type: String, default: 'random' }
})
defineEmits(['update:modelValue'])

const SCENES = [
  { key: 'casual', icon: '🌅', label: '休闲骑', desc: '~12 km', time: 60, flat: true },
  { key: 'training', icon: '🏋', label: '训练骑', desc: '~30 km', time: 120, hilly: true },
  { key: 'random', icon: '🔀', label: '随便骑', desc: '随机距离 · 随机方向', time: -1, random: true },
  { key: 'destination', icon: '🎯', label: '骑到某处', desc: '选目的地 · 来回', time: -1, dest: true },
]
</script>

<template>
  <div class="scene-cards-v2">
    <button
      v-for="s in SCENES"
      :key="s.key"
      :class="['scene-card-v2', { active: modelValue === s.key }]"
      @click="$emit('update:modelValue', s.key)"
    >
      <span class="scene-icon-v2">{{ s.icon }}</span>
      <span class="scene-label-v2">{{ s.label }}</span>
      <span class="scene-desc-v2">{{ s.desc }}</span>
    </button>
  </div>
</template>

<style scoped>
.scene-cards-v2 {
  display: flex;
  gap: 10px;
  margin-top: 14px;
}
.scene-card-v2 {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 14px 8px;
  border-radius: 16px;
  border: 2px solid #e8e0ec;
  background: #fdfbff;
  cursor: pointer;
  transition: all .2s;
  font-family: inherit;
  color: #5e5468;
}
.scene-card-v2:hover {
  border-color: #c4b5d0;
  background: #f8f4fb;
}
.scene-card-v2.active {
  border-color: var(--accent);
  background: var(--accent-soft);
  box-shadow: 0 2px 12px var(--accent-tint);
}
.scene-icon-v2 { font-size: 28px; }
.scene-label-v2 { font-size: 13px; font-weight: 700; }
.scene-desc-v2 { font-size: 10px; color: #a898b8; }
</style>

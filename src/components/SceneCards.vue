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
  gap: 8px;
  margin-top: 14px;
}
.scene-card-v2 {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 14px 6px;
  border-radius: 16px;
  border: none;
  background: #fff;
  cursor: pointer;
  transition: all .25s cubic-bezier(.34,1.56,.64,1);
  font-family: inherit;
  color: #7a6c8a;
  box-shadow: 0 2px 8px rgba(0,0,0,.04);
  position: relative;
  overflow: hidden;
}
.scene-card-v2:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 14px rgba(0,0,0,.08);
}
.scene-card-v2.active {
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  color: #fff;
  box-shadow: 0 4px 18px rgba(var(--accent-rgb),.30);
  transform: translateY(-2px);
}
.scene-card-v2.active::before {
  content: '';
  position: absolute;
  top: -20px;
  right: -20px;
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: rgba(255,255,255,.12);
}
.scene-icon-v2 { font-size: 26px; position: relative; z-index: 1; }
.scene-label-v2 { font-size: 12px; font-weight: 700; position: relative; z-index: 1; }
.scene-desc-v2 { font-size: 9px; opacity: .7; position: relative; z-index: 1; }
</style>

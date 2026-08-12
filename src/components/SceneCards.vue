<script setup>
defineProps({
  modelValue: { type: String, default: 'random' }
})
defineEmits(['update:modelValue'])

const SCENES = [
  { key: 'casual', icon: '🌅', label: '休闲骑', desc: '轻松兜风 · 平路为主', dist: '~12 km', time: '约 60 分钟' },
  { key: 'training', icon: '🏋', label: '训练骑', desc: '挑战自我 · 含坡路', dist: '~30 km', time: '约 120 分钟' },
  { key: 'random', icon: '🔀', label: '随便骑', desc: '随机距离 · 随机方向', dist: '15-45 km', time: '看心情' },
  { key: 'destination', icon: '🎯', label: '骑到某处', desc: '选目的地 · 来回往返', dist: '看目的地', time: '看距离' },
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
        <span class="scene-icon">{{ s.icon }}</span>
        <span class="scene-label">{{ s.label }}</span>
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
  gap: 10px;
  margin-top: 12px;
}
.scene-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 16px 14px;
  border-radius: 16px;
  border: none;
  background: #fff;
  cursor: pointer;
  transition: all .25s cubic-bezier(.34,1.56,.64,1);
  font-family: inherit;
  color: #7a6c8a;
  box-shadow: 0 1px 3px rgba(0,0,0,.04), 0 4px 12px var(--shadow-color);
  position: relative;
  overflow: hidden;
  text-align: left;
}
.scene-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 2px 6px rgba(0,0,0,.06), 0 8px 20px var(--shadow-color);
}
.scene-card.active {
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  color: #fff;
  box-shadow: 0 4px 18px rgba(var(--accent-rgb),.30);
  transform: translateY(-2px);
}
.scene-card.active::before {
  content: '';
  position: absolute;
  top: -24px;
  right: -24px;
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: rgba(255,255,255,.12);
}
.scene-card.active::after {
  content: '✓';
  position: absolute;
  top: 10px;
  right: 12px;
  font-size: 14px;
  font-weight: 800;
  color: rgba(255,255,255,.7);
  z-index: 1;
}
.scene-top {
  display: flex;
  align-items: center;
  gap: 8px;
  position: relative;
  z-index: 1;
}
.scene-icon { font-size: 28px; line-height: 1; }
.scene-label { font-size: 16px; font-weight: 800; letter-spacing: -.3px; }
.scene-desc {
  font-size: 11px;
  opacity: .7;
  position: relative;
  z-index: 1;
  line-height: 1.4;
}
.scene-stats {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 2px;
  position: relative;
  z-index: 1;
}
.scene-stat {
  font-size: 11px;
  font-weight: 700;
  opacity: .85;
}
.scene-stat-sep {
  font-size: 11px;
  opacity: .4;
}
</style>

<script setup>
defineProps({
  modelValue: { type: String, default: 'random' }
})
defineEmits(['update:modelValue'])

const SCENES = [
  { key: 'casual', icon: '🌅', label: '休闲骑', desc: '短途兜风 · 随心方向', dist: '8-20 km', time: '40-100 分钟', tag: '轻松' },
  { key: 'training', icon: '🏋', label: '训练骑', desc: '中长距离 · 自选方向', dist: '20-50 km', time: '100-250 分钟', tag: '可控' },
  { key: 'random', icon: '🎲', label: '随便骑', desc: '距离方向全随机', dist: '10-50 km', time: '盲盒惊喜', tag: '未知' },
  { key: 'destination', icon: '🎯', label: '骑到某处', desc: '指定目的地 · 来回往返', dist: '看目的地', time: '看来回', tag: '往返' },
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
        <span class="scene-tag" :class="s.key">{{ s.tag }}</span>
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
.scene-tag {
  margin-left: auto;
  font-size: 9px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 6px;
  background: #f0edf5;
  color: #8a8098;
  letter-spacing: .3px;
}
.scene-card.active .scene-tag {
  background: rgba(255,255,255,.22);
  color: #fff;
}
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

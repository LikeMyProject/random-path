# RandomPath Phase 1: 首页简化 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重写 ExploreView 首页，实现 GPS 自动定位 → 滑选时长 → 点出发 → 出路线 的 4 步体验。

**Architecture:** 从 ExploreView.vue 拆出两个新组件 SceneCards.vue 和 TimeSlider.vue，模板重写为"GPS 定位条 + 模式卡片 + 时长滑块 + 大按钮 + 折叠高级面板"布局。核心逻辑层（useRouteEngine、useAMap、useStorage）完全不改。

**Tech Stack:** Vue 3 Composition API + `<script setup>` + 纯 CSS（不引入新依赖）

---

## 文件结构

| 文件 | 操作 | 职责 |
|------|------|------|
| `src/components/SceneCards.vue` | 新建 | 三张模式卡片：休闲/训练/随机，选中态高亮，显示估算距离 |
| `src/components/TimeSlider.vue` | 新建 | 连续时长滑块，30min~300min 范围，渐变轨道，当前值气泡 |
| `src/views/ExploreView.vue` | 重写模板 | 新布局，Script 部分保留所有现有逻辑，仅增删少量状态变量 |

---

### Task 1: 创建 SceneCards.vue 组件

**Files:**
- Create: `src/components/SceneCards.vue`

- [ ] **Step 1: 写组件代码**

```vue
<script setup>
defineProps({
  modelValue: { type: String, default: 'random' }
})
defineEmits(['update:modelValue'])

const SCENES = [
  { key: 'casual', icon: '🌅', label: '休闲骑', desc: '~12 km', time: 60, flat: true },
  { key: 'training', icon: '🏋', label: '训练骑', desc: '~30 km', time: 120, hilly: true },
  { key: 'random', icon: '🔀', label: '随便骑', desc: '随机距离 · 随机方向', time: -1, random: true },
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
  border-color: #f08ca4;
  background: #fff0f5;
  box-shadow: 0 2px 12px rgba(240,140,164,.25);
}
.scene-icon-v2 { font-size: 28px; }
.scene-label-v2 { font-size: 13px; font-weight: 700; }
.scene-desc-v2 { font-size: 10px; color: #a898b8; }
</style>
```

- [ ] **Step 2: 在 ExploreView 中引用并验证编译**

在 ExploreView.vue 顶部 import：
```js
import SceneCards from '../components/SceneCards.vue'
```

临时在模板中放置 `<SceneCards v-model="scene" />` 然后跑 `npm run dev` 确认编译通过。

---

### Task 2: 创建 TimeSlider.vue 组件

**Files:**
- Create: `src/components/TimeSlider.vue`

- [ ] **Step 1: 写组件代码**

```vue
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
```

- [ ] **Step 2: 在 ExploreView 中引用并验证编译**

在 ExploreView.vue 顶部 import：
```js
import TimeSlider from '../components/TimeSlider.vue'
```

临时在模板中放置 `<TimeSlider v-model="timeMin" />` 然后跑 `npm run dev` 确认编译通过。

---

### Task 3: 重写 ExploreView.vue 模板

**Files:**
- Modify: `src/views/ExploreView.vue`

**不改的部分（保持原样）：**
- `<script setup>` 中所有 import（在两个新组件 import 之后追加 SceneCards 和 TimeSlider）
- 所有 ref/computed/function 定义
- 地址管理弹窗模板（保留最后一段 modal）
- 结果展示卡片模板（保留 resultShow 那一段）

**要改的部分：**

- [ ] **Step 1: 添加 import 和新的 ref**

在 `<script setup>` 顶部追加两个 import：
```js
import SceneCards from '../components/SceneCards.vue'
import TimeSlider from '../components/TimeSlider.vue'
```

在 `showCustom` 那行后面新增：
```js
const showAdvanced = ref(false)
```

在 `applyScene` 函数下方新增 `watch`（替代旧的 `applyScene` 调用，旧的函数可保留不删）：

```js
import { watch } from 'vue'  // 在现有 import 行追加 watch

// 监听 scene 变更 → 自动同步 timeMin + direction
watch(scene, (s) => {
  if (s === 'random') { direction.value = 'random'; timeMin.value = 60 + Math.floor(Math.random() * 3) * 60 }
  else if (s === 'casual') { direction.value = 'random'; timeMin.value = 60 }
  else if (s === 'training') { direction.value = 'S'; timeMin.value = 120 }
})
```

- [ ] **Step 2: 重写模板 — 上半部分（首页交互区）**

把 `<template>` 从原来的完整内容替换为以下结构。**关键是：保留结果卡片和地址弹窗的原有模板不变，只替换首页交互区。**

模板整体结构（替换整个 `<template>...</template>`）：

```html
<template>
<div>
  <!-- GPS 定位条 -->
  <div class="gps-bar">
    <span class="gps-icon">📍</span>
    <span class="gps-text">{{ from.name || '点击设置起点' }}</span>
    <span class="gps-hint">自动定位 · 点击切换</span>
  </div>

  <!-- 模式卡片 -->
  <p class="section-title">今天想怎么骑？</p>
  <SceneCards v-model="scene" />

  <!-- 时长滑块 -->
  <TimeSlider v-model="timeMin" />

  <!-- 大按钮 -->
  <button
    class="btn-go"
    :disabled="loading"
    @click="doGenerate(false)"
  >
    {{ loading ? '生成中…' : '🎲 出发！' }}
  </button>
  <button
    class="btn-multi"
    :disabled="loading"
    @click="doGenerateMultiple"
  >
    📋 多生成几条对比
  </button>

  <!-- 高级选项折叠 -->
  <div class="advanced-toggle" @click="showAdvanced = !showAdvanced">
    <span>⚙️ 方向 · 起终点 · 偏好</span>
    <span class="arrow" :class="{ open: showAdvanced }">▾</span>
  </div>
  <div v-if="showAdvanced" class="advanced-panel">
    <!-- 起点 -->
    <div class="addr-row">
      <label>📍 起点</label>
      <div class="addr-quick-row">
        <button v-for="(v,k) in addresses" :key="k" class="chip-sm" @click="pickAddr(k,'from')">{{ k }}</button>
        <button class="chip-sm add" @click="showAddrModal = true">+管理</button>
      </div>
      <div class="input-row" style="position:relative">
        <input v-model="from.name" placeholder="输入地名搜索" @input="onNameInput('from')" @focus="onNameInput('from')" @blur="setTimeout(closeSuggest,200)">
        <button class="btn-icon" @click="doGeocode('from')">🔍</button>
        <button class="btn-icon" @click="locateMe('from')">📍</button>
        <div v-if="showSuggest && activeSuggest==='from'" class="suggest-drop"><div v-for="(s,i) in suggestions" :key="i" class="suggest-item" @mousedown.prevent="selectSugg(i)"><span class="s-name">{{ s.name }}</span><span class="s-dist">{{ s.district }}</span></div></div>
      </div>
    </div>

    <!-- 终点（可选） -->
    <div class="addr-row">
      <label>📍 终点 <span class="hint">(不填=环线)</span></label>
      <div class="input-row" style="position:relative">
        <input v-model="to.name" placeholder="可选目的地" @input="onNameInput('to')" @focus="onNameInput('to')" @blur="setTimeout(closeSuggest,200)">
        <button class="btn-icon" @click="doGeocode('to')">🔍</button>
        <button class="btn-icon" @click="locateMe('to')">📍</button>
      </div>
    </div>

    <!-- 方向 -->
    <label class="adv-label">🧭 方向</label>
    <div class="compass-row">
      <button v-for="d in COMPASS" :key="d.key" :class="['chip', { active: direction === d.key }]" @click="direction = d.key">{{ d.label }}</button>
    </div>

    <!-- 距离偏好 -->
    <label class="adv-label">🎯 距离偏好</label>
    <p class="dist-est">≈ {{ (timeMin * BIKE_SPEED / 60).toFixed(0) }}km ({{ BIKE_SPEED }}km/h)</p>
  </div>

  <!-- ===== 以下全部保持原样，不动 ===== -->

  <!-- Loading -->
  <div v-if="loading" class="loading-overlay card">
    ...（原样保留）
  </div>

  <!-- 多路线 -->
  <div v-if="multiResults.length > 1" class="multi-cards">
    ...（原样保留）
  </div>

  <!-- 结果 -->
  <div v-if="resultShow && result" class="card" style="animation:cardIn .4s cubic-bezier(.34,1.56,.64,1)">
    ...（原样保留）
  </div>

  <!-- 地址管理弹窗 -->
  <div class="modal" v-if="showAddrModal" @click.self="showAddrModal=false">
    ...（原样保留）
  </div>
</div>
</template>
```

- [ ] **Step 3: 添加新样式（追加到现有 `<style>` 或新 `<style scoped>` 块）**

在模板上方或下方追加新的样式块（与旧样式共存，旧的场景模式/自定义面板样式可以暂时保留或后续清理）：

```css
/* === Phase 1 新首页样式 === */
.gps-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 16px;
  background: linear-gradient(135deg, #f8f4fb, #fdf2f8);
  border-radius: 16px;
  margin-top: 4px;
  cursor: pointer;
  transition: box-shadow .2s;
}
.gps-bar:hover { box-shadow: 0 2px 12px rgba(240,140,164,.15); }
.gps-icon { font-size: 20px; }
.gps-text { flex: 1; font-weight: 700; font-size: 15px; color: #5e5468; }
.gps-hint { font-size: 10px; color: #a898b8; }

.section-title {
  font-size: 16px;
  font-weight: 700;
  color: #4a3f55;
  margin: 16px 0 0;
}

.btn-go {
  display: block;
  width: 100%;
  padding: 18px;
  border: none;
  border-radius: 20px;
  background: linear-gradient(135deg, #f08ca4, #f97316);
  color: #fff;
  font-size: 20px;
  font-weight: 700;
  cursor: pointer;
  transition: transform .15s, box-shadow .15s;
  margin-top: 16px;
}
.btn-go:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 24px rgba(240,140,164,.4);
}
.btn-go:disabled {
  opacity: .6;
  cursor: not-allowed;
}

.btn-multi {
  display: block;
  width: 100%;
  padding: 10px;
  border: none;
  background: transparent;
  color: #a898b8;
  font-size: 12px;
  cursor: pointer;
  margin-top: 6px;
}

.advanced-toggle {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 14px;
  margin-top: 14px;
  background: #faf7fc;
  border-radius: 12px;
  font-size: 12px;
  color: #8a8098;
  cursor: pointer;
  transition: background .15s;
}
.advanced-toggle:hover { background: #f0e8f5; }
.advanced-toggle .arrow { transition: transform .2s; }
.advanced-toggle .arrow.open { transform: rotate(180deg); }

.advanced-panel {
  padding: 12px 14px;
  background: #fdfbff;
  border: 1px solid #ece0ec;
  border-radius: 0 0 14px 14px;
  border-top: none;
}

.addr-row {
  margin-bottom: 10px;
}
.addr-row label {
  font-size: 11px;
  color: #8a8098;
  font-weight: 600;
  display: block;
  margin-bottom: 4px;
}
.addr-row .hint {
  font-weight: 400;
  color: #a898b8;
}

.addr-quick-row {
  display: flex;
  gap: 4px;
  margin-bottom: 6px;
  flex-wrap: wrap;
}

.chip-sm {
  padding: 3px 10px;
  border-radius: 10px;
  border: 1px solid #d4c4dc;
  background: #fff;
  color: #5e5468;
  font-size: 10px;
  cursor: pointer;
  font-family: inherit;
}
.chip-sm:hover { background: #f8f4fb; }
.chip-sm.add { border-color: #f08ca4; color: #f08ca4; }

.input-row {
  display: flex;
  gap: 4px;
  align-items: center;
}
.input-row input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #e8e0ec;
  border-radius: 10px;
  font-size: 12px;
  font-family: inherit;
  color: #5e5468;
  background: #fff;
}
.btn-icon {
  padding: 6px 10px;
  border: none;
  border-radius: 8px;
  background: #fdfbff;
  cursor: pointer;
  font-size: 14px;
  flex-shrink: 0;
}

.adv-label {
  font-size: 11px;
  color: #8a8098;
  font-weight: 600;
  display: block;
  margin: 10px 0 6px;
}

.dist-est {
  font-size: 11px;
  color: #a898b8;
  margin-top: 4px;
}
```

- [ ] **Step 4: 验证编译和基本功能**

运行：
```bash
cd C:\Users\Administrator\Desktop\RadomPath-vue && npm run dev
```

检查：
1. 页面打开无 JS 编译错误
2. GPS 定位条显示（自动获取位置或默认文本）
3. 模式卡片可点击切换
4. 时长滑块可拖动
5. 点「出发」能正常生成路线
6. 结果卡片正常展示
7. 高级面板可展开/折叠
8. 地址簿管理弹窗正常

- [ ] **Step 5: 验证旧功能完整性**

逐一验证：
1. 切换模式卡片 → 场景值变更 → 时长联动
2. 点「多生成几条对比」→ 多路线卡片展示
3. 导航按钮 → 跳转高德
4. GPX 下载 → 文件下载
5. 分享 → Canvas 生成 + 下载/分享
6. 地址簿 → 新增/删除地址
7. 密码解锁 → dev 功能正常

- [ ] **Step 6: Commit**

```bash
cd C:\Users\Administrator\Desktop\RadomPath-vue
git add src/components/SceneCards.vue src/components/TimeSlider.vue src/views/ExploreView.vue
git commit -m "feat(Phase1): 首页简化 — 模式卡片 + 时长滑块 + 一键出发"
```

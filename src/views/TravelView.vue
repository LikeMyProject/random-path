<script setup>
import { ref, computed, watch } from 'vue'
import { CITY_LIST, CITY_GROUPS, getCity } from '../data/cities.js'
import { buildFullPlan, buildTextGuide, supplementAttractions, PACE_ATTRACTIONS, PACE_LABEL, INTEREST_LABEL } from '../composables/useTravel.js'
import { searchHotelsForCity, formatPrice, formatRating, formatDist, isGoodRated, nearestMall, PERSONA_OPTIONS, PERSONA_GROUPS, estimateTransit, TRANSIT_LABEL } from '../composables/useHotel.js'
import { shareGuideImage } from '../composables/useShareGuide.js'
import ItineraryTimeline from '../components/ItineraryTimeline.vue'

const toast = (m, t) => window.$toast?.(m, t)

// ===== 输入状态 =====
const origin = ref('')                     // 出发地（可选）
const selectedCities = ref([])             // 目的地城市（按顺序）
const startDate = ref(''), endDate = ref('')
const pace = ref('standard')
const interests = ref([])
const loading = ref(false)

// 默认日期：下周一开始，4 天
function defaultDates() {
  const t = new Date()
  const s = new Date(t); s.setDate(s.getDate() + 7)
  const e = new Date(s); e.setDate(e.getDate() + 3)
  return { s: fmt(s), e: fmt(e) }
}
function fmt(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const def = defaultDates()
startDate.value = def.s; endDate.value = def.e

const remaining = computed(() => CITY_LIST.filter(c => !selectedCities.value.includes(c)))
const remainingGroups = computed(() => CITY_GROUPS
  .map(g => ({ ...g, cities: g.cities.filter(c => !selectedCities.value.includes(c)) }))
  .filter(g => g.cities.length > 0))
const cityToAdd = ref('')
function onSelectCity() {
  if (!cityToAdd.value) return
  if (!selectedCities.value.includes(cityToAdd.value)) selectedCities.value.push(cityToAdd.value)
  cityToAdd.value = ''
}
function toggleHot(c) {
  const i = selectedCities.value.indexOf(c)
  if (i >= 0) selectedCities.value.splice(i, 1)
  else selectedCities.value.push(c)
}
function toggleInterest(k) {
  const i = interests.value.indexOf(k)
  if (i >= 0) interests.value.splice(i, 1)
  else interests.value.push(k)
}
function toggleCity(name) {
  showAdvanced.value = showAdvanced.value === name ? '' : name
}
const totalDays = computed(() => {
  if (!startDate.value || !endDate.value) return 0
  const a = new Date(startDate.value), b = new Date(endDate.value)
  if (b < a) return 0
  return Math.round((b - a) / 86400000) + 1
})

function addCity() {
  if (remaining.value.length === 0) return
  selectedCities.value.push(remaining.value[0])
}
function removeCity(i) { selectedCities.value.splice(i, 1) }
function moveCity(i, dir) {
  const j = i + dir
  if (j < 0 || j >= selectedCities.value.length) return
  const arr = selectedCities.value
  ;[arr[i], arr[j]] = [arr[j], arr[i]]
}

// ===== 结果状态 =====
const plan = ref(null)
const activeDayMap = ref({})
const showAdvanced = ref(true) // 每城折叠详情
const suppLoading = ref('')

function rebuild() {
  if (selectedCities.value.length === 0 || !startDate.value || !endDate.value) return
  const p = buildFullPlan({
    cities: selectedCities.value,
    startDate: startDate.value,
    endDate: endDate.value,
    pace: pace.value,
    interests: interests.value,
    originCity: origin.value,
  })
  if (!p) { toast('请检查日期设置', 'warn'); return }
  // 天数校验
  if (p.totalDays < selectedCities.value.length + Math.max(0, selectedCities.value.length - 1)) {
    toast(`天数太紧：${selectedCities.value.length} 城至少需要 ${selectedCities.value.length + Math.max(0, selectedCities.value.length - 1)} 天`, 'warn')
  }
  plan.value = p
  p.cityPlans.forEach(cp => { if (!(cp.name in activeDayMap.value)) activeDayMap.value[cp.name] = 0 })
}

async function generate() {
  if (selectedCities.value.length === 0) { toast('请先选择目的地城市', 'warn'); return }
  if (!startDate.value || !endDate.value) { toast('请选择往返日期', 'warn'); return }
  loading.value = true
  try {
    // 预生成，检查各城景点是否满足 天数×每日景点数
    const p = buildFullPlan({
      cities: selectedCities.value,
      startDate: startDate.value,
      endDate: endDate.value,
      pace: pace.value,
      interests: interests.value,
      originCity: origin.value,
    })
    if (p) {
      const perDay = PACE_ATTRACTIONS[pace.value] || 3
      const needSup = p.cityPlans.some(cp => cp.data.attractions.length < cp.days * perDay)
      if (needSup) {
        toast('景点不足，正在用高德实时补充…', 'warn')
        for (const cp of p.cityPlans) {
          const need = cp.days * perDay
          let miss = need - cp.data.attractions.length
          let round = 0
          while (miss > 0 && round < 2) {
            const added = await supplementAttractions(cp.name)
            if (added.length === 0) break
            cp.data.attractions.push(...added)
            miss = need - cp.data.attractions.length
            round++
          }
        }
      }
    }
  } catch (e) { /* 补充失败不阻断 */ }
  setTimeout(() => { rebuild(); loading.value = false }, 200)
}

// ===== 高德 POI 补充景点 =====
async function doSupplement(cityName) {
  if (suppLoading.value) return
  suppLoading.value = cityName
  try {
    const added = await supplementAttractions(cityName)
    if (added.length === 0) { toast('未找到更多景点，或已收录', 'warn'); return }
    const cp = plan.value?.cityPlans.find(c => c.name === cityName)
    if (cp) {
      cp.data.attractions.push(...added)
      rebuild()
      toast(`已补充 ${added.length} 个景点（实时搜索）`)
    }
  } catch (e) { toast('补充失败', 'err') }
  suppLoading.value = ''
}

// ===== 高德导航到景点 =====
function openAmapNav(lng, lat, name) {
  const url = `https://uri.amap.com/navigation?to=${lng},${lat},${encodeURIComponent(name)}&mode=bike&coordinate=gaode&callnative=1`
  window.open(url, '_blank')
}

// ===== 导出 =====
function copyGuide() {
  if (!plan.value) return
  const txt = buildTextGuide(plan.value)
  navigator.clipboard?.writeText(txt).then(() => toast('攻略已复制，可粘贴到备忘录/发给朋友')).catch(() => {})
}
function downloadGuide() {
  if (!plan.value) return
  const txt = buildTextGuide(plan.value)
  const blob = new Blob([txt], { type: 'text/markdown;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `旅行攻略_${plan.value.cities.join('-')}_${plan.value.totalDays}天.md`
  a.click(); URL.revokeObjectURL(a.href)
  toast('攻略已下载')
}

// 城市链展示
const cityChain = computed(() => {
  if (!plan.value) return []
  return plan.value.cityPlans.map(cp => ({ name: cp.name, days: cp.days }))
})

// 监听输入变化自动重新生成（防抖）
let rbTimer = null
watch([selectedCities, startDate, endDate, pace, interests], () => {
  clearTimeout(rbTimer)
  rbTimer = setTimeout(() => { if (plan.value) rebuild() }, 400)
}, { deep: true })

// ===== 酒店搜索 =====
const HOTEL_PRESETS = [
  { key: 'budget', label: '经济 <300', min: 0, max: 300 },
  { key: 'comfort', label: '舒适 300-600', min: 300, max: 600 },
  { key: 'premium', label: '高档 600-1200', min: 600, max: 1200 },
]
const hotelOpen = ref('')             // 展开酒店面板的城市名
const hotelPreset = ref({})           // city -> budget/comfort/premium/custom
const hotelCustomMin = ref({}), hotelCustomMax = ref({})
const hotelAttraction = ref({})       // city -> 指定景点名（'' = 全部）
const hotelState = ref({})            // city -> { loading, progress, list }
const personas = ref([])              // 个性化参数（全局多选）
const hotelExpand = ref({})           // city -> 展开出行估算的酒店索引

function togglePersona(key) {
  const i = personas.value.indexOf(key)
  if (i >= 0) personas.value.splice(i, 1)
  else personas.value.push(key)
}
function personaGroup(group) { return PERSONA_OPTIONS.filter(p => p.group === group) }
function matchCls(pct) { return pct >= 80 ? 'high' : pct >= 50 ? 'mid' : 'low' }

function toggleHotel(name) { hotelOpen.value = hotelOpen.value === name ? '' : name }
function setHotelPreset(name, key) { hotelPreset.value[name] = key }
function hotelRange(name) {
  const p = hotelPreset.value[name]
  const preset = HOTEL_PRESETS.find(x => x.key === p)
  if (preset) return { min: preset.min, max: preset.max }
  const mn = parseFloat(hotelCustomMin.value[name]), mx = parseFloat(hotelCustomMax.value[name])
  if (isNaN(mn) && isNaN(mx)) return null
  return { min: isNaN(mn) ? 0 : mn, max: isNaN(mx) ? Infinity : mx }
}
async function doSearchHotel(cp) {
  const range = hotelRange(cp.name)
  if (!range) { toast('请选择或输入价位范围', 'warn'); return }
  hotelState.value[cp.name] = { loading: true, progress: '准备搜索…', list: [], searched: false }
  let attrs = cp.data.attractions
  const pick = hotelAttraction.value[cp.name]
  if (pick) attrs = attrs.filter(a => a.name === pick)
  try {
    const list = await searchHotelsForCity(
      attrs.map(a => ({ name: a.name, coord: a.coord })),
      {
        min: range.min, max: range.max,
        personas: personas.value,
        onProgress: ({ done, total }) => { hotelState.value[cp.name].progress = `正在搜索 ${done}/${total} 个景点周边…` },
      }
    )
    hotelState.value[cp.name].list = list
    hotelState.value[cp.name].searched = true
    // 给每家酒店补城市标记（用于分享长图选择）
    list.forEach(h => { h.city = cp.name })
    if (list.length === 0) toast('没有符合价位的酒店，试试调整范围', 'warn')
    else toast(`找到 ${list.length} 家酒店`)
  } catch (e) { toast('酒店搜索失败: ' + e.message, 'err') }
  hotelState.value[cp.name].loading = false
}
function openHotelNav(h) {
  const url = `https://uri.amap.com/navigation?to=${h.coord.lng},${h.coord.lat},${encodeURIComponent(h.name)}&mode=car&coordinate=gaode&callnative=1`
  window.open(url, '_blank')
}
function toggleHotelExpand(city, i) {
  hotelExpand.value[city] = hotelExpand.value[city] === i ? -1 : i
}

// ===== 长图分享（需先选酒店）=====
const shareModal = ref(false)
const shareHotel = ref(null)
const sharing = ref(false)
const allHotels = computed(() => {
  const list = []
  for (const [city, st] of Object.entries(hotelState.value)) {
    for (const h of (st.list || [])) list.push({ ...h, city: h.city || city })
  }
  return list
})
function openShareModal() {
  if (allHotels.value.length === 0) {
    toast('请先在任意城市搜索酒店，再生成分享长图', 'warn')
    return
  }
  shareHotel.value = null
  shareModal.value = true
}
async function doShareGuide() {
  if (!plan.value) return
  if (!shareHotel.value) { toast('请先选择一家酒店', 'warn'); return }
  sharing.value = true
  try {
    const r = await shareGuideImage(plan.value, shareHotel.value)
    shareModal.value = false
    if (r === 'shared') toast('已分享 🎉')
    else toast('长图已下载 📥')
  } catch (e) { toast('生成失败: ' + e.message, 'err') }
  sharing.value = false
}
</script>

<template>
<div>
  <!-- ===== 输入区 ===== -->
  <div class="card">
    <h2>✈️ 旅行攻略生成器</h2>
    <p class="tip">输入目的地与往返时间，一键生成结构化攻略</p>

    <label class="lbl">🏠 出发地 <span class="hint">(可选，默认你所在城市)</span></label>
    <input v-model="origin" placeholder="如：西安" class="inp" />

    <label class="lbl">📍 目的地城市 <span class="hint">(按顺序 = 行程顺序)</span></label>
    <div class="city-sel">
      <select v-model="cityToAdd" class="inp" @change="onSelectCity">
        <option value="">-- 选择要去的城市（共 {{ remaining.length }} 城可选）--</option>
        <optgroup v-for="g in remainingGroups" :key="g.province" :label="g.province">
          <option v-for="c in g.cities" :key="c" :value="c">{{ c }} · {{ getCity(c)?.days }}天建议</option>
        </optgroup>
      </select>
    </div>
    <div v-if="selectedCities.length" class="city-chips">
      <div v-for="(c, i) in selectedCities" :key="c" class="city-chip">
        <span class="cc-order">{{ i + 1 }}</span>
        <span class="cc-name">{{ c }}</span>
        <button class="cc-btn" :disabled="i === 0" @click="moveCity(i, -1)">↑</button>
        <button class="cc-btn" :disabled="i === selectedCities.length - 1" @click="moveCity(i, 1)">↓</button>
        <button class="cc-btn cc-del" @click="removeCity(i)">✕</button>
      </div>
    </div>
    <div v-else class="empty-tip">还没选城市，从下拉选择或点下方热门推荐</div>
    <div class="hot-cities">
      <button v-for="c in ['成都','重庆','西安','杭州','青岛','三亚','张家界','丽江']" :key="c"
        :class="['chip-sm', { on: selectedCities.includes(c) }]"
        @click="toggleHot(c)">{{ c }}</button>
    </div>

    <label class="lbl">📅 往返日期</label>
    <div class="date-row">
      <input type="date" v-model="startDate" class="inp" />
      <span class="date-sep">→</span>
      <input type="date" v-model="endDate" class="inp" />
    </div>
    <p v-if="totalDays > 0" class="days-hint">
      共 <strong>{{ totalDays }}</strong> 天
      <template v-if="selectedCities.length > 1"> · {{ selectedCities.length }} 城 · 需 ≥ {{ selectedCities.length + selectedCities.length - 1 }} 天</template>
    </p>

    <label class="lbl">🏃 行程节奏</label>
    <div class="chip-row">
      <button v-for="(label, key) in PACE_LABEL" :key="key"
        :class="['chip', { active: pace === key }]" @click="pace = key">
        {{ key === 'relax' ? '🌿 ' : key === 'standard' ? '⚖️ ' : '🔥 ' }}{{ label }}
      </button>
    </div>

    <label class="lbl">🎯 兴趣偏好 <span class="hint">(可多选)</span></label>
    <div class="chip-row">
      <button v-for="(label, key) in INTEREST_LABEL" :key="key"
        :class="['chip', { active: interests.includes(key) }]"
        @click="toggleInterest(key)">
        {{ key === 'nature' ? '🏔 ' : key === 'culture' ? '🏛 ' : key === 'food' ? '🍜 ' : key === 'family' ? '👨‍👩‍👧 ' : '🏙 ' }}{{ label }}
      </button>
    </div>

    <button class="btn btn-primary btn-gen" :disabled="loading" @click="generate">
      {{ loading ? '生成中…' : '✨ 一键生成攻略' }}
    </button>
  </div>

  <!-- ===== 结果区 ===== -->
  <template v-if="plan">
    <!-- 行程总览 -->
    <div class="card">
      <h2>📋 行程总览</h2>
      <div class="chain">
        <template v-for="(c, i) in cityChain" :key="c.name">
          <span class="chain-city">{{ c.name }}<span class="chain-days">{{ c.days }}天</span></span>
          <span v-if="i < cityChain.length - 1" class="chain-arrow">→</span>
        </template>
      </div>
      <div class="plan-meta">
        <span>{{ plan.startDate }} ~ {{ plan.endDate }}</span>
        <span>共 {{ plan.totalDays }} 天 · {{ plan.paceLabel }}节奏</span>
      </div>

      <div v-if="plan.transports.length" class="transport-list">
        <div v-for="(t, i) in plan.transports" :key="i" class="transport-item">
          <span class="t-mode">{{ t.mode }}</span>
          <span class="t-route">{{ t.from }} → {{ t.to }}</span>
          <span class="t-time">约 {{ t.hours }} 小时{{ t.estimated ? '（估算）' : '' }}</span>
        </div>
      </div>
    </div>

    <!-- 每城攻略 -->
    <div v-for="cp in plan.cityPlans" :key="cp.name" class="card city-card">
      <div class="city-head" @click="toggleCity(cp.name)">
        <div>
          <span class="city-name">{{ cp.name }}</span>
          <span class="city-days">{{ cp.days }} 天</span>
          <span class="city-range">{{ cp.dateRange.start.toLocaleDateString('zh-CN', {month:'numeric', day:'numeric'}) }}~{{ cp.dateRange.end.toLocaleDateString('zh-CN', {month:'numeric', day:'numeric'}) }}</span>
        </div>
        <div class="city-right">
          <span class="city-weather" v-if="cp.weather">{{ cp.weather.low }}~{{ cp.weather.high }}°C {{ cp.weather.feel }}</span>
          <span class="arrow" :class="{ open: showAdvanced === cp.name }">▾</span>
        </div>
      </div>
      <p class="city-desc">{{ cp.data.desc }}</p>

      <!-- 每日行程 -->
      <ItineraryTimeline :city="cp" v-model:activeDay="activeDayMap[cp.name]" />

      <button class="btn btn-sm btn-supp" :disabled="suppLoading === cp.name" @click="doSupplement(cp.name)">
        {{ suppLoading === cp.name ? '搜索中…' : '🔍 补充更多景点（高德实时）' }}
      </button>

      <!-- 酒店搜索 -->
      <button class="btn btn-sm btn-hotel" :class="{ on: hotelOpen === cp.name }" @click="toggleHotel(cp.name)">
        🏨 按预算找附近酒店
      </button>
      <div v-if="hotelOpen === cp.name" class="hotel-panel">
        <!-- 个性化参数（多选） -->
        <div class="persona-sec">
          <div class="persona-title">🎯 个性化偏好 <span class="hint">多选，按匹配度推荐</span></div>
          <div v-for="g in PERSONA_GROUPS" :key="g" class="persona-group">
            <span class="persona-group-label">{{ g }}</span>
            <div class="persona-chips">
              <button
                v-for="opt in personaGroup(g)" :key="opt.key"
                :class="['chip-sm', { on: personas.includes(opt.key) }]"
                :title="opt.desc"
                @click="togglePersona(opt.key)"
              >{{ opt.label }}</button>
            </div>
          </div>
        </div>

        <div class="hotel-presets">
          <button
            v-for="p in HOTEL_PRESETS" :key="p.key"
            :class="['chip-sm', { on: hotelPreset[cp.name] === p.key }]"
            @click="setHotelPreset(cp.name, p.key)"
          >{{ p.label }}</button>
          <button
            :class="['chip-sm', { on: hotelPreset[cp.name] === 'custom' }]"
            @click="setHotelPreset(cp.name, 'custom')"
          >✏️ 自定义</button>
        </div>
        <div v-if="hotelPreset[cp.name] === 'custom'" class="hotel-custom">
          <input v-model="hotelCustomMin[cp.name]" type="number" min="0" placeholder="最低 ¥" class="inp" />
          <span class="date-sep">~</span>
          <input v-model="hotelCustomMax[cp.name]" type="number" min="0" placeholder="最高 ¥" class="inp" />
        </div>
        <div class="hotel-attraction-sel">
          <select v-model="hotelAttraction[cp.name]" class="inp">
            <option value="">📍 全部热门景点周边</option>
            <option v-for="a in cp.data.attractions" :key="a.name" :value="a.name">{{ a.name }}</option>
          </select>
        </div>
        <button class="btn btn-sm btn-hotel-search" :disabled="hotelState[cp.name]?.loading" @click="doSearchHotel(cp)">
          {{ hotelState[cp.name]?.loading ? '搜索中…' : '🔍 搜索酒店' }}
        </button>

        <div v-if="hotelState[cp.name]?.loading" class="hotel-loading">
          <span class="spin">⏳</span> {{ hotelState[cp.name]?.progress }}
        </div>
        <div v-else-if="hotelState[cp.name]?.list?.length" class="hotel-results">
          <div class="hotel-count">共 {{ hotelState[cp.name].list.length }} 家 · 按推荐度排序 · 点击查看出行估算</div>
          <div
            v-for="(h, i) in hotelState[cp.name].list"
            :key="i"
            class="hotel-item"
            :class="{ open: hotelExpand[cp.name] === i }"
            @click="toggleHotelExpand(cp.name, i)"
          >
            <div class="h-row1">
              <span v-if="h.pct != null" class="h-match" :class="matchCls(h.pct)">{{ h.pct }}% 匹配</span>
              <span class="h-name">{{ h.name }}</span>
              <span v-if="isGoodRated(h)" class="h-badge good">好评</span>
              <span v-if="h.priceInferred" class="h-badge ref">参考价</span>
              <span class="h-nav" title="高德导航" @click.stop="openHotelNav(h)">🧭</span>
              <span class="h-arrow" :class="{ open: hotelExpand[cp.name] === i }">▾</span>
            </div>
            <div class="h-row2">
              <span class="h-price">{{ formatPrice(h) }}/晚</span>
              <span class="h-rating" :class="{ none: h.rating == null && !h.reputation, [h.reputation?.cls]: !!h.reputation }">{{ formatRating(h) }}</span>
              <span class="h-dist">距 {{ h.attraction }} {{ formatDist(h) }}</span>
            </div>
            <div v-if="h.tags?.length" class="h-tags">
              <span v-for="t in h.tags" :key="t" class="h-tag">{{ t }}</span>
              <span v-if="nearestMall(h)" class="h-mall">🏬 近{{ nearestMall(h).name }} {{ nearestMall(h).km.toFixed(1) }}km</span>
            </div>

            <!-- 出行估算面板 -->
            <div v-if="hotelExpand[cp.name] === i" class="transit-panel">
              <div class="transit-title">🚗 从本酒店到各景点 <span class="hint">（直线距离估算）</span></div>
              <div v-for="t in estimateTransit(h, cp.data.attractions)" :key="t.attraction" class="transit-row">
                <span class="tr-attr">{{ t.attraction }}</span>
                <span class="tr-dist">{{ t.km }}km</span>
                <span class="tr-mode" :class="'m-' + t.mode">{{ TRANSIT_LABEL[t.mode] }}</span>
                <span class="tr-time">{{ t.timeMin }}min</span>
                <span class="tr-fee">{{ t.fee }}</span>
              </div>
              <div class="transit-note">💡 估算参考：步行 5km/h · 骑行 15km/h · 公交地铁 22km/h · 打车 30km/h，实际以导航为准</div>
            </div>
          </div>
        </div>
        <div v-else class="hotel-empty">
          {{ hotelState[cp.name]?.searched ? '没有符合该价位的酒店，试试放宽范围' : '设置价位范围后点击搜索，实时查找景点周边酒店' }}
        </div>
      </div>

      <!-- 折叠：美食 / 贴士 / 全部景点 -->
      <div v-if="showAdvanced === cp.name" class="city-more">
        <div class="more-sec">
          <div class="more-title">🍜 必吃美食</div>
          <div class="food-grid">
            <div v-for="(f, i) in cp.data.foods" :key="i" class="food-item">
              <span class="food-name">{{ f.name }}</span>
              <span class="food-price">{{ f.price }}</span>
              <span class="food-desc">{{ f.desc }}</span>
            </div>
          </div>
        </div>
        <div class="more-sec">
          <div class="more-title">💡 实用贴士</div>
          <ul class="tips-list">
            <li v-for="(t, i) in cp.data.tips" :key="i">{{ t }}</li>
          </ul>
        </div>
        <div class="more-sec">
          <div class="more-title">🗺 全部景点 <span class="hint">(点击导航)</span></div>
          <div class="all-attractions">
            <div v-for="(a, i) in cp.data.attractions" :key="i" class="attr-row" @click="openAmapNav(a.coord.lng, a.coord.lat, a.name)">
              <span class="attr-must">★{{ a.mustSee }}</span>
              <span class="attr-name">{{ a.name }}<span v-if="a.poi" class="poi-badge">实时</span></span>
              <span class="attr-ticket">{{ a.ticket }}</span>
              <span class="attr-nav">🧭</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 预算 -->
    <div class="card">
      <h2>💰 预算参考（人均）</h2>
      <div class="budget-items">
        <div v-for="(it, i) in plan.budget.items" :key="i" class="budget-item">
          <span class="b-label">{{ it.label }}</span>
          <span class="b-value">{{ it.value }}</span>
        </div>
      </div>
      <div class="budget-total">
        合计 <strong>¥{{ plan.budget.total[0] }} ~ ¥{{ plan.budget.total[1] }}</strong>
        <span class="hint">（经济~舒适区间）</span>
      </div>
    </div>

    <!-- 导出 -->
    <div class="card">
      <h2>📤 攻略导出</h2>
      <div style="display:flex;gap:8px">
        <button class="btn btn-sm btn-secondary" style="flex:1" @click="copyGuide">📋 复制文本</button>
        <button class="btn btn-sm btn-secondary" style="flex:1" @click="downloadGuide">📥 下载 .md</button>
      </div>
      <button class="btn btn-sm btn-share" style="margin-top:8px;width:100%" @click="openShareModal">🖼 生成分享长图（含精选酒店）</button>
    </div>

    <!-- 酒店选择弹窗（长图分享前） -->
    <div class="modal" v-if="shareModal" @click.self="shareModal = false">
      <div class="inner">
        <div style="display:flex;align-items:center;justify-content:space-between">
          <h3>🏨 选择一家酒店入图</h3>
          <button class="btn btn-sm" style="background:transparent;color:#a898b8" @click="shareModal=false">✕</button>
        </div>
        <p style="font-size:11px;color:#a898b8;margin:4px 0 8px">长图将包含你选中的酒店信息（共 {{ allHotels.length }} 家可选）</p>
        <div class="share-hotel-list">
          <div
            v-for="(h, i) in allHotels" :key="i"
            :class="['share-hotel-item', { on: shareHotel === h }]"
            @click="shareHotel = h"
          >
            <span class="sh-city">{{ h.city }}</span>
            <div class="sh-main">
              <div class="sh-name">{{ h.name }}</div>
              <div class="sh-meta">{{ formatPrice(h) }} · {{ formatRating(h) }} · 距 {{ h.attraction }} {{ formatDist(h) }}</div>
            </div>
            <span class="sh-check" :class="{ on: shareHotel === h }">✓</span>
          </div>
        </div>
        <button class="btn btn-primary" style="margin-top:10px" :disabled="sharing || !shareHotel" @click="doShareGuide">
          {{ sharing ? '生成中…' : '🖼 生成长图并分享' }}
        </button>
      </div>
    </div>
  </template>
</div>
</template>

<style scoped>
.tip { font-size: 11px; color: #a898b8; margin-bottom: 12px; }
.lbl { display: block; font-size: 12px; font-weight: 700; color: #5e5468; margin: 12px 0 6px; }
.hint { font-size: 10px; color: #a898b8; font-weight: 400; }
.inp { font-size: 13px; }
.date-row { display: flex; gap: 6px; align-items: center; }
.date-sep { color: #d4c4dc; font-weight: 700; }
.days-hint { font-size: 11px; color: #a898b8; margin-top: 6px; }
.days-hint strong { color: #f08ca4; }
.chip-row { display: flex; gap: 4px; flex-wrap: wrap; }
.chip {
  border: 2px solid #e5dcec; border-radius: 10px; padding: 6px 10px; font-size: 11px; font-weight: 600;
  background: #fff; color: #8a7a98; cursor: pointer; transition: all .2s; font-family: inherit;
}
.chip.active { background: linear-gradient(135deg, #f08ca4, #e27790); color: #fff; border-color: #f08ca4; }
.city-sel { position: relative; }
.city-chips { display: flex; flex-direction: column; gap: 4px; margin-top: 6px; }
.city-chip {
  display: flex; align-items: center; gap: 6px; padding: 5px 8px; background: #faf7fc;
  border: 1px solid #ece0ec; border-radius: 8px; font-size: 12px;
}
.cc-order { width: 18px; height: 18px; border-radius: 50%; background: #f08ca4; color: #fff; font-size: 10px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
.cc-name { flex: 1; font-weight: 700; color: #5e5468; }
.cc-btn { border: none; background: #f3f0f7; border-radius: 5px; width: 24px; height: 24px; cursor: pointer; font-size: 11px; color: #8a7a98; }
.cc-btn:disabled { opacity: .3; }
.cc-del { background: #fcebeb; color: #e24b4a; }
.empty-tip { font-size: 11px; color: #c4b5d0; padding: 8px 0; }
.hot-cities { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 8px; }
.chip-sm {
  padding: 3px 10px; border-radius: 10px; border: 1px solid #d4c4dc; background: #fff; color: #5e5468;
  font-size: 10px; cursor: pointer; font-family: inherit;
}
.chip-sm.on { background: #f08ca4; color: #fff; border-color: #f08ca4; }
.btn-gen { margin-top: 14px; }

/* 结果区 */
.chain { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin: 8px 0; }
.chain-city { background: linear-gradient(135deg, #f08ca4, #e27790); color: #fff; padding: 5px 12px; border-radius: 10px; font-size: 13px; font-weight: 700; display: flex; align-items: center; gap: 6px; }
.chain-days { background: rgba(255,255,255,0.25); border-radius: 6px; padding: 1px 6px; font-size: 10px; }
.chain-arrow { color: #d4c4dc; font-weight: 700; }
.plan-meta { display: flex; gap: 10px; font-size: 11px; color: #a898b8; flex-wrap: wrap; }
.transport-list { margin-top: 8px; }
.transport-item { display: flex; align-items: center; gap: 8px; padding: 6px 0; border-bottom: 1px dashed #f2eaf4; font-size: 11px; }
.transport-item:last-child { border-bottom: none; }
.t-mode { background: #e1f5ee; color: #0f6e56; border-radius: 5px; padding: 1px 7px; font-weight: 700; font-size: 10px; }
.t-route { font-weight: 700; color: #5e5468; flex: 1; }
.t-time { color: #a898b8; }

.city-head { display: flex; justify-content: space-between; align-items: center; cursor: pointer; }
.city-name { font-size: 17px; font-weight: 800; color: #4a3f55; }
.city-days { background: #fbeaf0; color: #993556; font-size: 10px; font-weight: 700; border-radius: 6px; padding: 2px 8px; margin-left: 6px; }
.city-range { font-size: 11px; color: #a898b8; margin-left: 8px; }
.city-right { display: flex; align-items: center; gap: 8px; }
.city-weather { font-size: 11px; color: #f0a870; font-weight: 700; }
.arrow { transition: transform .2s; color: #b0a3bc; }
.arrow.open { transform: rotate(180deg); }
.city-desc { font-size: 11px; color: #a898b8; margin: 4px 0 10px; }
.btn-supp { margin-top: 8px; background: linear-gradient(135deg, #7c3aed, #a855f7); color: #fff; }
.city-more { margin-top: 10px; border-top: 1px dashed #ece0ec; padding-top: 10px; }
.more-sec { margin-bottom: 12px; }
.more-title { font-size: 12px; font-weight: 700; color: #5e5468; margin-bottom: 6px; }
.food-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.food-item { background: #fdfbff; border: 1px solid #f2eaf4; border-radius: 8px; padding: 6px 8px; display: flex; flex-direction: column; }
.food-name { font-size: 12px; font-weight: 700; color: #5e5468; }
.food-price { font-size: 10px; color: #f08ca4; font-weight: 700; }
.food-desc { font-size: 10px; color: #a898b8; margin-top: 2px; }
.tips-list { margin: 0; padding-left: 16px; font-size: 11px; color: #8a7a98; line-height: 1.8; }
.all-attractions { display: flex; flex-direction: column; }
.attr-row { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 8px; cursor: pointer; transition: background .15s; font-size: 12px; }
.attr-row:hover { background: #f8f4fb; }
.attr-must { color: #f0a870; font-weight: 700; font-size: 11px; width: 28px; }
.attr-name { flex: 1; font-weight: 600; color: #5e5468; display: flex; align-items: center; gap: 5px; }
.attr-ticket { font-size: 10px; color: #a898b8; }
.attr-nav { font-size: 13px; }
.poi-badge { font-size: 9px; background: #e6f1fb; color: #185fa5; border-radius: 4px; padding: 1px 5px; font-weight: 600; }

.budget-items { display: flex; flex-direction: column; }.budget-item { display: flex; justify-content: space-between; padding: 7px 0; border-bottom: 1px dashed #f2eaf4; font-size: 12px; }
.b-label { color: #8a7a98; }
.b-value { font-weight: 700; color: #5e5468; }
.budget-total { text-align: center; margin-top: 10px; font-size: 13px; color: #8a7a98; }
.budget-total strong { color: #e27790; font-size: 16px; }

/* 酒店搜索 */
.btn-hotel { margin-top: 8px; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff; }
.btn-hotel.on { opacity: .85; }
.hotel-panel { margin-top: 8px; background: #f8f7ff; border: 1px solid #e0e0f0; border-radius: 12px; padding: 10px; }
.persona-sec { margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px dashed #e0e0f0; }
.persona-title { font-size: 12px; font-weight: 700; color: #5e5468; margin-bottom: 8px; }
.persona-group { margin-bottom: 6px; }
.persona-group-label { font-size: 10px; color: #a898b8; font-weight: 700; display: block; margin-bottom: 3px; }
.persona-chips { display: flex; gap: 4px; flex-wrap: wrap; }
.persona-chips .chip-sm.on { background: #8b5cf6; color: #fff; border-color: #8b5cf6; }
.hotel-presets { display: flex; gap: 4px; flex-wrap: wrap; }
.hotel-presets .chip-sm.on { background: #6366f1; color: #fff; border-color: #6366f1; }
.hotel-custom { display: flex; gap: 6px; align-items: center; margin-top: 8px; }
.hotel-custom .inp { flex: 1; }
.hotel-attraction-sel { margin-top: 8px; }
.btn-hotel-search { margin-top: 8px; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff; width: 100%; }
.hotel-loading { text-align: center; color: #7c6fd8; font-size: 12px; padding: 14px 0; }
.hotel-loading .spin { display: inline-block; animation: hspin 1s linear infinite; }
@keyframes hspin { to { transform: rotate(360deg) } }
.hotel-results { margin-top: 8px; }
.hotel-count { font-size: 11px; color: #a898b8; margin-bottom: 6px; }
.hotel-item {
  background: #fff; border: 1px solid #ece5f8; border-radius: 10px; padding: 8px 10px;
  margin-bottom: 6px; cursor: pointer; transition: all .15s;
}
.hotel-item:hover { border-color: #8b5cf6; box-shadow: 0 2px 8px rgba(139,92,246,.12); }
.h-row1 { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.h-name { font-size: 13px; font-weight: 700; color: #4a3f55; flex: 1; }
.h-match { font-size: 10px; font-weight: 800; border-radius: 5px; padding: 1px 7px; color: #fff; flex-shrink: 0; }
.h-match.high { background: #16a34a; }
.h-match.mid { background: #f59e0b; }
.h-match.low { background: #a898b8; }
.h-badge { font-size: 9px; border-radius: 4px; padding: 1px 6px; font-weight: 700; }
.h-badge.good { background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; }
.h-badge.ref { background: #faf7fc; color: #8a7a98; border: 1px solid #e5dcec; }
.h-row2 { display: flex; align-items: center; gap: 10px; margin-top: 4px; flex-wrap: wrap; }
.h-price { font-size: 12px; font-weight: 800; color: #e27790; }
.h-rating { font-size: 11px; font-weight: 700; color: #f59e0b; }
.h-rating.none { color: #a898b8; font-weight: 400; }
.h-rating.premium { color: #8b5cf6; }
.h-rating.chain { color: #0f6e56; }
.h-rating.bnb { color: #d4537e; }
.h-dist { font-size: 11px; color: #8a7a98; margin-left: auto; }
.h-tags { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 5px; align-items: center; }
.h-tag { font-size: 9px; background: #f3f0f7; color: #7c6fd8; border-radius: 4px; padding: 1px 6px; font-weight: 600; }
.h-mall { font-size: 9px; color: #a898b8; margin-left: auto; }
.h-nav { font-size: 13px; cursor: pointer; padding: 0 2px; }
.h-arrow { font-size: 10px; color: #b0a3bc; transition: transform .2s; }
.h-arrow.open { transform: rotate(180deg); }

/* 出行估算面板 */
.transit-panel { margin-top: 8px; border-top: 1px dashed #e0e0f0; padding-top: 8px; }
.transit-title { font-size: 11px; font-weight: 700; color: #5e5468; margin-bottom: 6px; }
.transit-row {
  display: flex; align-items: center; gap: 6px; padding: 4px 0;
  border-bottom: 1px dashed #f0eef7; font-size: 11px;
}
.transit-row:last-child { border-bottom: none; }
.tr-attr { flex: 1; color: #5e5468; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tr-dist { color: #a898b8; font-size: 10px; width: 42px; text-align: right; }
.tr-mode { font-size: 10px; font-weight: 700; border-radius: 4px; padding: 1px 5px; width: 76px; text-align: center; }
.tr-mode.m-walk { background: #e1f5ee; color: #0f6e56; }
.tr-mode.m-bike { background: #e6f1fb; color: #185fa5; }
.tr-mode.m-transit { background: #faeeda; color: #854f0b; }
.tr-mode.m-taxi { background: #fbeaf0; color: #993556; }
.tr-time { color: #8a7a98; width: 42px; text-align: right; font-size: 10px; }
.tr-fee { font-weight: 700; color: #e27790; width: 56px; text-align: right; font-size: 11px; }
.transit-note { margin-top: 6px; font-size: 9px; color: #b0a3bc; line-height: 1.5; }
.hotel-empty { text-align: center; color: #a898b8; font-size: 11px; padding: 14px 8px; }
.btn-share { background: linear-gradient(135deg, #1e1b4b, #312e81); color: #fff; }
.share-hotel-list { max-height: 300px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; }
.share-hotel-item {
  display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 10px;
  border: 2px solid #ece5f8; background: #fff; cursor: pointer; transition: all .15s;
}
.share-hotel-item.on { border-color: #7c3aed; background: #f8f6ff; }
.sh-city { font-size: 10px; background: #f3f0f7; color: #7c6fd8; border-radius: 5px; padding: 2px 6px; font-weight: 700; flex-shrink: 0; }
.sh-main { flex: 1; min-width: 0; }
.sh-name { font-size: 13px; font-weight: 700; color: #4a3f55; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sh-meta { font-size: 11px; color: #a898b8; margin-top: 2px; }
.sh-check { width: 22px; height: 22px; border-radius: 50%; border: 2px solid #d4c4dc; display: flex; align-items: center; justify-content: center; font-size: 12px; color: transparent; flex-shrink: 0; }
.sh-check.on { background: #7c3aed; border-color: #7c3aed; color: #fff; }
.modal { position: fixed; inset: 0; background: rgba(30,27,75,0.45); z-index: 100; display: flex; align-items: center; justify-content: center; padding: 20px; }
.inner { background: #fff; border-radius: 16px; padding: 16px; width: 100%; max-width: 440px; max-height: 82vh; overflow-y: auto; box-shadow: 0 10px 40px rgba(30,27,75,0.25); }
.inner h3 { font-size: 15px; color: #4a3f55; }
</style>

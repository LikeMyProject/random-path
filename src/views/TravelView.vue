<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { CITY_LIST, CITY_GROUPS, getCity } from '../data/cities.js'
import { buildSpotPlan, buildTextGuide, enrichAttractions, cityDayAdvice, orderAttractions, INTEREST_LABEL, groupByCategory, CAT_META } from '../composables/useTravel.js'
import { SPOT_EXT, SPOT_FOOD, SPOT_SHOP } from '../composables/useAMap.js'
import { searchFoodNear } from '../composables/useAMap.js'
import { searchHotelsForCity, formatPrice, formatRating, formatDist, isGoodRated, nearestMall, PERSONA_OPTIONS, PERSONA_GROUPS, estimateTransit, TRANSIT_LABEL } from '../composables/useHotel.js'
import { shareGuideImage } from '../composables/useShareGuide.js'

const toast = (m, t) => window.$toast?.(m, t)

// ===== 输入状态 =====
const selectedCities = ref([])              // 目的地城市（按顺序）
const interests = ref([])
const loading = ref(false)

// ===== 最后一次搜索缓存（打开自动恢复）=====
const SEARCH_KEY = 'radompath:travel:lastSearch'
function saveLastSearch() {
  try {
    localStorage.setItem(SEARCH_KEY, JSON.stringify({
      cities: selectedCities.value,
      interests: interests.value,
    }))
  } catch (e) {}
}
function loadLastSearch() {
  try {
    const raw = localStorage.getItem(SEARCH_KEY)
    if (!raw) return false
    const d = JSON.parse(raw)
    if (!Array.isArray(d.cities)) return false
    selectedCities.value = d.cities.filter(c => CITY_LIST.includes(c))
    interests.value = Array.isArray(d.interests) ? d.interests : []
    return selectedCities.value.length > 0
  } catch (e) { return false }
}
// 打开页面时恢复上次搜索，若有有效输入则自动生成
const restored = loadLastSearch()
onMounted(() => {
  if (restored && selectedCities.value.length) {
    setTimeout(() => { if (!plan.value) generate() }, 150)
  }
})
// 输入变化防抖保存
let saveTimer = null
let regenTimer = null
watch([selectedCities, interests], () => {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(saveLastSearch, 500)
  // 切换城市/兴趣后，若已生成过攻略，自动重新生成 —— 避免「切换城市后清单没变、点补充没反应」
  if (plan.value && selectedCities.value.length > 0) {
    clearTimeout(regenTimer)
    regenTimer = setTimeout(() => generate(), 350)
  }
}, { deep: true })

const remaining = computed(() => CITY_LIST.filter(c => !selectedCities.value.includes(c)))
const remainingGroups = computed(() => CITY_GROUPS
  .map(g => ({ ...g, cities: g.cities.filter(c => !selectedCities.value.includes(c)) }))
  .filter(g => g.cities.length > 0))

// 城市推荐天数 + 时间理由（无具体日期，仅按最佳季节给建议）
const cityAdviceList = computed(() => {
  const list = selectedCities.value.length
    ? selectedCities.value
    : ['成都', '重庆', '西安', '杭州', '青岛', '三亚', '张家界', '丽江']
  return list.filter(c => getCity(c)).map(c => ({ name: c, ...cityDayAdvice(c, null) }))
})
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
const showAdvanced = ref('')   // 每城折叠酒店/补充
const suppLoading = ref('')

function generate() {
  if (selectedCities.value.length === 0) { toast('请先选择目的地城市', 'warn'); return }
  loading.value = true
  try {
    const p = buildSpotPlan({ cities: selectedCities.value, interests: interests.value })
    if (!p) { toast('生成失败，请重试', 'err'); return }
    plan.value = p
    // 自动从高分补充更多景点（沙滩/小众打卡/景区），让清单更丰富
    enrichPlan(p)
  } catch (e) {
    toast('生成失败: ' + (e?.message || e), 'err')
  } finally {
    loading.value = false
  }
}

// 生成后异步补充景点（不阻塞首屏渲染）
async function enrichPlan(p) {
  let total = 0
  for (const cp of p.cityPlans) {
    try {
      const added = await enrichAttractions(cp.name, cp.attractions)
      if (added.length) {
        cp.attractions = orderAttractions([...cp.attractions, ...added])
        total += added.length
      }
    } catch (e) {}
  }
  if (total > 0) toast(`已联网补充 ${total} 个地点（景点/美食/购物，含商场·夜市等）`)
}

// ===== 手动「补充更多地点」：同时补充 景点(扩展) / 美食 / 购物 三类，保证真能加新东西 =====
const SUPPLEMENT_CATS = [...SPOT_EXT, ...SPOT_FOOD, ...SPOT_SHOP]
async function doSupplement(cityName) {
  if (suppLoading.value) return
  const cp = plan.value?.cityPlans.find(c => c.name === cityName)
  if (!cp) return
  suppLoading.value = cityName
  try {
    const added = await enrichAttractions(cityName, cp.attractions, { cats: SUPPLEMENT_CATS, cap: 30, rad: 1.2, targets: { sight: 30, food: 14, shop: 30 } })
    if (added.length === 0) { toast('该市已收录常见地点，暂无更多补充', 'warn'); return }
    cp.attractions = orderAttractions([...cp.attractions, ...added])
    toast(`已补充 ${added.length} 个地点（景点/美食/购物，高德实时）`)
  } catch (e) { toast('补充失败，请重试', 'err') }
  finally { suppLoading.value = '' }
}

// ===== 点击景点 → 加载附近特色美食（懒加载 + 缓存）=====
const foodMap = ref({})   // key: '城市|景点名' -> { loading, list, open }
function foodKey(cp, a) { return cp.name + '|' + a.name }
function setFood(key, patch) {
  foodMap.value = { ...foodMap.value, [key]: { ...(foodMap.value[key] || {}), ...patch } }
}
async function toggleAttractionFood(cp, a) {
  const key = foodKey(cp, a)
  const cur = foodMap.value[key]
  if (cur) {
    setFood(key, { open: !cur.open })
    return
  }
  setFood(key, { loading: true, list: [], open: true })
  try {
    const list = await searchFoodNear(a.coord, { radius: 2500, limit: 8 })
    setFood(key, { loading: false, list })
  } catch (e) {
    setFood(key, { loading: false, list: [] })
  }
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
  a.download = `旅行攻略_${plan.value.cities.join('-')}.md`
  a.click(); URL.revokeObjectURL(a.href)
  toast('攻略已下载')
}

// 从美食列表中取某景点附近店（供模板读取）
function attrFood(cp, a) { return foodMap.value[foodKey(cp, a)] || null }
// 美食距当前景点的直线距离文案
function formatFoodDist(r) {
  if (r.distM == null) return ''
  return r.distM < 1000 ? `距此约 ${r.distM}m` : `距此约 ${(r.distM / 1000).toFixed(1)}km`
}

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
function personaLabel(key) { return PERSONA_OPTIONS.find(o => o.key === key)?.label || key }
function matchCls(pct) { return pct >= 80 ? 'high' : pct >= 50 ? 'mid' : 'low' }
function kindCls(k) {
  return { 民宿: 'bnb', 客栈: 'inn', 青旅: 'hostel', 公寓: 'apt', 酒店: 'hotel', 旅馆: 'innn', 住宿: 'stay' }[k] || 'stay'
}

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
  let attrs = cp.attractions
  const pick = hotelAttraction.value[cp.name]
  if (pick) attrs = attrs.filter(a => a.name === pick)
  try {
    const raw = await searchHotelsForCity(
      attrs.map(a => ({ name: a.name, coord: a.coord })),
      {
        min: range.min, max: range.max,
        personas: personas.value,
        onProgress: ({ done, total }) => { hotelState.value[cp.name].progress = `正在搜索 ${done}/${total} 个景点周边…` },
      }
    )
    // 勾选了偏好时，只保留「100% 匹配」的住宿（命中全部所选条件）
    let list = raw
    if (personas.value.length) {
      const full = raw.filter(h => h.pct === 100)
      list = full
      hotelState.value[cp.name].filteredByFull = raw.length > 0 && full.length === 0
    }
    hotelState.value[cp.name].list = list
    hotelState.value[cp.name].searched = true
    list.forEach(h => { h.city = cp.name })
    if (list.length === 0) {
      if (personas.value.length && raw.length > 0) toast('没有完全符合全部偏好的住宿，可试试减少勾选', 'warn')
      else toast('没有符合价位/范围的住宿，试试调整范围', 'warn')
    } else {
      toast(`找到 ${list.length} 家住宿（含酒店/民宿）`)
    }
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
    <h2>✈️ 旅行景点清单</h2>
    <p class="tip">选城市即可生成按顺序的景点清单，点景点看附近特色美食（无天数规划）</p>

    <label class="lbl">📍 目的地城市 <span class="hint">(按顺序 = 推荐游览顺序)</span></label>
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

    <div class="city-advice" v-if="cityAdviceList.length">
      <div class="ca-title">🗓 城市推荐天数 <span class="hint">（含时间理由）</span></div>
      <div v-for="a in cityAdviceList" :key="a.name" class="ca-card" :class="{ off: a.seasonFit === 'off' }">
        <div class="ca-head">
          <span class="ca-name">{{ a.name }}</span>
          <span class="ca-days">推荐 {{ a.days }} 天</span>
          <span v-if="a.bestSeason" class="ca-season" :class="a.seasonFit === 'best' ? 'good' : 'warn'">{{ a.bestSeason }}</span>
        </div>
        <div class="ca-reason">{{ a.reason }}</div>
      </div>
    </div>

    <label class="lbl">🎯 兴趣偏好 <span class="hint">(可多选，用于筛选景点)</span></label>
    <div class="chip-row">
      <button v-for="(label, key) in INTEREST_LABEL" :key="key"
        :class="['chip', { active: interests.includes(key) }]"
        @click="toggleInterest(key)">
        {{ key === 'nature' ? '🏔 ' : key === 'culture' ? '🏛 ' : key === 'food' ? '🍜 ' : key === 'family' ? '👨‍👩‍👧 ' : '🏙 ' }}{{ label }}
      </button>
    </div>

    <button class="btn btn-primary btn-gen" :disabled="loading" @click="generate">
      {{ loading ? '生成中…' : '✨ 生成景点清单' }}
    </button>
  </div>

  <!-- ===== 结果区 ===== -->
  <template v-if="plan">
    <!-- 每城景点清单 -->
    <div v-for="cp in plan.cityPlans" :key="cp.name" class="card city-card">
      <div class="city-head" @click="toggleCity(cp.name)">
        <div>
          <span class="city-name">{{ cp.name }}</span>
          <span class="city-count">{{ cp.attractions.length }} 个地点</span>
        </div>
        <div class="city-right">
          <span class="city-weather" v-if="cp.weather">{{ cp.weather.low }}~{{ cp.weather.high }}°C {{ cp.weather.feel }}</span>
          <span class="arrow" :class="{ open: showAdvanced === cp.name }">▾</span>
        </div>
      </div>
      <p class="city-desc">{{ cp.data.desc }}</p>

      <!-- 地点清单（按 景点/美食/购物 分类显示，点击展开附近特色美食） -->
      <div v-for="grp in groupByCategory(cp.attractions)" :key="grp.key" class="cat-sec">
        <div class="cat-head" :class="'cat-' + grp.key">
          <span class="cat-icon">{{ grp.icon }}</span>
          <span class="cat-name">{{ grp.label }}</span>
          <span class="cat-count">{{ grp.items.length }}</span>
        </div>
        <div class="attr-list">
          <div v-for="(a, i) in grp.items" :key="a.name" class="attr-item" :class="'cat-' + (a.category || 'sight')">
            <div class="attr-row" @click="toggleAttractionFood(cp, a)">
              <span class="attr-idx">{{ i + 1 }}</span>
              <span class="attr-must" v-if="a.category !== 'food' && a.category !== 'shop'">★{{ a.mustSee }}</span>
              <span class="attr-cat-icon" v-else :title="CAT_META[a.category]?.label">{{ CAT_META[a.category]?.icon }}</span>
              <span class="attr-name">{{ a.name }}<span v-if="a.tag" class="poi-badge tag">{{ a.tag }}</span><span v-else-if="a.poi" class="poi-badge">实时</span></span>
              <span class="attr-ticket">{{ a.ticket }}</span>
              <span class="attr-fold" :class="{ open: attrFood(cp,a)?.open }">▾</span>
              <span class="attr-nav" title="高德导航" @click.stop="openAmapNav(a.coord.lng, a.coord.lat, a.name)">🧭</span>
            </div>

            <!-- 附近特色美食（点击后懒加载） -->
            <div v-if="attrFood(cp, a)?.open" class="attr-food">
              <div v-if="attrFood(cp, a).loading" class="food-loading-bar">
                <span class="spin">⏳</span> 正在搜索「{{ a.name }}」附近特色美食…
              </div>
              <div v-else-if="attrFood(cp, a).list.length" class="food-grid">
                <div v-for="(r, j) in attrFood(cp, a).list" :key="j" class="food-item restaurant-item">
                  <div class="rest-header">
                    <span class="food-name">🍜 {{ r.name }}</span>
                    <span v-if="r.rating" class="rest-rating">⭐ {{ r.rating }}</span>
                  </div>
                  <div class="rest-meta">
                    <span v-if="r.price" class="food-price">{{ r.price }}</span>
                    <span v-if="r.tag" class="rest-tag">{{ r.tag }}</span>
                  </div>
                  <div v-if="r.address" class="food-desc">📍 {{ r.address }}</div>
                  <div v-if="r.distM != null" class="food-dist">🚶 {{ formatFoodDist(r) }}</div>
                </div>
              </div>
              <div v-else class="food-empty">附近暂未搜索到特色美食，换个点试试</div>
            </div>
          </div>
        </div>
      </div>

      <button class="btn btn-sm btn-supp" :disabled="suppLoading === cp.name" @click="doSupplement(cp.name)">
        {{ suppLoading === cp.name ? '搜索中…' : '🔍 补充更多地点（景点/美食/购物）' }}
      </button>

      <!-- 酒店搜索 -->
      <button class="btn btn-sm btn-hotel" :class="{ on: hotelOpen === cp.name }" @click="toggleHotel(cp.name)">
        🏨 按预算找附近住宿（酒店/民宿）
      </button>
      <div v-if="hotelOpen === cp.name" class="hotel-panel">
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
            <option v-for="a in cp.attractions" :key="a.name" :value="a.name">{{ a.name }}</option>
          </select>
        </div>
        <button class="btn btn-sm btn-hotel-search" :disabled="hotelState[cp.name]?.loading" @click="doSearchHotel(cp)">
          {{ hotelState[cp.name]?.loading ? '搜索中…' : '🔍 搜索住宿' }}
        </button>

        <div v-if="personas.length && hotelState[cp.name]?.searched" class="hotel-prefs">
          <span class="pref-label">你的偏好：</span>
          <span v-for="k in personas" :key="k" class="pref-chip">{{ personaLabel(k) }}</span>
          <span class="pref-note">（列表均为 100% 匹配，每条标注命中原因）</span>
        </div>

        <div v-if="hotelState[cp.name]?.loading" class="hotel-loading">
          <span class="spin">⏳</span> {{ hotelState[cp.name]?.progress }}
        </div>
        <div v-else-if="hotelState[cp.name]?.list?.length" class="hotel-results">
          <div class="hotel-count">共 {{ hotelState[cp.name].list.length }} 家 · {{ personas.length ? '仅显示 100% 匹配偏好' : '按评分/距离排序' }} · 点击查看出行估算</div>
          <div
            v-for="(h, i) in hotelState[cp.name].list"
            :key="i"
            class="hotel-item"
            :class="{ open: hotelExpand[cp.name] === i }"
            @click="toggleHotelExpand(cp.name, i)"
          >
            <div class="h-row1">
              <span v-if="h.pct != null" class="h-match" :class="matchCls(h.pct)">{{ h.pct }}% 匹配</span>
              <span class="h-kind" :class="kindCls(h.kind)">{{ h.kind }}</span>
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

            <div v-if="hotelExpand[cp.name] === i" class="transit-panel">
              <div class="transit-title">🚗 从本酒店到各景点 <span class="hint">（直线距离估算）</span></div>
              <div v-for="t in estimateTransit(h, cp.attractions)" :key="t.attraction" class="transit-row">
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
          <template v-if="hotelState[cp.name]?.filteredByFull">已勾选偏好，但附近没有完全符合全部条件的住宿（酒店/民宿）。</template>
          <template v-else-if="hotelState[cp.name]?.searched">没有符合该价位/范围的住宿，试试放宽范围。</template>
          <template v-else>设置价位范围后点击搜索，实时查找景点周边酒店与民宿。</template>
        </div>
      </div>

      <!-- 折叠：贴士 -->
      <div v-if="showAdvanced === cp.name" class="city-more">
        <div class="more-sec">
          <div class="more-title">💡 实用贴士</div>
          <ul class="tips-list">
            <li v-for="(t, i) in cp.data.tips" :key="i">{{ t }}</li>
          </ul>
        </div>
      </div>
    </div>

    <!-- 预算 -->
    <div class="card" v-if="plan.budget">
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
          <h3>🏨 选择一家住宿入图</h3>
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
.tip { font-size: 12px; color: #a898b8; margin-bottom: 14px; }
.lbl { display: block; font-size: 11px; font-weight: 700; color: #7a6c8a; margin: 14px 0 6px; text-transform: uppercase; letter-spacing: .3px; }
.hint { font-size: 10px; color: #b0a3bc; font-weight: 400; text-transform: none; letter-spacing: 0; }
.inp { font-size: 13px; }
.chip-row { display: flex; gap: 4px; flex-wrap: wrap; }
.chip {
  border: none; background: #f0edf5; border-radius: 10px; padding: 7px 12px; font-size: 11px; font-weight: 600;
  color: #7a6c8a; cursor: pointer; transition: all .2s; font-family: inherit;
}
.chip.active { background: linear-gradient(135deg, var(--accent), var(--accent-2)); color: #fff; box-shadow: 0 3px 10px rgba(var(--accent-rgb),.22); }
.city-sel { position: relative; }
.city-chips { display: flex; flex-direction: column; gap: 4px; margin-top: 6px; }
.city-chip {
  display: flex; align-items: center; gap: 6px; padding: 8px 10px; background: #f7f5fa;
  border: none; border-radius: 12px; font-size: 12px; transition: background .15s;
}
.city-chip:hover { background: var(--accent-soft); }
.cc-order { width: 22px; height: 22px; border-radius: 8px; background: linear-gradient(135deg, var(--accent), var(--accent-2)); color: #fff; font-size: 11px; font-weight: 800; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.cc-name { flex: 1; font-weight: 700; color: #4a3f55; }
.cc-btn { border: none; background: rgba(0,0,0,.04); border-radius: 8px; width: 26px; height: 26px; cursor: pointer; font-size: 11px; color: #8a8098; transition: all .15s; }
.cc-btn:hover { background: rgba(0,0,0,.08); }
.cc-btn:disabled { opacity: .3; }
.cc-del { background: rgba(220,38,38,.08); color: #dc2626; }
.cc-del:hover { background: rgba(220,38,38,.15); }
.empty-tip { font-size: 12px; color: #c4b5d0; padding: 10px 0; }
.hot-cities { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 8px; }
.chip-sm {
  padding: 5px 12px; border-radius: 10px; border: none; background: #f0edf5; color: #5e5468;
  font-size: 10px; font-weight: 600; cursor: pointer; font-family: inherit; transition: all .15s;
}
.chip-sm:hover { background: var(--accent-soft); color: var(--accent); }
.chip-sm.on { background: linear-gradient(135deg, var(--accent), var(--accent-2)); color: #fff; }
.city-advice { margin-top: 12px; background: #faf8fc; border: 1px solid #efe9f4; border-radius: 12px; padding: 10px 12px; }
.ca-title { font-size: 12px; font-weight: 700; color: #5e5468; margin-bottom: 8px; }
.ca-card { background: #fff; border-radius: 10px; padding: 8px 10px; margin-bottom: 8px; border-left: 3px solid var(--accent); }
.ca-card:last-child { margin-bottom: 0; }
.ca-card.off { border-left-color: #e0a83c; }
.ca-head { display: flex; align-items: center; gap: 8px; }
.ca-name { font-weight: 700; color: #3a3145; font-size: 13px; }
.ca-days { background: var(--accent-soft); color: var(--accent); font-size: 10px; font-weight: 700; border-radius: 8px; padding: 2px 8px; }
.ca-season { font-size: 10px; font-weight: 700; border-radius: 8px; padding: 2px 8px; }
.ca-season.good { background: #e6f6ec; color: #2e9e5b; }
.ca-season.warn { background: #fdf0db; color: #c8881f; }
.ca-reason { font-size: 11px; color: #8074a0; margin-top: 5px; line-height: 1.5; }
.btn-gen { margin-top: 16px; }

/* 结果区 */
.city-head { display: flex; justify-content: space-between; align-items: center; cursor: pointer; }
.city-name { font-size: 18px; font-weight: 800; color: #3a3045; letter-spacing: -.3px; }
.city-count { background: var(--accent-soft); color: var(--accent); font-size: 10px; font-weight: 700; border-radius: 8px; padding: 3px 9px; margin-left: 6px; }
.city-right { display: flex; align-items: center; gap: 8px; }
.city-weather { font-size: 11px; color: #f0a870; font-weight: 700; }
.arrow { transition: transform .2s; color: #b0a3bc; }
.arrow.open { transform: rotate(180deg); }
.city-desc { font-size: 11px; color: #a898b8; margin: 4px 0 10px; line-height: 1.6; }
.btn-supp { margin-top: 8px; background: linear-gradient(135deg, #7c3aed, #a855f7); color: #fff; box-shadow: 0 3px 10px rgba(124,58,237,.25); }
.city-more { margin-top: 10px; border-top: 1px solid rgba(0,0,0,.04); padding-top: 10px; }
.more-sec { margin-bottom: 12px; }
.more-title { font-size: 12px; font-weight: 700; color: #4a3f55; margin-bottom: 6px; }

/* 景点清单 */
.attr-list { display: flex; flex-direction: column; gap: 6px; margin-top: 4px; }

/* 分类区块（景点 / 美食 / 购物） */
.cat-sec { margin-top: 4px; }
.cat-head { display: flex; align-items: center; gap: 6px; margin: 12px 2px 7px; padding-bottom: 4px; border-bottom: 1px dashed rgba(0,0,0,.06); }
.cat-icon { font-size: 15px; line-height: 1; }
.cat-name { font-size: 14px; font-weight: 800; letter-spacing: -.2px; }
.cat-count { font-size: 10px; background: #f0edf5; color: #7a6c8a; border-radius: 8px; padding: 2px 8px; font-weight: 700; }
.cat-sight .cat-name { color: var(--accent); }
.cat-food .cat-name { color: #e0890a; }
.cat-shop .cat-name { color: #4f6bed; }
.cat-sight .cat-count { background: var(--accent-soft); color: var(--accent); }
.cat-food .cat-count { background: #fdf0db; color: #c8881f; }
.cat-shop .cat-count { background: #e8edfd; color: #4f6bed; }
.attr-cat-icon { flex-shrink: 0; font-size: 13px; width: 24px; text-align: center; }
.attr-item.cat-food { border-left: 3px solid #f59e0b; }
.attr-item.cat-shop { border-left: 3px solid #3b82f6; }
.attr-item.cat-sight { border-left: 3px solid var(--accent); }
.attr-item { background: #f7f5fa; border: none; border-radius: 12px; overflow: hidden; }
.attr-row {
  display: flex; align-items: center; gap: 8px; padding: 10px 12px; cursor: pointer; transition: background .15s; font-size: 12px;
}
.attr-row:hover { background: var(--accent-soft); }
.attr-idx { width: 20px; height: 20px; border-radius: 6px; background: var(--accent-soft); color: var(--accent); font-size: 10px; font-weight: 800; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.attr-must { color: #f0a870; font-weight: 800; font-size: 11px; width: 24px; flex-shrink: 0; }
.attr-name { flex: 1; font-weight: 600; color: #4a3f55; display: flex; align-items: center; gap: 5px; }
.attr-ticket { font-size: 10px; color: #a898b8; flex-shrink: 0; }
.attr-fold { color: #b0a3bc; font-size: 11px; transition: transform .2s; flex-shrink: 0; }
.attr-fold.open { transform: rotate(180deg); }
.attr-nav { font-size: 13px; flex-shrink: 0; }
.poi-badge { font-size: 9px; background: #e6f1fb; color: #185fa5; border-radius: 4px; padding: 1px 5px; font-weight: 600; }
.poi-badge.tag { background: #e9fbf2; color: #0f6e56; }

/* 附近美食 */
.attr-food { background: #fffdfa; border-top: 1px dashed #f0e2cf; padding: 10px 12px; }
.food-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.food-item { background: #f7f5fa; border: none; border-radius: 12px; padding: 8px 10px; display: flex; flex-direction: column; }
.restaurant-item { padding: 10px 12px; gap: 3px; }
.rest-header { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
.rest-rating { font-size: 10px; color: #f59e0b; font-weight: 700; flex-shrink: 0; }
.rest-meta { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.rest-tag { font-size: 9px; background: #f0edf5; color: #7c6fd8; border-radius: 6px; padding: 2px 6px; font-weight: 600; }
.food-empty { font-size: 12px; color: #b0a3bc; padding: 8px; text-align: center; }
.food-loading-bar { padding: 8px 4px; color: var(--accent); font-size: 12px; display: flex; align-items: center; gap: 8px; }
.food-loading-bar .spin { display: inline-block; animation: hspin 1s linear infinite; }
@keyframes hspin { to { transform: rotate(360deg) } }
.food-name { font-size: 12px; font-weight: 700; color: #4a3f55; }
.food-price { font-size: 10px; color: var(--accent); font-weight: 700; }
.food-desc { font-size: 10px; color: #a898b8; margin-top: 2px; }
.food-dist { font-size: 10px; color: var(--accent); font-weight: 700; margin-top: 2px; }

.tips-list { margin: 0; padding-left: 16px; font-size: 11px; color: #7a6c8a; line-height: 1.8; }

.budget-items { display: flex; flex-direction: column; }
.budget-item { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(0,0,0,.04); font-size: 12px; }
.budget-item:last-child { border: none; }
.b-label { color: #7a6c8a; }
.b-value { font-weight: 700; color: #4a3f55; }
.budget-total { text-align: center; margin-top: 12px; font-size: 13px; color: #7a6c8a; padding: 10px; background: var(--accent-soft); border-radius: 12px; }
.budget-total strong { color: var(--accent); font-size: 17px; }

/* 酒店搜索 */
.btn-hotel { margin-top: 8px; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff; box-shadow: 0 3px 10px rgba(99,102,241,.25); }
.btn-hotel.on { opacity: .85; }
.hotel-panel { margin-top: 8px; background: #f7f5fa; border: none; border-radius: 14px; padding: 12px; }
.persona-sec { margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid rgba(0,0,0,.04); }
.persona-title { font-size: 12px; font-weight: 700; color: #4a3f55; margin-bottom: 8px; }
.persona-group { margin-bottom: 6px; }
.persona-group-label { font-size: 10px; color: #a898b8; font-weight: 700; display: block; margin-bottom: 3px; text-transform: uppercase; letter-spacing: .3px; }
.persona-chips { display: flex; gap: 4px; flex-wrap: wrap; }
.persona-chips .chip-sm.on { background: #8b5cf6; color: #fff; }
.hotel-presets { display: flex; gap: 4px; flex-wrap: wrap; }
.hotel-presets .chip-sm.on { background: #6366f1; color: #fff; }
.hotel-custom { display: flex; gap: 6px; align-items: center; margin-top: 8px; }
.hotel-custom .inp { flex: 1; }
.hotel-attraction-sel { margin-top: 8px; }
.btn-hotel-search { margin-top: 8px; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff; width: 100%; box-shadow: 0 3px 10px rgba(99,102,241,.25); }
.hotel-prefs { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; margin-top: 8px; font-size: 11px; }
.hotel-prefs .pref-label { color: #7c6fd8; font-weight: 700; }
.hotel-prefs .pref-chip { background: #eef2ff; color: #4338ca; border: 1px solid #c7d2fe; border-radius: 999px; padding: 2px 8px; font-weight: 700; }
.hotel-prefs .pref-note { color: #a898b8; }
.hotel-loading { text-align: center; color: #7c6fd8; font-size: 12px; padding: 16px 0; }
.hotel-loading .spin { display: inline-block; animation: hspin 1s linear infinite; }
.hotel-results { margin-top: 8px; }
.hotel-count { font-size: 11px; color: #a898b8; margin-bottom: 6px; }
.hotel-item {
  background: #fff; border: none; border-radius: 14px; padding: 10px 12px;
  margin-bottom: 6px; cursor: pointer; transition: all .15s; box-shadow: 0 1px 4px rgba(0,0,0,.04);
}
.hotel-item:hover { box-shadow: 0 3px 12px rgba(99,102,241,.12); transform: translateY(-1px); }
.h-row1 { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.h-name { font-size: 13px; font-weight: 700; color: #3a3045; flex: 1; }
.h-match { font-size: 10px; font-weight: 800; border-radius: 6px; padding: 2px 8px; color: #fff; flex-shrink: 0; }
.h-match.high { background: #16a34a; }
.h-match.mid { background: #f59e0b; }
.h-match.low { background: #a898b8; }
.h-kind { font-size: 10px; font-weight: 800; border-radius: 6px; padding: 2px 8px; flex-shrink: 0; border: 1px solid transparent; }
.h-kind.hotel { background: #eef2ff; color: #4338ca; border-color: #c7d2fe; }
.h-kind.bnb { background: #ecfdf5; color: #047857; border-color: #a7f3d0; }
.h-kind.inn { background: #fff7ed; color: #c2410c; border-color: #fed7aa; }
.h-kind.hostel { background: #eff6ff; color: #1d4ed8; border-color: #bfdbfe; }
.h-kind.apt { background: #faf5ff; color: #7e22ce; border-color: #e9d5ff; }
.h-kind.innn { background: #f1f5f9; color: #475569; border-color: #e2e8f0; }
.h-kind.stay { background: #f1f5f9; color: #475569; border-color: #e2e8f0; }
.h-badge { font-size: 9px; border-radius: 4px; padding: 1px 6px; font-weight: 700; }
.h-badge.good { background: #f0fdf4; color: #166534; }
.h-badge.ref { background: #f0edf5; color: #7a6c8a; }
.h-row2 { display: flex; align-items: center; gap: 10px; margin-top: 4px; flex-wrap: wrap; }
.h-price { font-size: 13px; font-weight: 800; color: var(--accent-2); }
.h-rating { font-size: 11px; font-weight: 700; color: #f59e0b; }
.h-rating.none { color: #b0a3bc; font-weight: 400; }
.h-rating.premium { color: #8b5cf6; }
.h-rating.chain { color: #0f6e56; }
.h-rating.bnb { color: #d4537e; }
.h-dist { font-size: 11px; color: #8a8098; margin-left: auto; }
.h-tags { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 5px; align-items: center; }
.h-tag { font-size: 9px; background: #f0edf5; color: #7c6fd8; border-radius: 6px; padding: 2px 7px; font-weight: 600; }
.h-mall { font-size: 9px; color: #b0a3bc; margin-left: auto; }
.h-nav { font-size: 13px; cursor: pointer; padding: 0 2px; }
.h-arrow { font-size: 10px; color: #b0a3bc; transition: transform .2s; }
.h-arrow.open { transform: rotate(180deg); }
.transit-panel { margin-top: 8px; border-top: 1px solid rgba(0,0,0,.04); padding-top: 8px; }
.transit-title { font-size: 11px; font-weight: 700; color: #4a3f55; margin-bottom: 6px; }
.transit-row { display: flex; align-items: center; gap: 6px; padding: 5px 0; border-bottom: 1px solid rgba(0,0,0,.03); font-size: 11px; }
.transit-row:last-child { border-bottom: none; }
.tr-attr { flex: 1; color: #4a3f55; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tr-dist { color: #b0a3bc; font-size: 10px; width: 42px; text-align: right; }
.tr-mode { font-size: 10px; font-weight: 700; border-radius: 6px; padding: 2px 6px; width: 76px; text-align: center; }
.tr-mode.m-walk { background: #e1f5ee; color: #0f6e56; }
.tr-mode.m-bike { background: #e6f1fb; color: #185fa5; }
.tr-mode.m-transit { background: #faeeda; color: #854f0b; }
.tr-mode.m-taxi { background: #fbeaf0; color: #993556; }
.tr-time { color: #8a8098; width: 42px; text-align: right; font-size: 10px; }
.tr-fee { font-weight: 700; color: var(--accent-2); width: 56px; text-align: right; font-size: 11px; }
.transit-note { margin-top: 6px; font-size: 9px; color: #b0a3bc; line-height: 1.5; }
.hotel-empty { text-align: center; color: #b0a3bc; font-size: 12px; padding: 16px 8px; }
.btn-share { background: linear-gradient(135deg, #1e1b4b, #312e81); color: #fff; box-shadow: 0 3px 10px rgba(30,27,75,.25); }
.share-hotel-list { max-height: 300px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; }
.share-hotel-item {
  display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-radius: 12px;
  border: 2px solid transparent; background: #f7f5fa; cursor: pointer; transition: all .15s;
}
.share-hotel-item.on { border-color: #7c3aed; background: #f8f6ff; }
.sh-city { font-size: 10px; background: #f0edf5; color: #7c6fd8; border-radius: 6px; padding: 2px 7px; font-weight: 700; flex-shrink: 0; }
.sh-main { flex: 1; min-width: 0; }
.sh-name { font-size: 13px; font-weight: 700; color: #3a3045; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sh-meta { font-size: 11px; color: #b0a3bc; margin-top: 2px; }
.sh-check { width: 24px; height: 24px; border-radius: 8px; border: 2px solid #d4c4dc; display: flex; align-items: center; justify-content: center; font-size: 12px; color: transparent; flex-shrink: 0; transition: all .15s; }
.sh-check.on { background: #7c3aed; border-color: #7c3aed; color: #fff; }
</style>

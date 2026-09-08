<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { CITY_LIST, CITY_GROUPS, getCity } from '../data/cities.js'
import { buildSpotPlan, buildTextGuide, enrichAttractions, cityDayAdvice, orderAttractions, INTEREST_LABEL, groupByCategory, CAT_META } from '../composables/useTravel.js'
import { SPOT_EXT, SPOT_FOOD, SPOT_SHOP } from '../composables/useAMap.js'
import { searchFoodNear } from '../composables/useAMap.js'
import { searchHotelsForCity, formatPrice, formatRating, formatDist, isGoodRated, nearestMall, PERSONA_OPTIONS, PERSONA_GROUPS, estimateTransit, TRANSIT_LABEL } from '../composables/useHotel.js'
import { shareGuideImage } from '../composables/useShareGuide.js'
import Icon from '../components/Icon.vue'

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
const suppDots = ref('')   // 补充中的动态省略号，避免静态"搜索中"像卡死

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
// 总超时兜底：即使底层某次请求真挂起，按钮也必然复位，不会永久卡在"搜索中"
function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(Object.assign(new Error('timeout'), { timeout: true })), ms)
    promise.then(v => { clearTimeout(t); resolve(v) }, e => { clearTimeout(t); reject(e) })
  })
}
async function doSupplement(cityName) {
  if (suppLoading.value) return
  const cp = plan.value?.cityPlans.find(c => c.name === cityName)
  if (!cp) return
  suppLoading.value = cityName
  // 动态省略号动画，让"搜索中"明显在动，不再是死板的卡死感
  const pulse = setInterval(() => { suppDots.value = suppDots.value.length >= 3 ? '' : suppDots.value + '.' }, 400)
  try {
    const added = await withTimeout(
      enrichAttractions(cityName, cp.attractions, { cats: SUPPLEMENT_CATS, cap: 30, rad: 1.2, targets: { sight: 30, food: 14, shop: 30 } }),
      60000
    )
    if (added.length === 0) { toast('该市已收录常见地点，暂无更多补充', 'warn'); return }
    cp.attractions = orderAttractions([...cp.attractions, ...added])
    toast(`已补充 ${added.length} 个地点（景点/美食/购物，高德实时）`)
  } catch (e) {
    toast(e?.timeout ? '补充请求超时，请稍后重试' : '补充失败，请重试', 'err')
  }
  finally { clearInterval(pulse); suppDots.value = ''; suppLoading.value = '' }
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
    if (r === 'shared') toast('已分享')
    else toast('长图已下载')
  } catch (e) { toast('生成失败: ' + e.message, 'err') }
  sharing.value = false
}
</script>

<template>
<div>
  <!-- ===== 输入区 ===== -->
  <div class="card">
    <h2><Icon name="plane" :size="15" />旅行景点清单</h2>
    <p class="tip">选城市即可生成按顺序的景点清单，点景点看附近特色美食（无天数规划）</p>

    <label class="lbl">目的地城市 <span class="hint">（按顺序 = 推荐游览顺序）</span></label>
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
        <button class="cc-btn" :disabled="i === 0" @click="moveCity(i, -1)"><Icon name="arrowUp" :size="12" /></button>
        <button class="cc-btn" :disabled="i === selectedCities.length - 1" @click="moveCity(i, 1)"><Icon name="arrowDown" :size="12" /></button>
        <button class="cc-btn cc-del" @click="removeCity(i)"><Icon name="x" :size="12" /></button>
      </div>
    </div>
    <div v-else class="empty-tip">还没选城市，从下拉选择或点下方热门推荐</div>
    <div class="hot-cities">
      <button v-for="c in ['成都','重庆','西安','杭州','青岛','三亚','张家界','丽江']" :key="c"
        :class="['chip-sm', { on: selectedCities.includes(c) }]"
        @click="toggleHot(c)">{{ c }}</button>
    </div>

    <div class="city-advice" v-if="cityAdviceList.length">
      <div class="ca-title"><Icon name="calendar" :size="13" />城市推荐天数 <span class="hint">（含时间理由）</span></div>
      <div v-for="a in cityAdviceList" :key="a.name" class="ca-card" :class="{ off: a.seasonFit === 'off' }">
        <div class="ca-head">
          <span class="ca-name">{{ a.name }}</span>
          <span class="ca-days">推荐 {{ a.days }} 天</span>
          <span v-if="a.bestSeason" class="ca-season" :class="a.seasonFit === 'best' ? 'good' : 'warn'">{{ a.bestSeason }}</span>
        </div>
        <div class="ca-reason">{{ a.reason }}</div>
      </div>
    </div>

    <label class="lbl">兴趣偏好 <span class="hint">（可多选，用于筛选景点）</span></label>
    <div class="chip-row">
      <button v-for="(label, key) in INTEREST_LABEL" :key="key"
        :class="['chip', { active: interests.includes(key) }]"
        @click="toggleInterest(key)">
        {{ label }}
      </button>
    </div>

    <button class="btn btn-primary btn-gen" :disabled="loading" @click="generate">
      {{ loading ? '生成中…' : '生成景点清单' }}
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
          <span class="arrow" :class="{ open: showAdvanced === cp.name }"><Icon name="chevronDown" :size="14" /></span>
        </div>
      </div>
      <p class="city-desc">{{ cp.data.desc }}</p>

      <!-- 地点清单（按 景点/美食/购物 分类显示，点击展开附近特色美食） -->
      <div v-for="grp in groupByCategory(cp.attractions)" :key="grp.key" class="cat-sec">
        <div class="cat-head" :class="'cat-' + grp.key">
          <span class="cat-icon cat-ic"><Icon :name="{ sight: 'star', food: 'utensils', shop: 'bag' }[grp.key] || 'star'" :size="14" /></span>
          <span class="cat-name">{{ grp.label }}</span>
          <span class="cat-count">{{ grp.items.length }}</span>
        </div>
        <div class="attr-list">
          <div v-for="(a, i) in grp.items" :key="a.name" class="attr-item" :class="'cat-' + (a.category || 'sight')">
            <div class="attr-row" @click="toggleAttractionFood(cp, a)">
              <span class="attr-idx">{{ i + 1 }}</span>
              <span class="attr-must" v-if="a.category !== 'food' && a.category !== 'shop'">★{{ a.mustSee }}</span>
              <span class="attr-cat-icon cat-ic" v-else :title="CAT_META[a.category]?.label"><Icon :name="{ sight: 'star', food: 'utensils', shop: 'bag' }[a.category] || 'star'" :size="12" /></span>
              <span class="attr-name">{{ a.name }}<span v-if="a.tag" class="poi-badge tag">{{ a.tag }}</span><span v-else-if="a.poi" class="poi-badge">实时</span></span>
              <span class="attr-ticket">{{ a.ticket }}</span>
              <span class="attr-fold" :class="{ open: attrFood(cp,a)?.open }"><Icon name="chevronDown" :size="12" /></span>
              <span class="attr-nav" title="高德导航" @click.stop="openAmapNav(a.coord.lng, a.coord.lat, a.name)"><Icon name="navigation" :size="13" /></span>
            </div>

            <!-- 附近特色美食（点击后懒加载） -->
            <div v-if="attrFood(cp, a)?.open" class="attr-food">
              <div v-if="attrFood(cp, a).loading" class="food-loading-bar">
                正在搜索「{{ a.name }}」附近特色美食…
              </div>
              <div v-else-if="attrFood(cp, a).list.length" class="food-grid">
                <div v-for="(r, j) in attrFood(cp, a).list" :key="j" class="food-item restaurant-item">
                  <div class="rest-header">
                    <span class="food-name">{{ r.name }}</span>
                    <span v-if="r.rating" class="rest-rating">★ {{ r.rating }}</span>
                  </div>
                  <div class="rest-meta">
                    <span v-if="r.price" class="food-price">{{ r.price }}</span>
                    <span v-if="r.tag" class="rest-tag">{{ r.tag }}</span>
                  </div>
                  <div v-if="r.address" class="food-desc">{{ r.address }}</div>
                  <div v-if="r.distM != null" class="food-dist">{{ formatFoodDist(r) }}</div>
                </div>
              </div>
              <div v-else class="food-empty">附近暂未搜索到特色美食，换个点试试</div>
            </div>
          </div>
        </div>
      </div>

      <button class="btn btn-sm btn-supp" :disabled="suppLoading === cp.name" @click="doSupplement(cp.name)">
        <span style="display:inline-flex;align-items:center;gap:5px;justify-content:center"><Icon name="search" :size="12" />{{ suppLoading === cp.name ? '搜索中' + suppDots : '补充更多地点（景点/美食/购物）' }}</span>
      </button>

      <!-- 酒店搜索 -->
      <button class="btn btn-sm btn-hotel" :class="{ on: hotelOpen === cp.name }" @click="toggleHotel(cp.name)">
        <span style="display:inline-flex;align-items:center;gap:5px;justify-content:center"><Icon name="bed" :size="12" />按预算找附近住宿（酒店/民宿）</span>
      </button>
      <div v-if="hotelOpen === cp.name" class="hotel-panel">
        <div class="persona-sec">
          <div class="persona-title">个性化偏好 <span class="hint">多选，按匹配度推荐</span></div>
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
          >自定义</button>
        </div>
        <div v-if="hotelPreset[cp.name] === 'custom'" class="hotel-custom">
          <input v-model="hotelCustomMin[cp.name]" type="number" min="0" placeholder="最低 ¥" class="inp" />
          <span class="date-sep">~</span>
          <input v-model="hotelCustomMax[cp.name]" type="number" min="0" placeholder="最高 ¥" class="inp" />
        </div>
        <div class="hotel-attraction-sel">
          <select v-model="hotelAttraction[cp.name]" class="inp">
            <option value="">全部热门景点周边</option>
            <option v-for="a in cp.attractions" :key="a.name" :value="a.name">{{ a.name }}</option>
          </select>
        </div>
        <button class="btn btn-sm btn-hotel-search" :disabled="hotelState[cp.name]?.loading" @click="doSearchHotel(cp)">
          {{ hotelState[cp.name]?.loading ? '搜索中…' : '搜索住宿' }}
        </button>

        <div v-if="personas.length && hotelState[cp.name]?.searched" class="hotel-prefs">
          <span class="pref-label">你的偏好：</span>
          <span v-for="k in personas" :key="k" class="pref-chip">{{ personaLabel(k) }}</span>
          <span class="pref-note">（列表均为 100% 匹配，每条标注命中原因）</span>
        </div>

        <div v-if="hotelState[cp.name]?.loading" class="hotel-loading">
          {{ hotelState[cp.name]?.progress }}
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
              <span class="h-nav" title="高德导航" @click.stop="openHotelNav(h)"><Icon name="navigation" :size="13" /></span>
              <span class="h-arrow" :class="{ open: hotelExpand[cp.name] === i }"><Icon name="chevronDown" :size="12" /></span>
            </div>
            <div class="h-row2">
              <span class="h-price">{{ formatPrice(h) }}/晚</span>
              <span class="h-rating" :class="{ none: h.rating == null && !h.reputation, [h.reputation?.cls]: !!h.reputation }">{{ formatRating(h) }}</span>
              <span class="h-dist">距 {{ h.attraction }} {{ formatDist(h) }}</span>
            </div>
            <div v-if="h.tags?.length" class="h-tags">
              <span v-for="t in h.tags" :key="t" class="h-tag">{{ t }}</span>
              <span v-if="nearestMall(h)" class="h-mall">近{{ nearestMall(h).name }} {{ nearestMall(h).km.toFixed(1) }}km</span>
            </div>

            <div v-if="hotelExpand[cp.name] === i" class="transit-panel">
              <div class="transit-title"><Icon name="car" :size="13" />从本酒店到各景点 <span class="hint">（直线距离估算）</span></div>
              <div v-for="t in estimateTransit(h, cp.attractions)" :key="t.attraction" class="transit-row">
                <span class="tr-attr">{{ t.attraction }}</span>
                <span class="tr-dist">{{ t.km }}km</span>
                <span class="tr-mode" :class="'m-' + t.mode">{{ TRANSIT_LABEL[t.mode] }}</span>
                <span class="tr-time">{{ t.timeMin }}min</span>
                <span class="tr-fee">{{ t.fee }}</span>
              </div>
              <div class="transit-note">估算参考：步行 5km/h · 骑行 15km/h · 公交地铁 22km/h · 打车 30km/h，实际以导航为准</div>
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
          <div class="more-title"><Icon name="info" :size="13" />实用贴士</div>
          <ul class="tips-list">
            <li v-for="(t, i) in cp.data.tips" :key="i">{{ t }}</li>
          </ul>
        </div>
      </div>
    </div>

    <!-- 预算 -->
    <div class="card" v-if="plan.budget">
      <h2><Icon name="wallet" :size="15" />预算参考（人均）</h2>
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
      <h2><Icon name="share" :size="15" />攻略导出</h2>
      <div style="display:flex;gap:8px">
        <button class="btn btn-sm btn-secondary" style="flex:1" @click="copyGuide"><Icon name="copy" :size="12" /> 复制文本</button>
        <button class="btn btn-sm btn-secondary" style="flex:1" @click="downloadGuide"><Icon name="download" :size="12" /> 下载 .md</button>
      </div>
      <button class="btn btn-sm btn-share" style="margin-top:8px;width:100%" @click="openShareModal"><Icon name="image" :size="12" /> 生成分享长图（含精选酒店）</button>
    </div>

    <!-- 酒店选择弹窗（长图分享前） -->
    <div class="modal" v-if="shareModal" @click.self="shareModal = false">
      <div class="inner">
        <div style="display:flex;align-items:center;justify-content:space-between">
          <h3>选择一家住宿入图</h3>
          <button class="btn btn-sm" style="background:transparent;border-color:transparent" @click="shareModal=false"><Icon name="x" :size="14" /></button>
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
            <span class="sh-check" :class="{ on: shareHotel === h }"><Icon name="check" :size="12" /></span>
          </div>
        </div>
        <button class="btn btn-primary" style="margin-top:10px" :disabled="sharing || !shareHotel" @click="doShareGuide">
          <span style="display:inline-flex;align-items:center;gap:6px;justify-content:center"><Icon name="image" :size="14" />{{ sharing ? '生成中…' : '生成长图并分享' }}</span>
        </button>
      </div>
    </div>
  </template>
</div>
</template>

<style scoped>
.tip { font-size: 12px; color: var(--ink-400); margin-bottom: 14px; }
.lbl { display: block; font-size: 11px; font-weight: 600; color: var(--ink-600); margin: 14px 0 6px; letter-spacing: .3px; }
.hint { font-size: 10px; color: var(--ink-300); font-weight: 400; letter-spacing: 0; }
.inp { font-size: 13px; }
.chip-row { display: flex; gap: 4px; flex-wrap: wrap; }
.chip {
  border: 1px solid var(--line); background: var(--surface); border-radius: 8px; padding: 7px 12px; font-size: 11px; font-weight: 500;
  color: var(--ink-600); cursor: pointer; transition: all .15s; font-family: inherit;
}
.chip:hover { border-color: var(--line-strong); color: var(--ink-900); }
.chip.active { background: var(--ink-900); border-color: var(--ink-900); color: #fff; font-weight: 600; }
.city-sel { position: relative; }
.city-chips { display: flex; flex-direction: column; gap: 4px; margin-top: 6px; }
.city-chip {
  display: flex; align-items: center; gap: 6px; padding: 8px 10px; background: var(--surface-2);
  border: 1px solid var(--line); border-radius: 10px; font-size: 12px; transition: background .15s;
}
.cc-order { width: 22px; height: 22px; border-radius: 7px; background: var(--accent); color: #fff; font-size: 11px; font-weight: 600; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-variant-numeric: tabular-nums; }
.cc-name { flex: 1; font-weight: 600; color: var(--ink-900); }
.cc-btn { border: 1px solid var(--line); background: var(--surface); border-radius: 6px; width: 26px; height: 26px; cursor: pointer; color: var(--ink-400); transition: all .15s; display: flex; align-items: center; justify-content: center; }
.cc-btn:hover { border-color: var(--line-strong); color: var(--ink-900); }
.cc-btn:disabled { opacity: .3; }
.cc-del { background: #fef2f2; color: var(--err); border-color: #fecaca; }
.empty-tip { font-size: 12px; color: var(--ink-300); padding: 10px 0; }
.hot-cities { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 8px; }
.chip-sm {
  padding: 5px 12px; border-radius: 8px; border: 1px solid var(--line); background: var(--surface); color: var(--ink-600);
  font-size: 10px; font-weight: 500; cursor: pointer; font-family: inherit; transition: all .15s;
}
.chip-sm:hover { border-color: var(--line-strong); color: var(--ink-900); }
.chip-sm.on { background: var(--ink-900); border-color: var(--ink-900); color: #fff; font-weight: 600; }
.city-advice { margin-top: 12px; background: var(--surface-2); border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; }
.ca-title { font-size: 12px; font-weight: 600; color: var(--ink-700); margin-bottom: 8px; display: flex; align-items: center; gap: 5px; }
.ca-card { background: var(--surface); border: 1px solid var(--line); border-left: 3px solid var(--accent); border-radius: 8px; padding: 8px 10px; margin-bottom: 8px; }
.ca-card:last-child { margin-bottom: 0; }
.ca-card.off { border-left-color: #d97706; }
.ca-head { display: flex; align-items: center; gap: 8px; }
.ca-name { font-weight: 600; color: var(--ink-900); font-size: 13px; }
.ca-days { background: var(--surface-2); border: 1px solid var(--line); color: var(--ink-700); font-size: 10px; font-weight: 600; border-radius: 5px; padding: 2px 8px; font-variant-numeric: tabular-nums; }
.ca-season { font-size: 10px; font-weight: 600; border-radius: 5px; padding: 2px 8px; }
.ca-season.good { background: #eef6f2; color: #0d7a57; }
.ca-season.warn { background: #fdf3e3; color: #b45309; }
.ca-reason { font-size: 11px; color: var(--ink-400); margin-top: 5px; line-height: 1.5; }
.btn-gen { margin-top: 16px; }

/* 结果区 */
.city-head { display: flex; justify-content: space-between; align-items: center; cursor: pointer; }
.city-name { font-size: 17px; font-weight: 700; color: var(--ink-900); }
.city-count { background: var(--surface-2); border: 1px solid var(--line); color: var(--ink-600); font-size: 10px; font-weight: 600; border-radius: 5px; padding: 3px 9px; margin-left: 6px; font-variant-numeric: tabular-nums; }
.city-right { display: flex; align-items: center; gap: 8px; }
.city-weather { font-size: 11px; color: var(--ink-600); font-weight: 500; font-variant-numeric: tabular-nums; }
.arrow { transition: transform .2s; color: var(--ink-300); display: inline-flex; }
.arrow.open { transform: rotate(180deg); }
.city-desc { font-size: 11px; color: var(--ink-400); margin: 4px 0 10px; line-height: 1.6; }
.btn-supp { margin-top: 8px; background: var(--surface); color: var(--ink-700); }
.city-more { margin-top: 10px; border-top: 1px solid var(--line); padding-top: 10px; }
.more-sec { margin-bottom: 12px; }
.more-title { font-size: 12px; font-weight: 600; color: var(--ink-700); margin-bottom: 6px; display: flex; align-items: center; gap: 5px; }

/* 景点清单 */
.attr-list { display: flex; flex-direction: column; gap: 6px; margin-top: 4px; }

/* 分类区块（景点 / 美食 / 购物） */
.cat-sec { margin-top: 4px; }
.cat-head { display: flex; align-items: center; gap: 6px; margin: 12px 2px 7px; padding-bottom: 4px; border-bottom: 1px dashed var(--line-strong); }
.cat-head .cat-ic { display: inline-flex; color: var(--ink-400); }
.cat-name { font-size: 13px; font-weight: 700; }
.cat-count { font-size: 10px; background: var(--surface-2); border: 1px solid var(--line); color: var(--ink-600); border-radius: 5px; padding: 2px 8px; font-weight: 600; font-variant-numeric: tabular-nums; }
.cat-sight .cat-name { color: var(--ink-900); }
.cat-food .cat-name { color: #b45309; }
.cat-shop .cat-name { color: #1d4ed8; }
.attr-cat-icon { flex-shrink: 0; font-size: 13px; width: 24px; text-align: center; }
.attr-item { background: var(--surface); border: 1px solid var(--line); border-radius: 10px; overflow: hidden; }
.attr-item.cat-food { border-left: 3px solid #d97706; }
.attr-item.cat-shop { border-left: 3px solid #2563eb; }
.attr-item.cat-sight { border-left: 3px solid var(--accent); }
.attr-row {
  display: flex; align-items: center; gap: 8px; padding: 10px 12px; cursor: pointer; transition: background .12s; font-size: 12px;
}
.attr-row:hover { background: var(--surface-2); }
.attr-idx { width: 20px; height: 20px; border-radius: 5px; background: var(--surface-2); border: 1px solid var(--line); color: var(--ink-600); font-size: 10px; font-weight: 600; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-variant-numeric: tabular-nums; }
.attr-must { color: #b45309; font-weight: 600; font-size: 11px; width: 28px; flex-shrink: 0; font-variant-numeric: tabular-nums; }
.attr-name { flex: 1; font-weight: 500; color: var(--ink-900); display: flex; align-items: center; gap: 5px; }
.attr-ticket { font-size: 10px; color: var(--ink-300); flex-shrink: 0; }
.attr-fold { color: var(--ink-300); font-size: 11px; transition: transform .2s; flex-shrink: 0; display: inline-flex; }
.attr-fold.open { transform: rotate(180deg); }
.attr-nav { font-size: 13px; flex-shrink: 0; color: var(--ink-400); cursor: pointer; }
.attr-nav:hover { color: var(--accent); }
.poi-badge { font-size: 9px; background: var(--surface-2); border: 1px solid var(--line); color: var(--ink-600); border-radius: 4px; padding: 1px 5px; font-weight: 500; }
.poi-badge.tag { background: var(--accent-soft); color: var(--accent); border-color: transparent; }

/* 附近美食 */
.attr-food { background: var(--surface-2); border-top: 1px dashed var(--line-strong); padding: 10px 12px; }
.food-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.food-item { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 8px 10px; display: flex; flex-direction: column; }
.restaurant-item { padding: 10px 12px; gap: 3px; }
.rest-header { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
.rest-rating { font-size: 10px; color: #b45309; font-weight: 600; flex-shrink: 0; font-variant-numeric: tabular-nums; }
.rest-meta { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.rest-tag { font-size: 9px; background: var(--surface-2); border: 1px solid var(--line); color: var(--ink-600); border-radius: 4px; padding: 2px 6px; font-weight: 500; }
.food-empty { font-size: 12px; color: var(--ink-300); padding: 8px; text-align: center; }
.food-loading-bar { padding: 8px 4px; color: var(--ink-400); font-size: 12px; }
.food-name { font-size: 12px; font-weight: 600; color: var(--ink-900); }
.food-price { font-size: 10px; color: var(--ink-700); font-weight: 600; font-variant-numeric: tabular-nums; }
.food-desc { font-size: 10px; color: var(--ink-400); margin-top: 2px; }
.food-dist { font-size: 10px; color: var(--accent); font-weight: 600; margin-top: 2px; font-variant-numeric: tabular-nums; }

.tips-list { margin: 0; padding-left: 16px; font-size: 11px; color: var(--ink-600); line-height: 1.8; }

.budget-items { display: flex; flex-direction: column; }
.budget-item { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--line); font-size: 12px; }
.budget-item:last-child { border: none; }
.b-label { color: var(--ink-400); }
.b-value { font-weight: 600; color: var(--ink-900); font-variant-numeric: tabular-nums; }
.budget-total { text-align: center; margin-top: 12px; font-size: 13px; color: var(--ink-600); padding: 10px; background: var(--surface-2); border: 1px solid var(--line); border-radius: 10px; }
.budget-total strong { color: var(--ink-900); font-size: 16px; font-variant-numeric: tabular-nums; }

/* 酒店搜索 */
.btn-hotel { margin-top: 8px; background: var(--accent); color: #fff; border-color: var(--accent); }
.btn-hotel.on { background: var(--accent-hover); }
.hotel-panel { margin-top: 8px; background: var(--surface-2); border: 1px solid var(--line); border-radius: 10px; padding: 12px; }
.persona-sec { margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid var(--line); }
.persona-title { font-size: 12px; font-weight: 600; color: var(--ink-700); margin-bottom: 8px; }
.persona-group { margin-bottom: 6px; }
.persona-group-label { font-size: 10px; color: var(--ink-400); font-weight: 600; display: block; margin-bottom: 3px; letter-spacing: .3px; }
.persona-chips { display: flex; gap: 4px; flex-wrap: wrap; }
.persona-chips .chip-sm.on { background: var(--accent); border-color: var(--accent); color: #fff; }
.hotel-presets { display: flex; gap: 4px; flex-wrap: wrap; }
.hotel-presets .chip-sm.on { background: var(--accent); border-color: var(--accent); color: #fff; }
.hotel-custom { display: flex; gap: 6px; align-items: center; margin-top: 8px; }
.hotel-custom .inp { flex: 1; }
.hotel-attraction-sel { margin-top: 8px; }
.btn-hotel-search { margin-top: 8px; background: var(--accent); color: #fff; border-color: var(--accent); width: 100%; }
.hotel-prefs { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; margin-top: 8px; font-size: 11px; }
.hotel-prefs .pref-label { color: var(--ink-600); font-weight: 600; }
.hotel-prefs .pref-chip { background: var(--surface); border: 1px solid var(--line); color: var(--ink-700); border-radius: 999px; padding: 2px 8px; font-weight: 500; }
.hotel-prefs .pref-note { color: var(--ink-300); }
.hotel-loading { text-align: center; color: var(--ink-400); font-size: 12px; padding: 16px 0; }
.hotel-results { margin-top: 8px; }
.hotel-count { font-size: 11px; color: var(--ink-400); margin-bottom: 6px; }
.hotel-item {
  background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px;
  margin-bottom: 6px; cursor: pointer; transition: all .15s; box-shadow: 0 1px 2px rgba(22,24,29,.03);
}
.hotel-item:hover { border-color: var(--line-strong); }
.h-row1 { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.h-name { font-size: 13px; font-weight: 600; color: var(--ink-900); flex: 1; }
.h-match { font-size: 10px; font-weight: 600; border-radius: 5px; padding: 2px 8px; color: #fff; flex-shrink: 0; font-variant-numeric: tabular-nums; }
.h-match.high { background: #0d7a57; }
.h-match.mid { background: #d97706; }
.h-match.low { background: var(--ink-300); }
.h-kind { font-size: 10px; font-weight: 600; border-radius: 5px; padding: 2px 8px; flex-shrink: 0; border: 1px solid transparent; }
.h-kind.hotel { background: var(--surface-2); color: var(--ink-700); border-color: var(--line); }
.h-kind.bnb { background: #eef6f2; color: #0d7a57; border-color: #d3ecdd; }
.h-kind.inn { background: #fef6f3; color: #b45309; border-color: #f5dccd; }
.h-kind.hostel { background: #eff4fd; color: #1d4ed8; border-color: #d3e2fa; }
.h-kind.apt { background: #f4f1fb; color: #6d28d9; border-color: #e4dcf5; }
.h-kind.innn { background: var(--surface-2); color: var(--ink-600); border-color: var(--line); }
.h-kind.stay { background: var(--surface-2); color: var(--ink-600); border-color: var(--line); }
.h-badge { font-size: 9px; border-radius: 4px; padding: 1px 6px; font-weight: 600; }
.h-badge.good { background: #eef6f2; color: #0d7a57; }
.h-badge.ref { background: var(--surface-2); color: var(--ink-400); border: 1px solid var(--line); }
.h-row2 { display: flex; align-items: center; gap: 10px; margin-top: 4px; flex-wrap: wrap; }
.h-price { font-size: 13px; font-weight: 700; color: var(--ink-900); font-variant-numeric: tabular-nums; }
.h-rating { font-size: 11px; font-weight: 600; color: #b45309; font-variant-numeric: tabular-nums; }
.h-rating.none { color: var(--ink-300); font-weight: 400; }
.h-rating.premium { color: #6d28d9; }
.h-rating.chain { color: #0d7a57; }
.h-rating.bnb { color: #be4a73; }
.h-dist { font-size: 11px; color: var(--ink-400); margin-left: auto; font-variant-numeric: tabular-nums; }
.h-tags { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 5px; align-items: center; }
.h-tag { font-size: 9px; background: var(--surface-2); border: 1px solid var(--line); color: var(--ink-600); border-radius: 4px; padding: 2px 7px; font-weight: 500; }
.h-mall { font-size: 9px; color: var(--ink-300); margin-left: auto; }
.h-nav { font-size: 13px; cursor: pointer; padding: 0 2px; color: var(--ink-400); }
.h-nav:hover { color: var(--accent); }
.h-arrow { font-size: 10px; color: var(--ink-300); transition: transform .2s; display: inline-flex; }
.h-arrow.open { transform: rotate(180deg); }
.transit-panel { margin-top: 8px; border-top: 1px solid var(--line); padding-top: 8px; }
.transit-title { font-size: 11px; font-weight: 600; color: var(--ink-700); margin-bottom: 6px; display: flex; align-items: center; gap: 5px; }
.transit-row { display: flex; align-items: center; gap: 6px; padding: 5px 0; border-bottom: 1px solid var(--line); font-size: 11px; }
.transit-row:last-child { border-bottom: none; }
.tr-attr { flex: 1; color: var(--ink-700); font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tr-dist { color: var(--ink-300); font-size: 10px; width: 42px; text-align: right; font-variant-numeric: tabular-nums; }
.tr-mode { font-size: 10px; font-weight: 600; border-radius: 5px; padding: 2px 6px; width: 76px; text-align: center; }
.tr-mode.m-walk { background: #eef6f2; color: #0d7a57; }
.tr-mode.m-bike { background: #eff4fd; color: #1d4ed8; }
.tr-mode.m-transit { background: #fdf3e3; color: #b45309; }
.tr-mode.m-taxi { background: #fbeef3; color: #993556; }
.tr-time { color: var(--ink-400); width: 42px; text-align: right; font-size: 10px; font-variant-numeric: tabular-nums; }
.tr-fee { font-weight: 600; color: var(--ink-900); width: 56px; text-align: right; font-size: 11px; font-variant-numeric: tabular-nums; }
.transit-note { margin-top: 6px; font-size: 9px; color: var(--ink-300); line-height: 1.5; }
.hotel-empty { text-align: center; color: var(--ink-300); font-size: 12px; padding: 16px 8px; }
.btn-share { background: var(--ink-900); color: #fff; border-color: var(--ink-900); }
.share-hotel-list { max-height: 300px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; }
.share-hotel-item {
  display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-radius: 10px;
  border: 1px solid var(--line); background: var(--surface-2); cursor: pointer; transition: all .15s;
}
.share-hotel-item.on { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-tint); }
.sh-city { font-size: 10px; background: var(--surface); border: 1px solid var(--line); color: var(--ink-600); border-radius: 5px; padding: 2px 7px; font-weight: 600; flex-shrink: 0; }
.sh-main { flex: 1; min-width: 0; }
.sh-name { font-size: 13px; font-weight: 600; color: var(--ink-900); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sh-meta { font-size: 11px; color: var(--ink-400); margin-top: 2px; font-variant-numeric: tabular-nums; }
.sh-check { width: 22px; height: 22px; border-radius: 7px; border: 1.5px solid var(--line-strong); display: flex; align-items: center; justify-content: center; color: transparent; flex-shrink: 0; transition: all .15s; }
.sh-check.on { background: var(--accent); border-color: var(--accent); color: #fff; }
</style>

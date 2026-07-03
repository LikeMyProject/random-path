<script setup>
import { ref, computed } from 'vue'
import { loadAddresses } from '../composables/useStorage.js'
import { fetchBicyclingRoute } from '../composables/useAMap.js'
import { rateDifficulty } from '../composables/useScoring.js'
import { useSuggest } from '../composables/useAutoComplete.js'
import RouteThumbnail from '../components/RouteThumbnail.vue'

const toast = (m, t) => window.$toast?.(m, t)
const addresses = loadAddresses()
const { suggestions, showSuggest, searchAddress, pickSuggestion, closeSuggest } = useSuggest()

const PRESET_ROUTES = [
  { name:'西安·三河一山绿道',start:{name:'隆源国际城',lng:108.958,lat:34.379},end:{name:'隆源国际城',lng:108.958,lat:34.379},waypoints:[{name:'三河一山起点',lng:109.063,lat:34.314},{name:'灞渭驿',lng:109.010,lat:34.431},{name:'漕渭驿',lng:108.946,lat:34.403},{name:'沣河绿道',lng:108.747,lat:34.323},{name:'仪祉湖',lng:108.764,lat:34.106},{name:'沣峪口转盘',lng:108.822,lat:34.051},{name:'太乙驿',lng:109.015,lat:34.032},{name:'库峪河大桥',lng:109.172,lat:34.028},{name:'半坡驿',lng:109.044,lat:34.267}]},
  { name:'西安·骊山环山路',start:{name:'隆源国际城',lng:108.958,lat:34.379},end:{name:'隆源国际城',lng:108.958,lat:34.379},waypoints:[{name:'骊山索道大门',lng:109.210,lat:34.360},{name:'骊山牡丹门',lng:109.220,lat:34.350},{name:'藤原豆腐店',lng:109.240,lat:34.330},{name:'人祖庙',lng:109.250,lat:34.320},{name:'洪庆山',lng:109.180,lat:34.280}]},
  { name:'西安·城墙环线',start:{name:'永宁门',lng:108.948,lat:34.254},end:{name:'永宁门',lng:108.948,lat:34.254},waypoints:[{name:'长乐门',lng:108.970,lat:34.263},{name:'安远门',lng:108.948,lat:34.274},{name:'安定门',lng:108.926,lat:34.263}]},
  { name:'西安·曲江池盛唐文化线',start:{name:'大雁塔',lng:108.963,lat:34.217},end:{name:'寒窑',lng:108.993,lat:34.199},waypoints:[{name:'大唐芙蓉园',lng:108.977,lat:34.213},{name:'曲江池遗址公园',lng:108.985,lat:34.206}]},
  { name:'西安·秦岭分水岭',start:{name:'沣峪口',lng:108.830,lat:34.050},end:{name:'分水岭',lng:108.950,lat:33.880},waypoints:[{name:'净业寺',lng:108.850,lat:34.020},{name:'九龙潭',lng:108.870,lat:33.980},{name:'鸡窝子',lng:108.920,lat:33.920}]},
  { name:'西安·昆明池七夕公园',start:{name:'昆明池',lng:108.771,lat:34.233},end:{name:'昆明池',lng:108.771,lat:34.233},waypoints:[{name:'七夕公园',lng:108.780,lat:34.228},{name:'沐云亭',lng:108.786,lat:34.220}]},
  { name:'西安·顺城巷慢行',start:{name:'朱雀门',lng:108.938,lat:34.257},end:{name:'西南城角',lng:108.923,lat:34.260},waypoints:[{name:'勿幕门',lng:108.933,lat:34.257},{name:'含光门',lng:108.928,lat:34.257}]},
  { name:'西安·二环全环',start:{name:'辛家庙',lng:108.99,lat:34.31},end:{name:'辛家庙',lng:108.99,lat:34.31},waypoints:[{name:'石家街',lng:109.01,lat:34.27},{name:'太白立交',lng:108.92,lat:34.23},{name:'土门',lng:108.89,lat:34.26},{name:'未央立交',lng:108.95,lat:34.31}]},
  { name:'西安→咸阳（河堤路）',start:{name:'西安三桥',lng:108.820,lat:34.310},end:{name:'咸阳钟楼',lng:108.710,lat:34.336},waypoints:[{name:'沣河森林公园',lng:108.740,lat:34.290},{name:'咸阳渭河大桥',lng:108.710,lat:34.320}]},
  { name:'西安→临潼（骊山方向）',start:{name:'十里铺',lng:109.020,lat:34.287},end:{name:'华清池',lng:109.207,lat:34.364},waypoints:[{name:'灞桥',lng:109.059,lat:34.309}]},
  { name:'西安→蓝田（G312）',start:{name:'纺织城',lng:109.068,lat:34.261},end:{name:'水陆庵',lng:109.330,lat:34.135},waypoints:[{name:'白鹿原',lng:109.130,lat:34.220},{name:'蓝田县城',lng:109.317,lat:34.152}]},
  { name:'西安→阎良（航空城）',start:{name:'西安北站',lng:108.935,lat:34.377},end:{name:'阎良',lng:109.230,lat:34.656},waypoints:[{name:'高陵区',lng:109.082,lat:34.534}]},
  { name:'西安→铜川（G210）',start:{name:'张家堡',lng:108.948,lat:34.340},end:{name:'铜川',lng:109.075,lat:35.069},waypoints:[{name:'高陵区',lng:109.082,lat:34.534},{name:'三原县',lng:108.936,lat:34.617}]},
  { name:'西安→宝鸡（渭河南岸）',start:{name:'西安高新',lng:108.890,lat:34.198},end:{name:'宝鸡',lng:107.238,lat:34.363},waypoints:[{name:'周至县',lng:108.222,lat:34.163},{name:'眉县',lng:107.755,lat:34.274}]},
  { name:'秦岭·子午峪',start:{name:'子午镇',lng:108.87,lat:34.05},end:{name:'子午峪顶',lng:108.89,lat:33.97},waypoints:[{name:'金仙观',lng:108.87,lat:34.02},{name:'土地梁',lng:108.88,lat:33.99}]},
  { name:'秦岭·太平峪',start:{name:'太平口',lng:108.63,lat:34.02},end:{name:'彩虹瀑布',lng:108.61,lat:33.93},waypoints:[{name:'太平森林公园',lng:108.62,lat:33.97}]},
  { name:'秦岭·翠华山',start:{name:'太乙宫',lng:108.98,lat:34},end:{name:'翠华山天池',lng:109.01,lat:33.94},waypoints:[{name:'翠华山山门',lng:109,lat:33.97}]},
  { name:'西安·公园串烧北线',start:{name:'文景公园',lng:108.94,lat:34.33},end:{name:'桃花潭',lng:109.04,lat:34.33},waypoints:[{name:'城市运动公园',lng:108.94,lat:34.35},{name:'未央湖',lng:108.97,lat:34.39},{name:'浐灞湿地',lng:109.03,lat:34.395}]},
  { name:'西安·曲江→子午峪',start:{name:'曲江',lng:108.99,lat:34.2},end:{name:'子午镇',lng:108.87,lat:34.05},waypoints:[{name:'韦曲',lng:108.94,lat:34.16},{name:'子午大道',lng:108.9,lat:34.1}]},
  { name:'西安·北站→分水岭',start:{name:'西安北站',lng:108.935,lat:34.377},end:{name:'分水岭',lng:108.95,lat:33.88},waypoints:[{name:'朱宏路',lng:108.92,lat:34.29},{name:'子午大道',lng:108.9,lat:34.15},{name:'沣峪口',lng:108.83,lat:34.05}]},
]

const selectedKey = ref(''), customFilter = ref('')
const customStart = ref({ name: '', lng: '', lat: '' })
const waypoints = ref([])
const loading = ref(false), result = ref(null), resultShow = ref(false)

let st = null
function onStartInput() { clearTimeout(st); st = setTimeout(() => searchAddress(customStart.value.name), 200) }
function selectSugg(i) { const p = pickSuggestion(i); if (p) { customStart.value = { name: p.name, lng: p.lng, lat: p.lat }; toast('OK ' + p.name) } }
function pickStart(alias) { const a = addresses[alias]; if (!a) return; customStart.value = { name: a.name, lng: a.lng, lat: a.lat }; toast('OK ' + alias) }

function onPresetChange() {
  resultShow.value = false
  const route = PRESET_ROUTES.find(r => r.name === selectedKey.value)
  if (route) { waypoints.value = route.waypoints.map(p => ({ ...p })) }
  else { waypoints.value = [] }
}
function addWP() { waypoints.value.push({ name: '', lng: '', lat: '' }) }
function removeWP(i) { waypoints.value.splice(i, 1) }

const fullPath = computed(() => {
  const pts = []
  const route = PRESET_ROUTES.find(r => r.name === selectedKey.value)
  if (route) {
    if (customStart.value.name && customStart.value.lng) pts.push(customStart.value)
    else pts.push({ ...route.start })
    pts.push(...waypoints.value.filter(w => w.name && w.lng && w.lat))
    pts.push({ ...route.end })
  } else {
    if (customStart.value.name && customStart.value.lng) pts.push(customStart.value)
    pts.push(...waypoints.value.filter(w => w.name && w.lng && w.lat))
  }
  return pts
})

async function generate() {
  const pts = fullPath.value.map(w => ({ name: w.name, lng: parseFloat(w.lng), lat: parseFloat(w.lat) }))
  if (pts.length < 2) { toast('need 2+ points', 'warn'); return }
  loading.value = true; resultShow.value = false
  try {
    let td = 0, tt = 0; const segs = []
    for (let i = 0; i < pts.length - 1; i++) {
      const seg = await fetchBicyclingRoute(pts[i], pts[i + 1])
      td += seg.distance; tt += seg.duration
      segs.push({ ...seg, from: pts[i], to: pts[i + 1], idx: i })
      if (i < pts.length - 2) await new Promise(r => setTimeout(r, 300))
    }
    result.value = { waypoints: pts, segments: segs, totalDistance: td, totalDuration: tt, difficulty: rateDifficulty(td, 0) }
    resultShow.value = true
  } catch (e) { toast('err ' + e.message, 'err') }
  loading.value = false
}
</script>
<template>
<div>
<div class="card">
  <h2>Select Route</h2>
  <select v-model="selectedKey" @change="onPresetChange" style="font-size:13px"><option value="">-- Choose --</option><optgroup v-for="c in ['西安','秦岭','咸阳']" :key="c" :label="c"><option v-for="r in PRESET_ROUTES.filter(r=>r.name.startsWith(c+'·')||r.name.startsWith(c+'→'))" :key="r.name" :value="r.name">{{ r.name.replace(c+'·','').replace(c+'→','→') }}</option></optgroup></select>
  <input v-model="customFilter" placeholder="Search..." style="margin-top:8px;font-size:13px">
</div>
<div v-if="selectedKey" class="card" style="background:linear-gradient(135deg,#fff9fb,#faf7fc);border:1.5px dashed #ece0ec">
  <h2>Route Detail</h2>
  <div style="font-size:11px;color:#8a8098;line-height:1.8">
    <div>Start: <strong>{{ PRESET_ROUTES.find(r=>r.name===selectedKey)?.start?.name }}</strong></div>
    <div>End: <strong>{{ PRESET_ROUTES.find(r=>r.name===selectedKey)?.end?.name }}</strong></div>
    <div>Waypoints: <strong>{{ waypoints.length }}</strong></div>
  </div>
</div>
<div class="card">
  <h2>Custom Start <span style="font-size:11px;color:#a898b8;font-weight:400">(optional)</span></h2>
  <div class="addr-quick"><span>addr:</span><button v-for="(v,k) in addresses" :key="k" class="btn btn-sm" style="background:#334155;color:#e2e8f0;font-size:9px;margin:1px" @click="pickStart(k)">{{ k }}</button></div>
  <div class="row" style="position:relative">
    <input v-model="customStart.name" placeholder="name" style="flex:2;font-size:12px" @input="onStartInput" @focus="onStartInput" @blur="setTimeout(closeSuggest,200)">
    <input v-model.number="customStart.lng" type="number" step="0.000001" placeholder="lng" style="flex:1;font-size:12px">
    <input v-model.number="customStart.lat" type="number" step="0.000001" placeholder="lat" style="flex:1;font-size:12px">
    <div v-if="showSuggest" class="suggest-drop"><div v-for="(s,i) in suggestions" :key="i" class="suggest-item" @mousedown.prevent="selectSugg(i)"><span class="s-name">{{ s.name }}</span><span class="s-dist">{{ s.district }}</span></div></div>
  </div>
</div>
<div v-if="selectedKey" class="card">
  <h2>Waypoints ({{ waypoints.length }})</h2>
  <div v-for="(wp,i) in waypoints" :key="i" style="display:flex;gap:4px;align-items:center;padding:2px 0;border-bottom:1px dashed #ece0ec">
    <span style="color:#8cb8a8;font-size:10px;min-width:16px;font-weight:700">{{ i+1 }}</span>
    <input v-model="wp.name" placeholder="name" style="flex:2;font-size:11px;padding:5px">
    <input v-model.number="wp.lng" type="number" step="0.000001" placeholder="lng" style="flex:1;font-size:11px;padding:5px">
    <input v-model.number="wp.lat" type="number" step="0.000001" placeholder="lat" style="flex:1;font-size:11px;padding:5px">
    <button class="btn btn-sm" style="background:#ff5252;color:#fff;font-size:9px;padding:3px 5px;flex-shrink:0" @click="removeWP(i)">X</button>
  </div>
  <button class="btn btn-sm btn-secondary" style="display:block;margin:8px auto;font-size:11px" @click="addWP">+ Add</button>
</div>
<div v-if="fullPath.length>=2" class="card">
  <button class="btn btn-primary" :disabled="loading" @click="generate">{{ loading ? 'Loading...' : 'Generate Route' }}</button>
</div>
<div v-if="loading" class="loading-overlay card"><p style="text-align:center;color:#a898b8;font-size:13px">Loading route data...</p></div>
<div v-if="resultShow && result" class="card" style="animation:cardIn .4s cubic-bezier(.34,1.56,.64,1)">
  <div class="stats"><div class="stat"><div class="val">{{ (result.totalDistance/1000).toFixed(1) }}</div><div class="lbl">km</div></div><div class="stat"><div class="val">{{ Math.round(result.totalDuration/60) }}</div><div class="lbl">min</div></div><div class="stat"><div class="val" style="font-size:14px">{{ result.difficulty?.label }}</div><div class="lbl">level</div></div></div>
  <RouteThumbnail :segments="result.segments" :waypoints="result.waypoints" :home="result.waypoints[0]" :work="result.waypoints[result.waypoints.length-1]" />
  <p style="font-size:12px;color:#8a8098;margin:6px 0">{{ result.waypoints.map(w=>w.name).join(' -> ') }}</p>
  <button class="btn btn-primary" style="background:linear-gradient(135deg,#f0a870,#e89550)">Navigate</button>
</div>
</div>
</template>

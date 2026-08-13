import { parsePolyline, samplePoints } from '../utils/math.js'

export const AMAP_KEY = import.meta.env.VITE_AMAP_KEY || ''
const TIMEOUT = 10000
let sdkLoaded = false, sdkLoading = null
export function loadAMapSDK() {
  if (sdkLoaded) return Promise.resolve()
  if (sdkLoading) return sdkLoading
  sdkLoading = new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = `https://webapi.amap.com/maps?v=2.0&key=${AMAP_KEY}&plugin=AMap.Elevation,AMap.Geocoder,AMap.AutoComplete`
    s.onload = () => { sdkLoaded = true; resolve() }
    s.onerror = () => { sdkLoading = null; reject(new Error('SDK failed')) }
    document.head.appendChild(s)
  })
  return sdkLoading
}
async function fetchJSON(url, retries = 2) {
  for (let r = 0; r <= retries; r++) {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), TIMEOUT)
    try { const res = await fetch(url, { signal: ctrl.signal }); if (!res.ok) throw Error(`HTTP ${res.status}`); return await res.json() }
    catch (e) { if (r === retries) throw e; await new Promise(r => setTimeout(r, 1200)) }
    finally { clearTimeout(t) }
  }
}
const gcCache = new Map()
// 自动检测的当前城市，GPS 定位后设置
let detectedCity = ''
export function getDetectedCity() { return detectedCity }
export function setDetectedCity(c) { detectedCity = c || '' }
export async function detectCityFromGPS(lng, lat) {
  try {
    const url = `https://restapi.amap.com/v3/geocode/regeo?key=${AMAP_KEY}&location=${lng},${lat}&extensions=base`
    const d = await fetchJSON(url)
    if (d.status === '1' && d.regeocode?.addressComponent) {
      const ac = d.regeocode.addressComponent
      return ac.city || ac.province || ''
    }
  } catch(e) {}
  return ''
}
// ============================================================
// 城市真实餐厅搜索：多关键词搜索 + 去重 + 餐次分类
// ============================================================
const FOOD_GROUPS = [
  { meal: 'breakfast', kws: ['早餐', '包子', '粥店', '早茶', '肠粉', '豆浆'] },
  { meal: 'lunch', kws: ['面馆', '米粉', '快餐', '饺子', '中餐', '美食', '盖浇饭', '小炒'] },
  { meal: 'dinner', kws: ['火锅', '烧烤', '烤鱼', '川菜', '西餐', '日料', '粤菜', '家常菜'] },
  { meal: 'snack', kws: ['小吃', '甜品', '奶茶', '夜宵', '糕点'] },
]

export async function searchRestaurantsForCity(cityName, cityCoord, needed = 40) {
  const results = []
  const seen = new Set()
  // 每类餐次（早/午/晚）至少分到约 needed/3 家，避免短途搜索被「早餐」关键词占满导致午餐/晚餐为空
  const target = Math.max(3, Math.ceil(needed / 3))
  for (const g of FOOD_GROUPS) {
    if (results.length >= needed) break
    let groupCount = 0
    for (const kw of g.kws) {
      if (groupCount >= target || results.length >= needed) break
      try {
        let url = `https://restapi.amap.com/v5/place/text?key=${AMAP_KEY}` +
          `&keywords=${encodeURIComponent(kw)}` +
          `&city=${encodeURIComponent(cityName)}` +
          `&types=050000` +
          `&offset=25` +
          `&show_fields=rating,price,tag,address`
        const d = await fetchJSON(url)
        if (d.status === '1' && d.pois) {
          for (const p of d.pois) {
            const loc = (p.location || '').split(',')
            const lng = parseFloat(loc[0]), lat = parseFloat(loc[1])
            if (!lng || !lat) continue
            const key = p.name + '|' + (p.address || '')
            if (seen.has(key)) continue
            seen.add(key)
            results.push({
              name: p.name || '', address: p.address || '', rating: p.rating || '',
              price: p.price ? `¥${p.price}/人` : '', type: p.type || '', tag: p.tag || '',
              mealType: g.meal, coord: { lng, lat },
            })
            groupCount++
            if (groupCount >= target || results.length >= needed) break
          }
        }
      } catch (e) {}
      await new Promise(r => setTimeout(r, 200))
    }
  }
  return results
}

// ============================================================
// 城市本地小众地点搜索：本地人才知道的小地标、隐藏景点、老城角落
// ============================================================
const LOCAL_SPOT_QUERIES = [
  // 小众景点 & 秘境
  { kw: '小众景点', cat: 'hidden', label: '小众秘境' },
  { kw: '秘境', cat: 'hidden', label: '小众秘境' },
  { kw: '冷门景点', cat: 'hidden', label: '小众秘境' },
  { kw: '人少景美', cat: 'hidden', label: '小众秘境' },
  // 打卡拍照
  { kw: '打卡', cat: 'photo', label: '拍照打卡' },
  { kw: '网红', cat: 'photo', label: '拍照打卡' },
  { kw: '拍照', cat: 'photo', label: '拍照打卡' },
  // 老城 & 巷子
  { kw: '老城区', cat: 'oldtown', label: '老城韵味' },
  { kw: '老巷子', cat: 'oldtown', label: '老城韵味' },
  { kw: '胡同', cat: 'oldtown', label: '老城韵味' },
  { kw: '老街', cat: 'oldstreet', label: '老街漫步' },
  { kw: '古街', cat: 'oldstreet', label: '老街漫步' },
  { kw: '历史街区', cat: 'oldstreet', label: '老街漫步' },
  // 观景点
  { kw: '观景台', cat: 'viewpoint', label: '观景好去处' },
  { kw: '瞭望台', cat: 'viewpoint', label: '观景好去处' },
  { kw: '观景点', cat: 'viewpoint', label: '观景好去处' },
  // 艺术文化
  { kw: '艺术区', cat: 'art', label: '文艺空间' },
  { kw: '文创园', cat: 'art', label: '文艺空间' },
  { kw: '创意园', cat: 'art', label: '文艺空间' },
  { kw: '涂鸦', cat: 'art', label: '文艺空间' },
  { kw: '壁画', cat: 'art', label: '文艺空间' },
  { kw: '小众博物馆', cat: 'museum', label: '小众博物馆' },
  { kw: '民俗博物馆', cat: 'museum', label: '小众博物馆' },
  { kw: '美术馆', cat: 'gallery', label: '艺术空间' },
  { kw: '画廊', cat: 'gallery', label: '艺术空间' },
  // 本地生活
  { kw: '老茶馆', cat: 'localife', label: '本地生活' },
  { kw: '茶馆', cat: 'localife', label: '本地生活' },
  { kw: '独立书店', cat: 'bookstore', label: '书香角落' },
  { kw: '旧书店', cat: 'bookstore', label: '书香角落' },
  { kw: '创意市集', cat: 'market', label: '创意市集' },
  // 历史 & 古建
  { kw: '老建筑', cat: 'heritage', label: '历史建筑' },
  { kw: '历史建筑', cat: 'heritage', label: '历史建筑' },
  { kw: '古镇', cat: 'ancient', label: '古镇古村' },
  { kw: '古村', cat: 'ancient', label: '古镇古村' },
  { kw: '老字号', cat: 'heritage', label: '百年老店' },
  // 公园 & 休闲
  { kw: '社区公园', cat: 'park', label: '社区公园' },
  { kw: '街心花园', cat: 'park', label: '社区公园' },
  { kw: '滨江步道', cat: 'waterfront', label: '滨江步道' },
  { kw: '湖边', cat: 'waterfront', label: '滨水休闲' },
  // 寺庙
  { kw: '寺庙', cat: 'temple', label: '禅意时光' },
  { kw: '道观', cat: 'temple', label: '禅意时光' },
  // 夜市
  { kw: '夜市', cat: 'nightmarket', label: '夜市烟火' },
]

export async function searchLocalSpotsForCity(cityName, cityCoord, needed = 40) {
  const results = []
  const seen = new Set()
  // 过滤掉明显的噪声 POI
  const NOISE_RE = /收费站|服务区|停车场|公交站|地铁站$|配送点|快递|物流|驾校|汽修|洗车|维修|批发市场$|菜市场|农贸市场|商业广场$|购物广场$/
  for (const { kw, cat, label } of LOCAL_SPOT_QUERIES) {
    if (results.length >= needed) break
    try {
      let url = `https://restapi.amap.com/v5/place/text?key=${AMAP_KEY}` +
        `&keywords=${encodeURIComponent(kw)}` +
        `&city=${encodeURIComponent(cityName)}` +
        `&city_limit=true` +
        `&offset=25` +
        `&show_fields=tag,address`
      const d = await fetchJSON(url)
      if (d.status === '1' && d.pois) {
        for (const p of d.pois) {
          const loc = (p.location || '').split(',')
          const lng = parseFloat(loc[0]), lat = parseFloat(loc[1])
          if (!lng || !lat) continue
          const name = p.name || ''
          if (NOISE_RE.test(name)) continue
          const key = name + '|' + (p.address || '')
          if (seen.has(key)) continue
          seen.add(key)
          results.push({
            name, address: p.address || '', tag: p.tag || '',
            category: cat, label, coord: { lng, lat },
          })
          if (results.length >= needed) break
        }
      }
    } catch (e) {}
    await new Promise(r => setTimeout(r, 200))
  }
  return results
}

// 直线距离（km）：高德坐标为标准 WGS-84 偏移坐标，直线估算足够用于「附近多少米」展示
function haversineKm(a, b) {
  const toRad = x => x * Math.PI / 180
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 6371 * 2 * Math.asin(Math.sqrt(h))
}

// ============================================================
// 景点周边特色美食搜索：按坐标地理偏置（location + radius）
// 优化：关键词分批【并行】请求（去掉原串行 sleep），结果按距离由近到远排序，
//      并返回每个店距景点的直线距离 distKm/distM，用于「距此 Xm」展示
// ============================================================
async function fetchFoodByKw(kw, coord, radius) {
  try {
    const url = `https://restapi.amap.com/v5/place/text?key=${AMAP_KEY}` +
      `&keywords=${encodeURIComponent(kw)}` +
      `&location=${coord.lng},${coord.lat}` +
      `&radius=${radius}` +
      `&types=050000` +
      `&offset=25` +
      `&show_fields=rating,price,tag,address`
    const d = await fetchJSON(url)
    if (d.status !== '1' || !d.pois) return []
    return d.pois.map(p => {
      const loc = (p.location || '').split(',')
      const lng = parseFloat(loc[0]), lat = parseFloat(loc[1])
      if (!lng || !lat) return null
      return {
        name: p.name || '', address: p.address || '', rating: p.rating || '',
        price: p.price ? `¥${p.price}/人` : '', tag: p.tag || '',
        coord: { lng, lat },
      }
    }).filter(Boolean)
  } catch (e) { return [] }
}

export async function searchFoodNear(coord, { radius = 2500, limit = 10 } = {}) {
  if (!coord || !coord.lng || !coord.lat) return []
  // 关键词分批并行（每批内并行，批间串行，兼顾速度与不触发限流）
  const kwGroups = [
    ['特色美食', '老字号', '小吃', '本地菜'],
    ['餐厅', '火锅', '烧烤', '奶茶', '甜品'],
  ]
  const seen = new Set()
  const results = []
  for (const group of kwGroups) {
    if (results.length >= limit) break
    const batch = await Promise.all(group.map(kw => fetchFoodByKw(kw, coord, radius)))
    for (const pois of batch) {
      for (const r of pois) {
        if (results.length >= limit) break
        const key = r.name + '|' + r.address
        if (seen.has(key)) continue
        seen.add(key)
        const km = haversineKm(coord, r.coord)
        results.push({ ...r, distKm: km, distM: Math.round(km * 1000) })
      }
    }
  }
  // 最近的店排前面，体验更自然
  results.sort((a, b) => a.distKm - b.distKm)
  return results.slice(0, limit)
}

// ============================================================
// 城市景点扩充搜索：自动补充「沙滩/海岛/小众打卡/景区/公园/观景/主题乐园」等，
// 让景点清单更丰富（不再只有内置 8 个），用于生成时自动 enrich
// ============================================================
export const SPOT_CATS = [
  { kw: '海滩', label: '沙滩海滨', type: 'nature', mustSee: 3 },
  { kw: '沙滩', label: '沙滩海滨', type: 'nature', mustSee: 3 },
  { kw: '海岛', label: '海岛', type: 'nature', mustSee: 3 },
  { kw: '名胜', label: '名胜古迹', type: 'culture', mustSee: 3 },
  { kw: '古迹', label: '名胜古迹', type: 'culture', mustSee: 3 },
  { kw: '纪念馆', label: '纪念馆', type: 'culture', mustSee: 3 },
  { kw: '文创园', label: '文创园', type: 'urban', mustSee: 2 },
  { kw: '地标', label: '地标', type: 'culture', mustSee: 3 },
  { kw: '景点', label: '景区', type: 'culture', mustSee: 3 },
  { kw: '公园', label: '公园', type: 'nature', mustSee: 2 },
  { kw: '观景台', label: '观景', type: 'nature', mustSee: 2 },
  { kw: '主题乐园', label: '主题乐园', type: 'family', mustSee: 3 },
]

// 扩展关键词池：用于「手动点击补充更多景点」，与主类不同，能搜到夜市/古镇/博物馆/老街等
// 不同类别的真实地点，避免和生成时自动补充的主类重复（否则去重后永远加不进新东西）
export const SPOT_EXT = [
  { kw: '夜市', label: '夜市', type: 'urban', mustSee: 2 },
  { kw: '古镇', label: '古镇', type: 'culture', mustSee: 3 },
  { kw: '博物馆', label: '博物馆', type: 'culture', mustSee: 3 },
  { kw: '美术馆', label: '美术馆', type: 'culture', mustSee: 2 },
  { kw: '步行街', label: '步行街', type: 'urban', mustSee: 2 },
  { kw: '老街', label: '老街', type: 'urban', mustSee: 2 },
  { kw: '渔村', label: '渔村', type: 'nature', mustSee: 2 },
  { kw: '灯塔', label: '灯塔', type: 'nature', mustSee: 1 },
  { kw: '市集', label: '市集', type: 'urban', mustSee: 1 },
  { kw: '书店', label: '书店', type: 'urban', mustSee: 1 },
  { kw: '历史建筑', label: '历史建筑', type: 'culture', mustSee: 2 },
  { kw: '天台', label: '观景', type: 'nature', mustSee: 1 },
  { kw: '剧场', label: '剧场', type: 'family', mustSee: 1 },
]

// 经典必看池：动物园/植物园/主题乐园/海洋馆等「城市名片级」景点。
// 这些往往位于郊区甚至邻市行政边界外（如西安乐华城在泾阳、秦岭野生动物园在长安远郊），
// 必须用 cityLimit=false 的「按城市名区域偏置」宽松检索才能抓到，避免被 city_limit 截断。
// 同时按经典度优先排在 SPOT_CATS 之前，保证自动补充时优先进清单。
export const SPOT_CLASSIC = [
  { kw: '野生动物园', label: '动物园', type: 'family', mustSee: 4, cityLimit: false },
  { kw: '植物园', label: '植物园', type: 'nature', mustSee: 3, cityLimit: false },
  { kw: '海洋馆', label: '海洋馆', type: 'family', mustSee: 3, cityLimit: false },
  { kw: '欢乐世界', label: '主题乐园', type: 'family', mustSee: 4, cityLimit: false },
  { kw: '滑雪场', label: '滑雪', type: 'nature', mustSee: 2, cityLimit: false },
  { kw: '影视城', label: '影视城', type: 'culture', mustSee: 3, cityLimit: false },
  { kw: '温泉', label: '温泉', type: 'nature', mustSee: 2, cityLimit: false },
]

const SPOT_NOISE_RE = /收费站|服务区|停车场|公交站|地铁站$|配送点|快递|物流|驾校|汽修|菜市场|农贸市场|商业广场$|购物广场$|小区$|大厦$|酒店$|宾馆$|公寓$|售票处|游客中心|服务中心|咨询处|内广场|步行游览区|入口$|东门$|西门$|南门$|北门$|正门$|健身|训练馆|健身房|游泳馆|瑜伽|球馆|台球|网吧|KTV|酒吧|洗浴|按摩|美甲|美容|理发|洗车|烤肉|火锅|餐厅|饭店|餐饮|小吃|咖啡|奶茶|烘焙|烧烤|串串|面馆|饭馆|超市|便利店|药店|银行|营业厅|医院|学院|工厂|工业园|产业园|4S店|俱乐部|雪具店|体验店|专卖店|旗舰店/

async function fetchSpotsByKw(kw, cityName, label, type, mustSee, cityLimit = true) {
  try {
    const url = `https://restapi.amap.com/v5/place/text?key=${AMAP_KEY}` +
      `&keywords=${encodeURIComponent(kw)}` +
      `&region=${encodeURIComponent(cityName)}` +
      (cityLimit ? `&city_limit=true` : ``) +
      `&offset=25` +
      `&show_fields=tag,address`
    const d = await fetchJSON(url)
    if (d.status !== '1' || !d.pois) return []
    return d.pois.map(p => {
      const loc = (p.location || '').split(',')
      const lng = parseFloat(loc[0]), lat = parseFloat(loc[1])
      if (!lng || !lat) return null
      const name = p.name || ''
      if (SPOT_NOISE_RE.test(name)) return null
      return {
        name, address: p.address || '', tag: label, coord: { lng, lat },
        ticket: '—', duration: '2-3h', mustSee, type,
        desc: `${label}·实时搜索`, live: true, poi: true,
      }
    }).filter(Boolean)
  } catch (e) { return [] }
}

export async function searchSpotsForCity(cityName, cityCoord, needed = 30, cats = [...SPOT_CLASSIC, ...SPOT_CATS]) {
  const out = []
  const seen = new Set()
  // 分批并行（每批 5 个关键词），兼顾速度与不触发高德限流
  const batches = []
  for (let i = 0; i < cats.length; i += 5) batches.push(cats.slice(i, i + 5))
  for (const batch of batches) {
    if (out.length >= needed) break
    const res = await Promise.all(batch.map(c => fetchSpotsByKw(c.kw, cityName, c.label, c.type, c.mustSee, c.cityLimit)))
    for (const list of res) {
      for (const it of list) {
        if (out.length >= needed) break
        const key = it.name + '|' + it.address
        if (seen.has(key)) continue
        seen.add(key)
        out.push(it)
      }
    }
  }
  return out
}

export async function searchPOIsByText(keywords, city = '', limit = 5) {
  try {
    let url = `https://restapi.amap.com/v5/place/text?key=${AMAP_KEY}&keywords=${encodeURIComponent(keywords)}&offset=${limit}`
    if (city) url += `&region=${encodeURIComponent(city)}`
    const d = await fetchJSON(url)
    if (d.status === '1' && d.pois?.length > 0) return d.pois.map(p => { const [pl, pt] = p.location.split(',').map(parseFloat); return { lng: pl, lat: pt, name: p.name, type: p.type } })
  } catch (e) {}
  return []
}

export async function geocode(address, city = '') {
  const effectiveCity = city || detectedCity
  const cacheK = `${address}||${effectiveCity}`; if (gcCache.has(cacheK)) return gcCache.get(cacheK)
  const extractDetail = (input, apiName) => {
    if (!apiName) return input
    const idx = input.indexOf(apiName)
    return idx >= 0 ? input.slice(idx) : input
  }
  const doOneRound = async (useCity) => {
    return Promise.all([
      searchPOIsByText(address, useCity || '', 5).catch(() => []),
      (async () => {
        try {
          let url = `https://restapi.amap.com/v3/geocode/geo?key=${AMAP_KEY}&address=${encodeURIComponent(address)}`
          if (useCity) url += `&city=${encodeURIComponent(useCity)}`
          const d = await fetchJSON(url)
          if (d.status === '1' && d.geocodes?.length > 0) {
            const g = d.geocodes[0]; const [lng, lat] = g.location.split(',').map(parseFloat)
            return { lng, lat, name: g.formatted_address || '' }
          }
        } catch(e) {}
        return null
      })()
    ])
  }

  // 第一轮：优先用当前城市
  let [poiResults, geoResult] = await doOneRound(effectiveCity)

  // 当前城市没找到 → 放开城市限制再搜一轮
  if (effectiveCity && poiResults.length === 0 && !geoResult) {
    [poiResults, geoResult] = await doOneRound('')
  }

  if (poiResults.length > 0) {
    const best = poiResults[0]
    const r = { lng: best.lng, lat: best.lat, name: best.name }
    if (gcCache.size < 100) gcCache.set(cacheK, r); return r
  }

  if (geoResult) {
    const { lng, lat } = geoResult
    const apiName = geoResult.name
    const name = (address.length > apiName.length + 2) ? extractDetail(address, apiName) : (apiName || address)
    const r = { lng, lat, name }
    if (gcCache.size < 100) gcCache.set(cacheK, r); return r
  }

  return null
}
export async function reverseGeocode(lng, lat) {
  try {
    const url = `https://restapi.amap.com/v3/geocode/regeo?key=${AMAP_KEY}&location=${lng},${lat}&extensions=base`
    const d = await fetchJSON(url)
    if (d.status === '1' && d.regeocode) return d.regeocode.formatted_address || d.regeocode.addressComponent?.district || ''
  } catch (e) {}
  return ''
}
export async function searchPOIs(lng, lat, types, radius = 3000, limit = 10) {
  try {
    const url = `https://restapi.amap.com/v3/place/around?key=${AMAP_KEY}&location=${lng},${lat}&radius=${radius}&types=${encodeURIComponent(types)}&offset=${limit}`
    const d = await fetchJSON(url)
    if (d.status === '1' && d.pois?.length > 0) return d.pois.map(p => { const [pl, pt] = p.location.split(',').map(parseFloat); return { lng: pl, lat: pt, name: p.name, type: p.type } })
  } catch (e) {}
  return []
}

// 路线缓存：避免重试时对相似坐标重复请求
const routeCache = new Map()
const ROUTE_CACHE_MAX = 300
function routeCacheKey(o, d) {
  const r = 2000 // ~50m 精度，让相近坐标命中缓存
  return `${Math.round(o.lng * r) / r},${Math.round(o.lat * r) / r}|${Math.round(d.lng * r) / r},${Math.round(d.lat * r) / r}`
}
export async function fetchBicyclingPaths(origin, destination) {
  const key = routeCacheKey(origin, destination)
  if (routeCache.has(key)) return routeCache.get(key)
  const url = `https://restapi.amap.com/v5/direction/bicycling?origin=${origin.lng},${origin.lat}&destination=${destination.lng},${destination.lat}&key=${AMAP_KEY}&show_fields=polyline`
  const d = await fetchJSON(url)
  if (d.status !== '1') throw Error(d.info || 'API error')
  const paths = d.route?.paths || []
  if (paths.length === 0) throw Error('no route')
  const result = paths.map(p => ({
    distance: parseInt(p.distance), duration: parseInt(p.duration),
    polyline: p.steps?.map(s => s.polyline).filter(Boolean).join(';') || '',
    steps: (p.steps || []).map(s => ({ instruction: s.instruction, distance: parseInt(s.distance) })),
  }))
  if (routeCache.size >= ROUTE_CACHE_MAX) { const first = routeCache.keys().next().value; routeCache.delete(first) }
  routeCache.set(key, result)
  return result
}
export async function fetchBicyclingRoute(o, d) { return (await fetchBicyclingPaths(o, d))[0] }

// === 沿途搜索：沿路线 polyline 密集采样批量搜索 POI ===
export async function searchAlongRoute(segments, opts = {}) {
  const { onProgress = null, concurrency = 5 } = opts
  // 1. 合并所有 polyline 坐标点
  const allPts = []
  for (const seg of segments) {
    if (seg.polyline) allPts.push(...parsePolyline(seg.polyline))
  }
  if (allPts.length < 2) return []

  // 2. 每 500m 采一个点（最少5个，最多30个）
  const totalDist = segments.reduce((s, seg) => s + (seg.distance || 0), 0)
  const sampleCount = Math.max(5, Math.min(30, Math.ceil(totalDist / 500)))
  const samples = samplePoints(allPts, sampleCount)

  // 3. POI 分类配置
  const CATEGORIES = [
    { key: 'shop', label: '🛒 便利店', types: '010100|060000', radius: 500, limit: 3 },
    { key: 'food', label: '🍜 餐饮', types: '050000', radius: 500, limit: 3 },
    { key: 'wc', label: '🚻 公厕', types: '200300|200000', radius: 800, limit: 2 },
    { key: 'med', label: '💊 药店', types: '090000', radius: 800, limit: 2 },
  ]

  // 4. 并行批量搜索
  const allResults = []
  let done = 0
  const tasks = []
  for (const pt of samples) {
    for (const cat of CATEGORIES) {
      tasks.push({ pt, cat })
    }
  }

  // 分批并行执行
  const seen = new Set()
  for (let i = 0; i < tasks.length; i += concurrency) {
    const batch = tasks.slice(i, i + concurrency)
    const batchResults = await Promise.all(
      batch.map(async ({ pt, cat }) => {
        try {
          const pois = await searchPOIs(pt.lng, pt.lat, cat.types, cat.radius, cat.limit)
          return pois.map(p => ({ ...p, category: cat.key, catLabel: cat.label }))
        } catch(e) { return [] }
      })
    )
    for (const results of batchResults) {
      for (const poi of results) {
        const key = `${poi.name}|${poi.lng.toFixed(4)}|${poi.lat.toFixed(4)}`
        if (!seen.has(key)) { seen.add(key); allResults.push(poi) }
      }
    }
    done += batch.length
    onProgress?.({ done, total: tasks.length })
  }

  // 5. 按分类分组排序
  const order = { shop: 0, food: 1, wc: 2, med: 3 }
  allResults.sort((a, b) => (order[a.category] ?? 9) - (order[b.category] ?? 9))

  return allResults
}

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
async function fetchJSON(url, retries = 3) {
  for (let r = 0; r <= retries; r++) {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), TIMEOUT)
    try {
      const res = await fetch(url, { signal: ctrl.signal })
      if (!res.ok) throw Error(`HTTP ${res.status}`)
      const j = await res.json()
      // 高德超频：HTTP 200 但业务码 status!=='1' 且 info 含 QPS/限流，退避重试
      if (j.status !== '1') {
        if (/OVER_QPS|QPS|RATE|LIMIT/i.test(j.info || '') && r < retries) {
          await new Promise(r => setTimeout(r, 1500))
          continue
        }
        return j
      }
      return j
    }
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
  { kw: '湿地公园', label: '湿地公园', type: 'nature', mustSee: 3 },
  { kw: '遗址公园', label: '遗址公园', type: 'culture', mustSee: 3 },
  { kw: '湖', label: '湖泊', type: 'nature', mustSee: 3 },
  { kw: '世博园', label: '园林', type: 'nature', mustSee: 3 },
  { kw: '森林公园', label: '森林公园', type: 'nature', mustSee: 2 },
  { kw: '生态公园', label: '生态公园', type: 'nature', mustSee: 2 },
  { kw: '观景台', label: '观景', type: 'nature', mustSee: 2 },
  { kw: '主题乐园', label: '主题乐园', type: 'family', mustSee: 3 },
]

// 扩展关键词池：用于「手动点击补充更多景点」，与主类不同，能搜到古镇/博物馆/老街等
// 不同类别的真实地点，避免和生成时自动补充的主类重复（否则去重后永远加不进新东西）。
// 注意：不放「夜市」——夜市本质是吃的地方（酒吧/鸡尾酒馆常混入且名字不含"酒吧"二字躲过过滤），
// 逛吃信息在「点景点看附近美食」弹窗里本就有，放景点清单会污染"逛的景点"。
export const SPOT_EXT = [
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

// 美食分类池：夜市 / 美食街 / 小吃街 / 回民街 等「吃的地方」，单独归类（cat: 'food'），
// 与景点分开显示。注意：不进 SPOT_CATS（那是景点清单），避免夜市混进"逛的景点"。
// 区别 noise：美食搜索要保留 小吃/美食/夜市 等词，只用 NOISE_POI 挡掉酒吧/鸡尾酒等噪声。
export const SPOT_FOOD = [
  { kw: '夜市', label: '夜市', type: 'food', mustSee: 3, cat: 'food' },
  { kw: '美食街', label: '美食街', type: 'food', mustSee: 3, cat: 'food' },
  { kw: '小吃街', label: '小吃街', type: 'food', mustSee: 3, cat: 'food' },
  { kw: '美食城', label: '美食城', type: 'food', mustSee: 2, cat: 'food' },
  { kw: '回民街', label: '回民街', type: 'food', mustSee: 3, cat: 'food' },
  { kw: '夜市街', label: '夜市', type: 'food', mustSee: 2, cat: 'food' },
]

// 购物分类池：商场 / 购物中心 / 奥特莱斯 / 百货 等，单独归类（cat: 'shop'），与景点分开显示。
// 关键修复：泛关键词（商场/购物中心）只能匹配名字含"商场"的 POI，会漏掉大融城、万达广场、MOMOPARK 等
// 名字里没"商场"二字的商场。所以前几条改用高德类型编码检索（amapType：060100 商场 / 060800 购物中心 /
// 060700 商业街），能捞全市所有商场；再补一批全国连锁品牌关键词（万达/万象城/大悦城/龙湖天街/太古里/
// 恒隆/大融城/MOMOPARK/荟聚/印象城/凯德/吾悦/爱琴海/万象汇）兜底，保证这些具体商场必出现。
export const SPOT_SHOP = [
  // —— 第一批：用户点名/全国性主力商场关键词（排前面优先跑，且 searchSpotsForCity 会各自保底 1 条，
  //    避免被「万象城」等返回 10+ 子 POI 挤占配额而饿死；词间留间隔避免高德限流丢词）——
  { kw: '万达广场', label: '商场', type: 'shop', mustSee: 3, cat: 'shop' },
  { kw: '大融城', label: '商场', type: 'shop', mustSee: 3, cat: 'shop' },
  { kw: 'MOMOPARK', label: '商场', type: 'shop', mustSee: 3, cat: 'shop' },
  { kw: '万象城', label: '商场', type: 'shop', mustSee: 3, cat: 'shop' },
  { kw: '大悦城', label: '商场', type: 'shop', mustSee: 3, cat: 'shop' },
  { kw: '龙湖天街', label: '商场', type: 'shop', mustSee: 2, cat: 'shop' },
  { kw: '荟聚', label: '商场', type: 'shop', mustSee: 2, cat: 'shop' },
  { kw: '印象城', label: '商场', type: 'shop', mustSee: 2, cat: 'shop' },
  { kw: '凯德广场', label: '商场', type: 'shop', mustSee: 2, cat: 'shop' },
  { kw: '吾悦广场', label: '商场', type: 'shop', mustSee: 2, cat: 'shop' },
  { kw: '爱琴海', label: '商场', type: 'shop', mustSee: 2, cat: 'shop' },
  { kw: '万象汇', label: '商场', type: 'shop', mustSee: 2, cat: 'shop' },
  { kw: '奥特莱斯', label: '奥特莱斯', type: 'shop', mustSee: 2, cat: 'shop' },
  // —— 第二批：按高德类型编码（分开搜，覆盖更全）捞全市商场/购物中心/商业街兜底补全 ——
  // 注意：单一类型码组合(060100|060800)返回不全，且大融城/MOMOPARK 属 060100、万达属 060800，
  // 故 060100 / 060800 / 060700 分开检索，保证各类商场都兜到。
  { kw: '商场', label: '商场', type: 'shop', mustSee: 3, cat: 'shop', amapType: '060100' },
  { kw: '购物中心', label: '购物中心', type: 'shop', mustSee: 3, cat: 'shop', amapType: '060800' },
  { kw: '商业街', label: '商业街', type: 'shop', mustSee: 2, cat: 'shop', amapType: '060700' },
]

// 美食/购物类 POI 噪声过滤：只挡结构性噪声 + 酒吧/鸡尾酒（避免夜市混入酒吧），
// 保留 小吃/美食/夜市/商场/购物中心 等关键词，否则这些词会被景点噪声正则误杀。
const NOISE_POI = /收费站|服务区|停车场|公交站|地铁站$|配送点|快递|物流|驾校|汽修|洗车|维修|菜市场|农贸市场|酒店$|宾馆$|公寓$|客房$|度假村$|售票处|游客中心|服务中心|咨询处|内广场|入口$|东门$|西门$|南门$|北门$|正门$|健身|训练馆|健身房|游泳馆|瑜伽|球馆|台球|网吧|KTV|酒吧|洗浴|按摩|美甲|美容|理发|超市|便利店|药店|医院|诊所|学院|学校|中学|小学|工厂|工业园|产业园|4S店|俱乐部|鸡尾酒|夜店|酒馆|餐吧|精酿|livehouse|微醺|小酒馆|体验店|专卖店|旗舰店/

const SPOT_NOISE_RE = /收费站|服务区|停车场|公交站|地铁站$|配送点|快递|物流|驾校|汽修|菜市场|农贸市场|商业广场$|购物广场$|小区$|大厦$|酒店$|宾馆$|公寓$|售票处|游客中心|服务中心|咨询处|内广场|步行游览区|入口$|东门$|西门$|南门$|北门$|正门$|健身|训练馆|健身房|游泳馆|瑜伽|球馆|台球|网吧|KTV|酒吧|洗浴|按摩|美甲|美容|理发|洗车|烤肉|火锅|餐厅|饭店|餐饮|小吃|咖啡|奶茶|烘焙|烧烤|串串|面馆|饭馆|超市|便利店|药店|银行|营业厅|医院|学院|工厂|工业园|产业园|4S店|俱乐部|雪具店|体验店|专卖店|旗舰店|鸡尾酒|夜店|酒馆|餐吧|精酿|livehouse|微醺|小酒馆/

async function fetchSpotsByKw(kw, cityName, label, type, mustSee, cityLimit = true, category = 'sight', amapType = '') {
  try {
    let url = `https://restapi.amap.com/v5/place/text?key=${AMAP_KEY}`
    if (amapType) {
      // 按高德类型编码检索（商场 060100 / 购物中心 060800 / 商业街 060700），
      // 能捞到全市所有商场，不受"名称里是否含'商场'二字"限制（大融城/万达广场/MOMOPARK 等都靠这个）
      url += `&types=${encodeURIComponent(amapType)}`
    } else {
      url += `&keywords=${encodeURIComponent(kw)}`
    }
    url += `&region=${encodeURIComponent(cityName)}` +
      (cityLimit ? `&city_limit=true` : ``) +
      `&offset=25` +
      `&show_fields=tag,address`
    const d = await fetchJSON(url)
    if (d.status !== '1' || !d.pois) return []
    const noise = category === 'sight' ? SPOT_NOISE_RE : NOISE_POI
    return d.pois.map(p => {
      const loc = (p.location || '').split(',')
      const lng = parseFloat(loc[0]), lat = parseFloat(loc[1])
      if (!lng || !lat) return null
      const name = p.name || ''
      if (noise.test(name)) return null
      return {
        name, address: p.address || '', tag: label, coord: { lng, lat },
        ticket: '—', duration: '2-3h', mustSee, type: category === 'sight' ? type : (type || 'urban'),
        category, desc: `${label}·实时搜索`, live: true, poi: true,
      }
    }).filter(Boolean)
  } catch (e) { return [] }
}

// 分类分组：经典/景点/美食/购物 各自独立配额，避免被「总量封顶」饿死
const SPOT_GROUPS = {
  classic: SPOT_CLASSIC,
  sight: SPOT_CATS,
  food: SPOT_FOOD,
  shop: SPOT_SHOP,
}
// 把任意关键词数组按 cat 归组（用于手动补充：SPOT_EXT 归 sight，FOOD/SHOP 各自归位）
function groupCatsByType(cats) {
  const g = {}
  for (const c of cats) {
    const cat = c.cat || 'sight'
    ;(g[cat] = g[cat] || []).push(c)
  }
  return g
}

// 每个分类独立配额检索：classic/sight 景点为主，food/shop 也各给足量名额，
// 不再用单一总量上限（否则 classic+sight 一轮填满后 food/shop 永远搜不到）。
export async function searchSpotsForCity(cityName, cityCoord, opts = {}) {
  const { targets = { classic: 8, sight: 18, food: 14, shop: 30 }, cats = null } = opts
  const groups = cats ? groupCatsByType(cats) : SPOT_GROUPS
  const out = []
  const seen = new Set()
  const add = (it, cat) => {
    const key = it.name + '|' + it.address
    if (seen.has(key)) return false
    seen.add(key)
    out.push(it)
    return true
  }
  const catCount = cat => out.filter(o => o.category === cat).length
  for (const [cat, pool] of Object.entries(groups)) {
    const target = targets[cat] ?? 8
    if (target <= 0) continue

    // —— 购物特殊逻辑：品牌关键词各自保底 1 条 + 类型码检索补满本地商场 ——
    // 两个坑都要避：①「万象城」一个词返回 10+ 子 POI，若和普通词同批跑会被配额饿死后面的品牌
    //   （大融城/MOMOPARK 因此搜不到）→ 故品牌词各自保底、且排前面优先跑；
    //  ②品牌词只占 1 条/家，把名额留给类型码检索，否则赛格/熙地港等本地商场因配额满而无机会；
    //  ③词间留 250ms 间隔，避免高德免费 Key QPS 限流把品牌词整批丢词。
    if (cat === 'shop') {
      const brands = pool.filter(c => !c.amapType)
      const typed = pool.filter(c => c.amapType)
      let n = 0
      for (const c of brands) {
        const list = await fetchSpotsByKw(c.kw, cityName, c.label, c.type, c.mustSee, c.cityLimit, c.cat || cat, c.amapType)
        let added = 0
        for (const it of list) {
          if (added >= 1) break          // 每家品牌保底 1 条，省出名额给本地商场
          if (add(it, cat)) { added++; n++ }
        }
        await new Promise(r => setTimeout(r, 250))  // 防限流
      }
      // 类型码分开检索（060100 商场 / 060800 购物中心 / 060700 商业街），补满到 target，
      // 专门捞品牌词覆盖不到的本地商场（赛格/熙地港等）
      for (const c of typed) {
        if (catCount(cat) >= target) break
        const list = await fetchSpotsByKw(c.kw, cityName, c.label, c.type, c.mustSee, c.cityLimit, c.cat || cat, c.amapType)
        for (const it of list) { if (catCount(cat) >= target) break; add(it, cat) }
        await new Promise(r => setTimeout(r, 200))
      }
      continue
    }

    // 其他分类：原逻辑（分批并行，每批 5 个关键词）
    const batches = []
    for (let i = 0; i < pool.length; i += 5) batches.push(pool.slice(i, i + 5))
    for (const batch of batches) {
      if (catCount(cat) >= target) break
      const res = await Promise.all(batch.map(c => fetchSpotsByKw(c.kw, cityName, c.label, c.type, c.mustSee, c.cityLimit, c.cat || cat, c.amapType)))
      for (const list of res) {
        for (const it of list) {
          if (catCount(cat) >= target) break
          add(it, cat)
        }
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

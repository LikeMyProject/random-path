import { ref } from 'vue'
import { reverseGeocode, searchAlongRoute, searchPOIs } from './useAMap.js'
import { parsePolyline, samplePoints } from '../utils/math.js'

// 逆地理编码缓存
const geoCache = new Map()
const GEO_CACHE_MAX = 200

function cacheKey(lng, lat) {
  // ~100m 精度，让相近坐标命中缓存
  const r = 1000
  return `${Math.round(lng * r) / r},${Math.round(lat * r) / r}`
}

/**
 * 从路线 segments 提取沿途上下文：
 * - 村庄/城镇/居民点名称
 * - 补给点（便利店/餐饮/公厕/药店）
 * - 途经地段分类
 */
export function useRouteContext() {
  const villages = ref([])
  const supplyPoints = ref([])
  const loading = ref(false)
  const progress = ref('')

  /**
   * 沿路线采样并逆地理编码，识别沿途地名
   */
  async function identifyVillages(segments, waypoints = []) {
    // 合并所有 polyline 坐标
    const allPts = []
    for (const seg of (segments || [])) {
      if (seg.polyline) allPts.push(...parsePolyline(seg.polyline))
    }
    if (allPts.length < 2) return []

    // 每 ~800m 采一个点（最少 4 个，最多 20 个）
    const totalDist = (segments || []).reduce((s, seg) => s + (seg.distance || 0), 0)
    const sampleCount = Math.max(4, Math.min(20, Math.ceil(totalDist / 800)))
    const samples = samplePoints(allPts, sampleCount)

    // 去重（相近坐标用缓存键）
    const uniqueSamples = []
    const seen = new Set()
    for (const pt of samples) {
      const k = cacheKey(pt.lng, pt.lat)
      if (!seen.has(k)) { seen.add(k); uniqueSamples.push(pt) }
    }

    // 批量逆地理编码（控制并发，间隔 300ms 防限流）
    const results = []
    for (let i = 0; i < uniqueSamples.length; i++) {
      const pt = uniqueSamples[i]
      const ck = cacheKey(pt.lng, pt.lat)

      if (geoCache.has(ck)) {
        const cached = geoCache.get(ck)
        if (cached) results.push(cached)
      } else {
        try {
          const addr = await reverseGeocode(pt.lng, pt.lat)
          if (addr && addr.length > 1) {
            const entry = { lng: pt.lng, lat: pt.lat, name: addr, type: classifyAddress(addr) }
            results.push(entry)
            if (geoCache.size < GEO_CACHE_MAX) geoCache.set(ck, entry)
          } else {
            if (geoCache.size < GEO_CACHE_MAX) geoCache.set(ck, null)
          }
        } catch (e) {
          // 限流静默跳过
        }
      }

      progress.value = `识别沿途地名 ${i + 1}/${uniqueSamples.length}`
      // 每 3 个请求休息 300ms
      if (i % 3 === 2 && i < uniqueSamples.length - 1) {
        await new Promise(r => setTimeout(r, 300))
      }
    }

    // 过滤并去重显示名
    const seenNames = new Set()
    const filtered = results.filter(r => {
      if (!r || !r.name || seenNames.has(r.name)) return false
      seenNames.add(r.name)
      return r.type !== 'unknown'
    })

    villages.value = filtered
    return filtered
  }

  /**
   * 搜索沿途补给点
   */
  async function findSupplyPoints(segments) {
    if (!segments || segments.length === 0) {
      supplyPoints.value = []
      return []
    }

    loading.value = true
    try {
      const results = await searchAlongRoute(segments, {
        concurrency: 5,
        onProgress: ({ done, total }) => {
          progress.value = `搜索补给点 ${done}/${total}`
        },
      })
      supplyPoints.value = results
      return results
    } catch (e) {
      supplyPoints.value = []
      return []
    } finally {
      loading.value = false
    }
  }

  /**
   * 一键获取全部沿途上下文
   */
  async function loadContext(segments, waypoints) {
    loading.value = true
    try {
      const [v, s] = await Promise.all([
        identifyVillages(segments, waypoints),
        findSupplyPoints(segments),
      ])
      return { villages: v, supplyPoints: s }
    } finally {
      loading.value = false
    }
  }

  return {
    villages,
    supplyPoints,
    loading,
    progress,
    identifyVillages,
    findSupplyPoints,
    loadContext,
  }
}

/**
 * 根据地址文本分类地段类型
 */
function classifyAddress(addr) {
  if (!addr) return 'unknown'

  // 村庄/乡镇特征
  const villagePatterns = /[村镇乡屯堡寨沟]$/
  const townPatterns = /[镇街道]$/
  const communityPatterns = /[社区村组]$/
  const cityPatterns = /[市县区]$/

  // 特殊地点类型
  const parkPatterns = /公园|景区|风景|名胜|植物园|动物园|游乐园/
  const riverPatterns = /[江河湖海泊川溪渠]/
  const mountainPatterns = /[山岭峰岗丘坡崖壁]/
  const roadPatterns = /[路街巷大道公路高速国省道环线]/

  if (parkPatterns.test(addr)) return 'park'
  if (mountainPatterns.test(addr)) return 'mountain'
  if (riverPatterns.test(addr)) return 'water'
  if (villagePatterns.test(addr)) return 'village'
  if (townPatterns.test(addr)) return 'town'
  if (communityPatterns.test(addr)) return 'community'
  if (cityPatterns.test(addr)) return 'city'
  if (roadPatterns.test(addr)) return 'road'

  return 'unknown'
}

/**
 * 获取地段类型的 icon
 */
export function getContextIcon(type) {
  const icons = {
    village: '🏘',
    town: '🏙',
    community: '🏠',
    city: '🌆',
    park: '🌲',
    water: '💧',
    mountain: '⛰',
    road: '🛣',
    unknown: '📍',
  }
  return icons[type] || '📍'
}

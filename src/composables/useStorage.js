import { reactive } from 'vue'
const AK = 'radompath_addresses_v4', HK = 'radompath_history', MH = 20
const DEFAULT_ADDRESSES = {}

export function loadAddresses() {
  try {
    const r = localStorage.getItem(AK)
    if (r) {
      const parsed = JSON.parse(r)
      // 验证数据完整性：必须是对象，不能是数组或空
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        return reactive(parsed)
      }
    }
  } catch (e) {
    console.warn('地址簿数据损坏，已重置', e)
  }
  // 只在数据确实损坏时才重置，正常空地址簿就保持空
  localStorage.setItem(AK, JSON.stringify(DEFAULT_ADDRESSES))
  return reactive({ ...DEFAULT_ADDRESSES })
}

export function saveAddresses(a) {
  // 确保保存的是普通对象而非 reactive 代理
  const plain = {}
  for (const [k, v] of Object.entries(a)) {
    plain[k] = { name: v.name, lng: v.lng, lat: v.lat }
  }
  localStorage.setItem(AK, JSON.stringify(plain))
}

export function deleteAddress(alias) {
  const addresses = loadAddresses()
  if (addresses[alias]) {
    delete addresses[alias]
    saveAddresses(addresses)
    return true
  }
  return false
}

export function loadHistory() { try { return JSON.parse(localStorage.getItem(HK)) || [] } catch (e) { return [] } }
export function saveHistory(e) { const h = loadHistory(); h.unshift({ ...e, date: new Date().toISOString() }); if (h.length > MH) h.length = MH; localStorage.setItem(HK, JSON.stringify(h)) }
export function getRecentSectors(n = 5) { return loadHistory().slice(0, n).map(h => h.sector).filter(s => s !== undefined) }

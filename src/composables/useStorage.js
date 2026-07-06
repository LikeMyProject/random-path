import { reactive } from 'vue'
const AK = 'radompath_addresses_v3', HK = 'radompath_history', MH = 20
const D = {}
export function loadAddresses() { try { const r = localStorage.getItem(AK); if (r) return reactive(JSON.parse(r)) } catch (e) {} localStorage.setItem(AK, JSON.stringify(D)); return reactive({ ...D }) }
export function saveAddresses(a) { localStorage.setItem(AK, JSON.stringify(a)) }
export function loadHistory() { try { return JSON.parse(localStorage.getItem(HK)) || [] } catch (e) { return [] } }
export function saveHistory(e) { const h = loadHistory(); h.unshift({ ...e, date: new Date().toISOString() }); if (h.length > MH) h.length = MH; localStorage.setItem(HK, JSON.stringify(h)) }
export function getRecentSectors(n = 5) { return loadHistory().slice(0, n).map(h => h.sector).filter(s => s !== undefined) }

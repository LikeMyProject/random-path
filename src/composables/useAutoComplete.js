import { ref } from 'vue'
import { loadAMapSDK } from './useAMap.js'
const suggestions = ref([]), showSuggest = ref(false)
let ac = null, ip = null
async function init() { if (ip) return ip; ip = loadAMapSDK().then(() => { window.AMap.plugin('AMap.AutoComplete', () => { ac = new window.AMap.AutoComplete({ city: '西安', citylimit: true }) }) }).catch(() => { ip = null }); return ip }
export async function searchAddress(kw) { if (!kw || kw.length < 1) { suggestions.value = []; showSuggest.value = false; return }; await init(); if (!ac) return; ac.search(kw, (s, r) => { if (s === 'complete' && r.tips) { suggestions.value = r.tips.filter(t => t.location && t.location.lng && t.name).map(t => ({ name: t.name, district: t.district || '', lng: t.location.lng, lat: t.location.lat })); showSuggest.value = suggestions.value.length > 0 } else { suggestions.value = []; showSuggest.value = false } }) }
export function pickSuggestion(i) { const p = suggestions.value[i]; suggestions.value = []; showSuggest.value = false; return p || null }
export function closeSuggest() { suggestions.value = []; showSuggest.value = false }
export function useSuggest() { return { suggestions, showSuggest, searchAddress, pickSuggestion, closeSuggest } }

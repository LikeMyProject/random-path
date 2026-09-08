// src/composables/useSmartDice.js —— 聪明骰子编排器（浏览器侧）
// 职责：信封选池 → 锚点廊道 → 随机链装配 → 高德门到门补路 → 实测里程带筛选 → 折返闸门 → 必经坡度。
// 浏览器模块：依赖高德 REST 与 Open-Meteo，不可被 node --test 直接 import（纯逻辑已下沉到
// corridorData / corridorSearch，那两个模块可离线单测）。
import { CORRIDORS } from '../data/corridors.js'
import { PLAYPOOLS } from '../data/playpools.js'
import { indexCorridors, filterEnvelope } from './corridorData.js'
import { randomChain, reversePolyline, planChainPath, rankAnchors } from './corridorSearch.js'
import { fetchBicyclingRoute } from './useAMap.js'
import { calcSlopeProfile, checkBacktrack } from './useRouteEngine.js'

const MAX_ATTEMPTS = 10   // 最多尝试次数（每次约 ids+2 次规划调用）
const ANCHOR_TRIES = 4    // 前 N 次尝试各换一个锚点（锚点选择见 corridorSearch.rankAnchors）
const MAX_ACCESS_KM = 18  // 家→首廊道 直线上限
const MAX_RETURN_KM = 30  // 环形回程「末廊道→家」直线上限，超出判定为需折返
const SNAP_KM = 0.05      // 起点已落在廊道端点上时不再补引道

export function useSmartDice() {
  const ix = indexCorridors(CORRIDORS)
  const toKm = (a, b) => Math.hypot((a.lng - b.lng) * 97, (a.lat - b.lat) * 111)

  function chooseEnvelope({ pool = null, band = 'any', minTrust = 'yellow' } = {}) {
    const pools = pool ? [pool] : PLAYPOOLS.filter(p => p.region.includes('关中')).map(p => p.id)
    return filterEnvelope(CORRIDORS, { pools, minTrust, band })
  }

  async function genRoute(home, env, byId, { distKm, shape, anchor, onDebug = null }) {
    const dbg = m => onDebug?.(m)
    const dMinM = distKm * 1000 * 0.88, dMaxM = distKm * 1000 * 1.12
    const wps = []
    // 1) 引道：home→锚点入口（home 不在廊道端点上时补一段）
    const anchorEntry = toKm(home, anchor.c.start) <= toKm(home, anchor.c.end) ? anchor.c.start : anchor.c.end
    const accessLin = toKm(home, anchorEntry)
    let access = null
    if (accessLin > SNAP_KM) {
      access = await fetchBicyclingRoute(home, anchorEntry).catch(() => null)
      if (!access) { dbg('引道规划失败'); return null }
    }

    // 2) 正向串廊道：逐段按「近端进、另一端出」决定行进方向。
    //    链的目标里程按「让往返闭合总程落进里程带」反推。
    //    引道预算优先用「真实引道已量出的里程」（access.distance，绕路已含其中），
    //    只有 SNAP 内(没打真实引道)才退化用直线×保守系数 1.8 —— 否则 1.35 低估真实绕路、
    //    短引道实测可绕到 2.2 倍，chainTarget 系统性偏低、总程必超带（2026-09-08 校准）。
    //      往返(outback) total = 2×(链实际 + 引道实际)  → 链目标 = (dMin+dMax)/4 − 引道实际
    //      环线(loop)    total = 链实际 + 引道 + 回程(≈引道) → 链目标 = (dMin+dMax)/2 − 2×引道实际
    //    不给目标会盲串满 maxDepth、真实里程必然超带（历史阻断 bug）；target 太紧又会
    //    单段就停、凑不出小段链（2026-09-08 新修）。
    const dMin = distKm * 0.88, dMax = distKm * 1.12
    const accessRealKm = access ? access.distance / 1000 : accessLin * 1.8
    const chainTarget = Math.max(2.5, shape === 'loop' ? (dMin + dMax) / 2 - accessRealKm * 2 : (dMin + dMax) / 4 - accessRealKm)
    const outIds = randomChain(env, {
      startId: anchor.c.id, maxDepth: 5, maxBridgeKm: 15,
      targetKm: chainTarget,
    })
    const path = planChainPath(byId, outIds, anchorEntry)
    if (path.length === 0) { dbg('随机链为空'); return null }
    const fwdSegs = []
    let cur = anchorEntry
    for (const step of path) {
      const s = await fetchBicyclingRoute(cur, step.exit).catch(() => null)
      if (!s) { dbg(`廊道 ${step.id} 规划失败`); return null }
      fwdSegs.push({ ...s, from: cur, to: step.exit, corridorId: step.id, reversed: step.reversed })
      wps.push({ lng: step.exit.lng, lat: step.exit.lat, poiName: step.exit.name, _corridorId: step.id })
      cur = step.exit
    }
    // 折返闸门只查去程：outback（往返）形状的回程段在设计上就是原路折返，
    // 若拿整条路线去判 checkBacktrack，会把所有 outback 候选（如南山峪口爬坡）全部误杀成空结果。
    if (checkBacktrack(fwdSegs).bad) { dbg(`去程折返闸门拦截`); return null }

    const segs = []
    if (access) segs.push({ ...access, from: home, to: anchorEntry, leg: 'access' })
    segs.push(...fwdSegs)

    // 3) 回程闭环：环线且末点离 home 近 → 直接回；否则原廊道原路折返（polyline 倒序，省一半请求）
    const canLoop = toKm(cur, home) <= MAX_RETURN_KM
    if (shape === 'loop' && canLoop) {
      const back = await fetchBicyclingRoute(cur, home).catch(() => null)
      if (!back) { dbg(`回程规划失败`); return null }
      segs.push({ ...back, from: cur, to: home, leg: 'back' })
    } else {
      for (const s of [...fwdSegs].reverse()) {
        segs.push({ ...s, polyline: reversePolyline(s.polyline), from: s.to, to: s.from, leg: 'back' })
      }
      if (access) {
        segs.push({ ...access, polyline: reversePolyline(access.polyline), from: anchorEntry, to: home, leg: 'back-access' })
      }
    }
    const total = segs.reduce((s, x) => s + (x.distance || 0), 0)
    if (total < dMinM || total > dMaxM) { dbg(`里程出带: ${(total/1000).toFixed(1)}km 不在 [${(dMinM/1000).toFixed(1)}, ${(dMaxM/1000).toFixed(1)}]`); return null }
    return {
      segments: segs,
      waypoints: wps,
      totalDistance: total,
      totalDuration: segs.reduce((s, x) => s + (x.duration || 0), 0),
      corridorIds: path.map(p => p.id),
      shape: shape === 'loop' && canLoop ? 'loop' : 'outback',
    }
  }

  // 一次出 N 条候选；每颗种子随机链 → 实测补路 → 过里程带与折返闸门 → 必经坡度
  async function generate(home, { distKm, band = 'any', pool = null, minTrust = 'yellow', count = 3, locked = [], onDebug = null } = {}) {
    const out = await generateAt(minTrust)
    // 柔和降级：玩法池模式门槛为 green，而池内「实骑/精校」段太少（南山池仅 3 段，凑不出
    // 20-30km）时直接走经典兜底太浪费——降一级到 yellow，让有真实高德路径依据的自动段参与合成。
    return out.length ? out : (minTrust === 'green' ? generateAt('yellow') : [])

    async function generateAt(trust) {
      const env = chooseEnvelope({ pool, band, minTrust: trust })
      if (env.length < 3) return []
      const byId = Object.fromEntries(env.map(c => [c.id, c]))
      const shape = pool ? (PLAYPOOLS.find(p => p.id === pool)?.defaultShape || 'outback') : 'outback'
      const anchors = rankAnchors(home, env, { distKm, shape, maxAccessKm: MAX_ACCESS_KM })
      if (!anchors.length) return [] // 起点周边没廊道 → 由调用方降级旧引擎
      if (locked.length) {
        const lk = env.find(c => locked.includes(c.id))
        if (lk) { anchors.length = 0; anchors.push({ c: lk, d: 0 }) } // 钉段：以锁定廊道为锚，其余段重新随机
      }
      const results = []
      for (let a = 0; a < MAX_ATTEMPTS && results.length < count; a++) {
        const anchor = anchors[a % Math.min(anchors.length, ANCHOR_TRIES)]
        const r = await genRoute(home, env, byId, { distKm, shape, anchor, onDebug })
        if (!r) continue
        const sig = r.corridorIds.join('>')
        if (results.some(x => x.corridorIds.join('>') === sig)) continue // 同一串链不必重复出候选
        // 坡度为硬依赖但柔和降级：失败仅置 null，不丢弃候选（配合 A4）
        const sp = await calcSlopeProfile(r.segments).catch(() => null)
        r.totalClimb = sp?.totalClimb ?? null
        r.uphillSections = sp?.uphillSections ?? []
        r.downhillSections = sp?.downhillSections ?? []
        r.elevationProfile = sp?.elevationProfile ?? null
        results.push(r)
      }
      return results.slice(0, count)
    }
  }

  // 钉段重掷：语义化出口。lockedIds 非空时以锁定廊道为锚，其余段重新随机
  async function reroll(start, opts, lockedIds = []) {
    return generate(start, { ...opts, locked: lockedIds, count: opts.count ?? 3 })
  }

  return { generate, reroll, chooseEnvelope, index: ix }
}

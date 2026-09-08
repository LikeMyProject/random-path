// src/composables/corridorSearch.js —— 聪明骰子底料：廊道随机链装配 + polyline 反向
// 纯逻辑：不得访问 window / import.meta.env / 高德 SDK，以便 node --test 直接 import。
// 设计口径（计划 v1.1）：不在图上硬找完美几何环，而是「随机串链 + 交 C2 用真实高德补路后按实测里程筛选」。
const toKm = (a, b) => Math.hypot((a.lng - b.lng) * 97, (a.lat - b.lat) * 111)

// 两廊道任意两端点的最近直线距离(km)——桥接判定用
export function minBridgeKm(ca, cb) {
  if (!ca || !cb) return Infinity
  let m = Infinity
  for (const x of [ca.start, ca.end]) for (const y of [cb.start, cb.end]) m = Math.min(m, toKm(x, y))
  return m
}

// 锚点排序：家周边可作为起链的廊道，按「预测总程贴近目标」排序返回多个候选。
// 背景（2026-09-08 修复）：旧实现只挑一个锚点固定跑满 10 次尝试——若锚点自身里程已撑爆
// 里程带（如家离南山 1.8km 却锚定 9.9km 段去凑 20km 往返，总程 2×11.7=23.4 超 22.4 上带），
// 10 次尝试全废、必然 MISS 走经典兜底。故改为「多锚点轮流试」，并按贴近目标的偏差排序。
// 往返(outback) 总程 ≈ 2 × (引道 + 链)；环线(loop) ≈ 引道 + 链 + 回程(≈引道)。
// 过滤口径：真实高德里程可能低于 detour 系数预测，故不硬剔「单段往返略超上带」的锚点，
// 而是把几何已无解的排到最后、最接近的放最前，交给 genRoute 用真实总程判定。
export function rankAnchors(home, env, { distKm = 20, shape = 'outback', maxAccessKm = 18, detour = 1.35 } = {}) {
  const dMax = distKm * 1.12
  const cands = []
  for (const c of env) {
    const dStart = toKm(home, c.start), dEnd = toKm(home, c.end)
    const d = Math.min(dStart, dEnd)
    if (d > maxAccessKm) continue
    const acc = d * detour
    const km = c.distKm || 0
    const predict = shape === 'loop' ? acc + km + acc : 2 * (acc + km)
    // 单段往返明显超上带(>25%) → 几何无解，直接排除（连串小段都救不回超出的部分）
    const hopeless = shape === 'loop' ? km > dMax * 1.25 : predict > dMax * 1.25
    if (hopeless) continue
    cands.push({ c, d, predict, gap: Math.abs(predict - distKm) })
  }
  return cands.sort((a, b) => a.gap - b.gap)
}

// 随机串廊道，累计里程朝 targetKm（链的目标里程）收敛。
// 设计（2026-09-08 修复）：
//   - 往返形状下真正约束总程的是「引道 + 链」，故 targetKm 由调用方按几何反推传入，
//     不能简单 clamp 到 3——否则 4.7km 锚点一上来 sum≥3×0.9 就停，永远不串第 2、3 小段。
//   - 每轮在「桥接可达」的候选里随机挑，但优先选让累计贴近 target 的段（贴边收尾）。
//   - 累计已 ≥ target 且超出的部分不足以靠更小段补救 → 停；反之继续。
export function randomChain(corridors, { startId, usedIds = [], maxDepth = 6, maxBridgeKm = 15, targetKm = null, rng = Math.random } = {}) {
  const start = corridors.find(c => c.id === startId)
  if (!start) return []
  const used = new Set(usedIds)
  used.add(startId)
  const chain = [startId]
  let sum = start.distKm || 0
  let cur = start
  while (chain.length < maxDepth) {
    // 有目标且已达目标下界(90%) → 停；无目标则一直串满或用尽可达段
    if (targetKm != null && sum >= targetKm * 0.9) break
    const opts = corridors.filter(c => !used.has(c.id) && minBridgeKm(c, cur) <= maxBridgeKm)
    if (opts.length === 0) break
    // 有目标：找「补上这跳仍不超 target×1.15」的候选；没有则只能接受超一点
    const under = targetKm != null ? opts.filter(c => sum + (c.distKm || 0) <= targetKm * 1.15) : opts
    const pool = under.length ? under : opts
    const pick = targetKm != null ? pickClosest(sum, pool, targetKm, rng)
      : opts[Math.min(opts.length - 1, Math.floor(rng() * opts.length))]
    used.add(pick.id)
    chain.push(pick.id)
    sum += pick.distKm || 0
    cur = pick
  }
  return chain
}

// 从候选里挑下一段：优先让「累计贴近 target」，兼顾随机性。
function pickClosest(sum, opts, targetKm, rng) {
  if (targetKm == null) return opts[Math.min(opts.length - 1, Math.floor(rng() * opts.length))]
  const quota = targetKm - sum
  const scored = opts.map(c => ({ c, d: Math.abs((c.distKm || 0) - quota) + rng() * 1.5 }))
  scored.sort((a, b) => a.d - b.d)
  return scored[0].c
}

// 把一串廊道 id 变成「从哪端进、哪端出」的行进计划。
// 关键：廊道是双向可骑的，若不判方向，一律从 start 骑到 end，当上一段出口恰好靠近下一段 end 时，
// 会规划出一条横跨整条廊道再回头的怪路线。故逐段取离当前位置更近的一端作为入口。
export function planChainPath(byId, ids, from) {
  const out = []
  let cur = from
  for (const id of ids) {
    const c = byId[id]
    if (!c || !cur) continue
    const dStart = toKm(cur, c.start), dEnd = toKm(cur, c.end)
    const reversed = dEnd < dStart
    const entry = reversed ? c.end : c.start
    const exit = reversed ? c.start : c.end
    out.push({ id, corridor: c, entry, exit, reversed })
    cur = exit
  }
  return out
}

// 返程复用同一段 polyline 直接倒序即可（同一条路往回骑，不必重复请求）
export function reversePolyline(p) {
  if (!p) return ''
  return p.split(';').filter(Boolean).reverse().join(';')
}

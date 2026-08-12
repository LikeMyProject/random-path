// ============================================================
// 旅行攻略长图生成 useShareGuide.js
// Canvas 手绘长图（750px 宽，动态高度），白底清晰排版：
//   标题 / 行程总览 / 城市间交通 / 每日行程 / 天气 / 预算 /
//   精选酒店 / 必吃美食 / 实用贴士 / footer
// 复用 useShareCard.shareImage 实现下载与系统分享
// ============================================================
import { shareImage } from './useShareCard.js'

const W = 750, M = 36, CW = W - M * 2
const FONT = '"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif'
const C = {
  bg: '#ffffff', text: '#3c3844', sub: '#8a8098', mute: '#b0a3bc',
  primary: '#e27790', purple: '#7c3aed', green: '#0f6e56', orange: '#f0a870',
  blue: '#185fa5', line: '#f0eef5', card: '#faf8fd',
}

function fmtD(d) {
  if (!d) return ''
  const m = d.getMonth() + 1, day = d.getDate()
  return `${m}月${day}日`
}
function truncate(s, max) {
  const t = String(s || '')
  return t.length > max ? t.slice(0, max - 1) + '…' : t
}

/**
 * 生成攻略长图 canvas
 * @param {Object} plan buildFullPlan 结果
 * @param {Object|null} hotel 用户选择的酒店（可空）
 */
export function generateGuideImage(plan, hotel) {
  const rows = []
  let totalH = 0
  function add(h, fn) { rows.push({ h, fn }); totalH += h }
  function title(t, y, color, size, bold = true) {
    return { t, y, color, size, bold }
  }

  // ===== 标题区 =====
  add(150, (ctx, y) => {
    ctx.textAlign = 'left'; ctx.textBaseline = 'top'
    ctx.fillStyle = '#1e1b4b'; ctx.font = `bold 40px ${FONT}`
    ctx.fillText('🚴 RandomPath 旅行攻略', M, y + 16)
    ctx.fillStyle = C.primary; ctx.font = `bold 26px ${FONT}`
    ctx.fillText(plan.cities.join(' → '), M, y + 76)
    ctx.fillStyle = C.sub; ctx.font = `18px ${FONT}`
    ctx.fillText(`${plan.startDate} ~ ${plan.endDate} · 共 ${plan.totalDays} 天 · ${plan.paceLabel}节奏`, M, y + 114)
  })

  // ===== 行程总览 =====
  add(52, (ctx, y) => {
    ctx.fillStyle = C.purple; ctx.font = `bold 24px ${FONT}`; ctx.fillText('📋 行程总览', M, y)
    ctx.strokeStyle = C.line; ctx.beginPath(); ctx.moveTo(M, y + 34); ctx.lineTo(W - M, y + 34); ctx.stroke()
  })
  plan.cityPlans.forEach(cp => {
    add(34, (ctx, y) => {
      ctx.fillStyle = C.text; ctx.font = `bold 20px ${FONT}`
      ctx.fillText(cp.name, M, y + 2)
      ctx.fillStyle = C.sub; ctx.font = `18px ${FONT}`; ctx.textAlign = 'right'
      ctx.fillText(`${cp.days} 天 · ${fmtD(cp.dateRange.start)}~${fmtD(cp.dateRange.end)}`, W - M, y + 3)
      ctx.textAlign = 'left'
    })
  })

  // ===== 城市间交通 =====
  if (plan.transports.length) {
    add(52, (ctx, y) => {
      ctx.fillStyle = C.blue; ctx.font = `bold 24px ${FONT}`; ctx.fillText('🚄 城市间交通', M, y)
      ctx.strokeStyle = C.line; ctx.beginPath(); ctx.moveTo(M, y + 34); ctx.lineTo(W - M, y + 34); ctx.stroke()
    })
    plan.transports.forEach(t => {
      add(32, (ctx, y) => {
        ctx.fillStyle = C.text; ctx.font = `19px ${FONT}`
        ctx.fillText(`${t.from} → ${t.to}`, M, y + 3)
        ctx.fillStyle = C.sub; ctx.textAlign = 'right'
        ctx.fillText(`${t.mode} 约 ${t.hours} 小时${t.estimated ? '（估算）' : ''}`, W - M, y + 3)
        ctx.textAlign = 'left'
      })
    })
  }

  // ===== 每日行程 =====
  plan.cityPlans.forEach(cp => {
    add(50, (ctx, y) => {
      ctx.fillStyle = C.primary; ctx.font = `bold 24px ${FONT}`
      ctx.fillText(`🏙 ${cp.name}（${cp.days} 天）`, M, y)
      ctx.strokeStyle = C.line; ctx.beginPath(); ctx.moveTo(M, y + 34); ctx.lineTo(W - M, y + 34); ctx.stroke()
    })
    cp.daily.forEach(d => {
      const parts = d.slots.map(s => `${s.periodLabel}·${s.attraction.name}`)
      const line = truncate(parts.join('  '), 34)
      add(36, (ctx, y) => {
        ctx.fillStyle = C.orange; ctx.font = `bold 18px ${FONT}`
        ctx.fillText(`D${d.day}`, M, y + 2)
        ctx.fillStyle = C.text; ctx.font = `18px ${FONT}`; ctx.textAlign = 'left'
        ctx.fillText(truncate(line, 42), M + 52, y + 3)
        if (d.slots.length === 0) { ctx.fillStyle = C.mute; ctx.fillText('自由活动/机动', M + 52, y + 3) }
      })
    })
  })

  // ===== 天气 =====
  add(52, (ctx, y) => {
    ctx.fillStyle = C.orange; ctx.font = `bold 24px ${FONT}`; ctx.fillText('🌤 天气提示', M, y)
    ctx.strokeStyle = C.line; ctx.beginPath(); ctx.moveTo(M, y + 34); ctx.lineTo(W - M, y + 34); ctx.stroke()
  })
  plan.cityPlans.forEach(cp => {
    const w = cp.weather
    if (!w) return
    add(32, (ctx, y) => {
      ctx.fillStyle = C.text; ctx.font = `18px ${FONT}`
      ctx.fillText(`${cp.name} ${w.month}月 ${w.low}~${w.high}°C · ${w.feel}`, M, y + 3)
      ctx.fillStyle = C.sub
      ctx.fillText(`建议${w.clothing}`, M + 300, y + 3)
    })
  })

  // ===== 预算 =====
  add(52, (ctx, y) => {
    ctx.fillStyle = C.green; ctx.font = `bold 24px ${FONT}`; ctx.fillText('💰 预算参考（人均）', M, y)
    ctx.strokeStyle = C.line; ctx.beginPath(); ctx.moveTo(M, y + 34); ctx.lineTo(W - M, y + 34); ctx.stroke()
  })
  plan.budget.items.forEach(it => {
    add(30, (ctx, y) => {
      ctx.fillStyle = C.sub; ctx.font = `18px ${FONT}`
      ctx.fillText(it.label, M, y + 3)
      ctx.textAlign = 'right'; ctx.fillStyle = C.text; ctx.font = `bold 18px ${FONT}`
      ctx.fillText(it.value, W - M, y + 3); ctx.textAlign = 'left'
    })
  })
  add(38, (ctx, y) => {
    ctx.fillStyle = C.primary; ctx.font = `bold 20px ${FONT}`
    ctx.fillText(`合计 ¥${plan.budget.total[0]} ~ ¥${plan.budget.total[1]}`, M, y)
  })

  // ===== 精选酒店 =====
  add(52, (ctx, y) => {
    ctx.fillStyle = C.purple; ctx.font = `bold 24px ${FONT}`; ctx.fillText('🏨 精选酒店', M, y)
    ctx.strokeStyle = C.line; ctx.beginPath(); ctx.moveTo(M, y + 34); ctx.lineTo(W - M, y + 34); ctx.stroke()
  })
  if (hotel) {
    // 酒店卡片
    add(100, (ctx, y) => {
      ctx.fillStyle = C.card
      roundRect(ctx, M, y, CW, 92, 14); ctx.fill()
      ctx.strokeStyle = '#e5e0f5'; ctx.lineWidth = 1
      roundRect(ctx, M, y, CW, 92, 14); ctx.stroke()
      ctx.fillStyle = C.text; ctx.font = `bold 22px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'top'
      ctx.fillText(truncate(hotel.name, 22), M + 18, y + 14)
      if (hotel.city) { ctx.fillStyle = C.mute; ctx.font = `15px ${FONT}`; ctx.fillText(`📍 ${hotel.city}`, W - M - 18, y + 16) }
      ctx.fillStyle = C.primary; ctx.font = `bold 18px ${FONT}`
      ctx.fillText(formatPrice(hotel), M + 18, y + 48)
      ctx.fillStyle = C.sub; ctx.font = `17px ${FONT}`
      ctx.fillText(`${formatRating(hotel)} · 距 ${hotel.attraction} ${formatDist(hotel)}`, M + 150, y + 50)
      if (hotel.tags?.length) {
        ctx.fillStyle = C.purple; ctx.font = `16px ${FONT}`
        ctx.fillText(truncate(hotel.tags.join(' · '), 30), M + 18, y + 72)
      }
    })
  } else {
    add(34, (ctx, y) => {
      ctx.fillStyle = C.mute; ctx.font = `18px ${FONT}`
      ctx.fillText('（未选择酒店，可在生成前挑选）', M, y + 3)
    })
  }

  // ===== 必吃美食 =====
  add(52, (ctx, y) => {
    ctx.fillStyle = '#d4537e'; ctx.font = `bold 24px ${FONT}`; ctx.fillText('🍜 必吃美食', M, y)
    ctx.strokeStyle = C.line; ctx.beginPath(); ctx.moveTo(M, y + 34); ctx.lineTo(W - M, y + 34); ctx.stroke()
  })
  plan.cityPlans.forEach(cp => {
    const line = truncate(cp.data.foods.map(f => `${f.name}(${f.price})`).join('  '), 40)
    add(32, (ctx, y) => {
      ctx.fillStyle = C.text; ctx.font = `bold 18px ${FONT}`
      ctx.fillText(`${cp.name}：`, M, y + 3)
      ctx.fillStyle = C.sub; ctx.font = `18px ${FONT}`
      ctx.fillText(truncate(line, 34), M + 110, y + 3)
    })
  })

  // ===== 实用贴士 =====
  add(52, (ctx, y) => {
    ctx.fillStyle = C.blue; ctx.font = `bold 24px ${FONT}`; ctx.fillText('💡 实用贴士', M, y)
    ctx.strokeStyle = C.line; ctx.beginPath(); ctx.moveTo(M, y + 34); ctx.lineTo(W - M, y + 34); ctx.stroke()
  })
  plan.cityPlans.forEach(cp => {
    cp.data.tips.forEach(t => {
      add(32, (ctx, y) => {
        ctx.fillStyle = C.sub; ctx.font = `17px ${FONT}`
        ctx.fillText(truncate(`【${cp.name}】${t}`, 42), M, y + 3)
      })
    })
  })

  // ===== footer =====
  add(80, (ctx, y) => {
    ctx.fillStyle = C.mute; ctx.font = `16px ${FONT}`; ctx.textAlign = 'center'
    const now = new Date()
    ctx.fillText(`RandomPath · 骑行 & 旅行攻略 · ${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`, W / 2, y + 20)
    ctx.textAlign = 'left'
  })

  // 创建 canvas
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = totalH + 40
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = C.bg
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  let y = 20
  for (const r of rows) {
    ctx.save()
    r.fn(ctx, y)
    ctx.restore()
    y += r.h
  }
  return canvas
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath()
}

function formatPrice(h) {
  if (h.price != null) return `¥${Math.round(h.price)}/晚`
  if (h.priceRange) return `¥${h.priceRange[0]}~${h.priceRange[1]}/晚（参考）`
  return '价格未知'
}
function formatRating(h) {
  if (h.rating != null) return `${h.rating} 分`
  if (h.reputation) return `${h.reputation.label}（参考）`
  return '暂无评分'
}
function formatDist(h) {
  if (h.distance == null) return '—'
  return h.distance < 1000 ? `${h.distance}m` : `${(h.distance / 1000).toFixed(1)}km`
}

export async function shareGuideImage(plan, hotel) {
  const canvas = generateGuideImage(plan, hotel)
  const name = `旅行攻略_${plan.cities.join('-')}_${plan.totalDays}天.png`
  return shareImage(canvas, name)
}

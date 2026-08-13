// ============================================================
// 旅行攻略长图生成 useShareGuide.js
// 小红书/马蜂窝风长图（750px 宽，动态高度），完整重设计：
//   顶部 banner / 行程总览 / 每日行程卡 / 天气 / 预算可视化 /
//   精选酒店 / 必吃美食 / 实用贴士 / footer
// ============================================================
import { shareImage } from './useShareCard.js'
import { estimateTransit, TRANSIT_LABEL } from './useHotel.js'
import { groupByCategory, CAT_META } from './useTravel.js'

const W = 750, M = 0, CW = 750
const FONT = '"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif'

const C = {
  bg: '#f5f3f7',
  card: '#ffffff',
  ink: '#1e1b4b',
  text: '#4a3f55',
  sub: '#8a7a98',
  mute: '#b0a3bc',
  line: '#ece6f0',
  purple: '#7c3aed', pBg: '#f8f6ff',
  pink: '#e27790', pnkBg: '#fff5f8',
  orange: '#f59e0b', oBg: '#fff7e6',
  green: '#10b981', gBg: '#ecfdf5',
  blue: '#3b82f6', bBg: '#eff6ff',
  red: '#ef4444',
}

function fmtMD(d) {
  if (!d) return ''
  return `${d.getMonth() + 1}月${d.getDate()}日`
}
function truncate(s, max) {
  s = String(s || '')
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}
function wrap(ctx, text, x, y, maxW, lineH = 22) {
  // 简单换行（按字符宽度估算）
  const lines = []
  let cur = ''
  for (const ch of String(text)) {
    const w = ctx.measureText(cur + ch).width
    if (w > maxW && cur) { lines.push(cur); cur = ch }
    else cur += ch
  }
  if (cur) lines.push(cur)
  let yy = y
  for (const ln of lines) { ctx.fillText(ln, x, yy); yy += lineH }
  return yy
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}
function drawStar(ctx, cx, cy, size, color) {
  ctx.fillStyle = color
  ctx.beginPath()
  const spikes = 5
  const outer = size, inner = size * 0.4
  let rot = -Math.PI / 2
  for (let i = 0; i < spikes; i++) {
    ctx.lineTo(cx + Math.cos(rot) * outer, cy + Math.sin(rot) * outer)
    rot += Math.PI / spikes
    ctx.lineTo(cx + Math.cos(rot) * inner, cy + Math.sin(rot) * inner)
    rot += Math.PI / spikes
  }
  ctx.closePath()
  ctx.fill()
}

/**
 * 生成攻略长图 canvas
 */
export function generateGuideImage(plan, hotel) {
  const M = 30 // 卡片左右留白
  const X = M // 内容起始 X
  const rows = [] // 渲染段 [{h, fn}]
  let totalH = 0
  function add(h, fn) { rows.push({ h, fn }); totalH += h }

  // ===== 顶部 Banner（紫色渐变 220px）=====
  add(220, (ctx, y) => {
    // 渐变背景
    const grad = ctx.createLinearGradient(0, y, W, y + 220)
    grad.addColorStop(0, '#7c3aed'); grad.addColorStop(1, '#312e81')
    ctx.fillStyle = grad
    ctx.fillRect(0, y, W, 220)
    // 顶部小标识
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = `bold 18px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'top'
    ctx.fillText('🧭 漫途', X + 10, y + 20)
    // 主标题
    ctx.fillStyle = '#ffffff'; ctx.font = `bold 52px ${FONT}`
    ctx.fillText('旅行攻略', X + 10, y + 50)
    // 城市链 chip
    const cities = plan.cities
    let cx = X + 10
    ctx.font = `bold 26px ${FONT}`
    cities.forEach((c, i) => {
      const w = ctx.measureText(c).width + 32
      ctx.fillStyle = i === 0 ? '#ffffff' : 'rgba(255,255,255,0.2)'
      ctx.fillStyle = 'rgba(255,255,255,0.15)'
      roundRect(ctx, cx, y + 130, w, 42, 21); ctx.fill()
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1
      roundRect(ctx, cx, y + 130, w, 42, 21); ctx.stroke()
      ctx.fillStyle = '#ffffff'; ctx.textBaseline = 'middle'
      ctx.fillText(c, cx + 16, y + 151)
      cx += w + 8
      if (i < cities.length - 1) {
        ctx.fillStyle = 'rgba(255,255,255,0.6)'
        ctx.fillText('→', cx + 6, y + 151)
        cx += 24
      }
    })
    // 行程信息
    ctx.textBaseline = 'top'
    ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.font = `18px ${FONT}`
    ctx.fillText(`自由行攻略 · ${plan.paceLabel}`, X + 10, y + 184)
  })

  // ===== 行程总览卡片（无天数：列城市 + 景点数）=====
  add(76 + 38 * plan.cityPlans.length, (ctx, y) => {
    y += 16
    drawCardTitle(ctx, X, y, '🗺️ 行程总览', C.purple)
    y += 50
    // 每城一行
    plan.cityPlans.forEach(cp => {
      ctx.fillStyle = C.card
      roundRect(ctx, X, y, CW - M * 2, 30, 8); ctx.fill()
      ctx.strokeStyle = C.line; ctx.lineWidth = 1
      roundRect(ctx, X, y, CW - M * 2, 30, 8); ctx.stroke()
      ctx.fillStyle = C.text; ctx.font = `bold 17px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
      ctx.fillText(`📍 ${cp.name}`, X + 14, y + 15)
      ctx.fillStyle = C.purple; ctx.font = `bold 14px ${FONT}`; ctx.textAlign = 'right'
      const txt = `${cp.attractions.length} 个景点`
      const tw = ctx.measureText(txt).width
      ctx.fillText(txt, X + CW - M * 2 - 14 - tw, y + 15)
      y += 38
    })
  })

  // ===== 城市间交通（无天数模式无此项）=====
  if (plan.transports?.length) {
    add(76 + 34 * plan.transports.length, (ctx, y) => {
      y += 16
      drawCardTitle(ctx, X, y, '🚄 城市间交通', C.blue)
      y += 50
      plan.transports.forEach(t => {
        ctx.fillStyle = C.bBg
        roundRect(ctx, X, y, CW - M * 2, 26, 6); ctx.fill()
        ctx.fillStyle = C.text; ctx.font = `bold 15px ${FONT}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left'
        ctx.fillText(`🚄 ${t.from}  →  ${t.to}`, X + 12, y + 13)
        ctx.fillStyle = C.sub; ctx.textAlign = 'right'
        ctx.fillText(`${t.mode} 约 ${t.hours}h${t.estimated ? '（估算）' : ''}`, X + CW - M * 2 - 12, y + 13)
        y += 34
      })
    })
  }

  // ===== 景点清单（无天数：每城一节，按 景点/美食/购物 分类列出）=====
  plan.cityPlans.forEach(cp => {
    const groups = groupByCategory(cp.attractions)
    let listH = 0
    groups.forEach(g => { listH += 30; listH += g.items.length * 40 })
    add(72 + listH, (ctx, y) => {
      y += 16
      // 城市标题栏（紫色条）
      ctx.fillStyle = C.purple
      roundRect(ctx, X, y, CW - M * 2, 44, 10); ctx.fill()
      ctx.fillStyle = '#ffffff'; ctx.font = `bold 20px ${FONT}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left'
      ctx.fillText(`🏙 ${cp.name}（${cp.attractions.length} 个地点）`, X + 16, y + 22)
      ctx.textAlign = 'right'
      ctx.font = `14px ${FONT}`
      if (cp.weather) ctx.fillText(`${cp.weather.low}~${cp.weather.high}°C`, X + CW - M * 2 - 16, y + 22)
      y += 60

      // 分类区块（景点 / 美食 / 购物）
      groups.forEach(g => {
        // 分类小标题
        ctx.fillStyle = CAT_META[g.key].color
        ctx.font = 'bold 16px ' + FONT; ctx.textBaseline = 'middle'; ctx.textAlign = 'left'
        ctx.fillText(CAT_META[g.key].icon + ' ' + CAT_META[g.key].label, X + 4, y + 14)
        y += 30
        g.items.forEach((a, i) => {
        ctx.fillStyle = C.card
        roundRect(ctx, X, y, CW - M * 2, 34, 8); ctx.fill()
        ctx.strokeStyle = C.line; ctx.lineWidth = 1
        roundRect(ctx, X, y, CW - M * 2, 34, 8); ctx.stroke()
        // 序号
        ctx.fillStyle = C.purple; ctx.font = `bold 15px ${FONT}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left'
        ctx.fillText(`${i + 1}`, X + 14, y + 17)
        // 名称 + 必看星
        ctx.fillStyle = C.ink; ctx.font = `bold 16px ${FONT}`
        const must = (a.mustSee || 0) >= 4 && g.key === 'sight' ? ' ★'.repeat(Math.min(3, a.mustSee || 0)) : ''
        ctx.fillText(truncate(a.name + must, 18), X + 38, y + 17)
        // 右侧：门票 / 时长
        const right = [a.ticket, a.duration].filter(Boolean).join(' · ')
        if (right) {
          ctx.fillStyle = C.sub; ctx.font = `13px ${FONT}`; ctx.textAlign = 'right'
          ctx.fillText(truncate(right, 14), X + CW - M * 2 - 14, y + 17)
        }
        y += 40
        })
        y += 6
      })
    })
  })

  // ===== 天气 + 穿衣 =====
  add(76 + 50 * plan.cityPlans.length, (ctx, y) => {
    y += 16
    drawCardTitle(ctx, X, y, '☀️ 天气 & 穿衣', C.orange)
    y += 50
    plan.cityPlans.forEach(cp => {
      const w = cp.weather
      if (!w) return
      ctx.fillStyle = C.oBg
      roundRect(ctx, X, y, CW - M * 2, 42, 8); ctx.fill()
      ctx.fillStyle = C.text; ctx.font = `bold 16px ${FONT}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left'
      ctx.fillText(`${cp.name}  ${w.month}月`, X + 14, y + 21)
      ctx.fillStyle = C.orange; ctx.font = `bold 18px ${FONT}`
      ctx.fillText(`${w.low}~${w.high}°C`, X + 130, y + 21)
      ctx.fillStyle = C.sub; ctx.font = `14px ${FONT}`; ctx.textAlign = 'right'
      ctx.fillText(`${w.feel} · ${w.clothing}`, X + CW - M * 2 - 14, y + 21)
      y += 50
    })
  })

  // ===== 预算（条形可视化）=====
  add(110 + 56 * plan.budget.items.length, (ctx, y) => {
    y += 16
    drawCardTitle(ctx, X, y, '💰 预算参考（人均）', C.green)
    y += 50
    const totalHigh = plan.budget.total[1]
    plan.budget.items.forEach(it => {
      // 解析数字
      const m = String(it.value).match(/\d+/g)
      const val = m ? m.map(Number).reduce((a, b) => a + b, 0) / m.length : 0
      const pct = totalHigh ? Math.min(100, val / totalHigh * 100) : 0
      ctx.fillStyle = C.gBg
      roundRect(ctx, X, y, CW - M * 2, 48, 8); ctx.fill()
      ctx.fillStyle = C.text; ctx.font = `15px ${FONT}`; ctx.textBaseline = 'top'; ctx.textAlign = 'left'
      ctx.fillText(it.label, X + 14, y + 8)
      ctx.fillStyle = C.green; ctx.font = `bold 15px ${FONT}`; ctx.textAlign = 'right'
      ctx.fillText(it.value, X + CW - M * 2 - 14, y + 8)
      // 条
      const barW = CW - M * 2 - 28
      ctx.fillStyle = '#d1fae5'; roundRect(ctx, X + 14, y + 32, barW, 6, 3); ctx.fill()
      ctx.fillStyle = C.green; roundRect(ctx, X + 14, y + 32, barW * pct / 100, 6, 3); ctx.fill()
      y += 56
    })
    // 合计
    ctx.fillStyle = C.green
    roundRect(ctx, X, y, CW - M * 2, 44, 10); ctx.fill()
    ctx.fillStyle = '#ffffff'; ctx.font = `bold 18px ${FONT}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left'
    ctx.fillText(`人均合计`, X + 16, y + 22)
    ctx.textAlign = 'right'
    ctx.fillText(`¥${plan.budget.total[0]} ~ ¥${plan.budget.total[1]}`, X + CW - M * 2 - 16, y + 22)
  })

  // ===== 精选酒店 + 酒店→景点出行路线 =====
  let hotelRoutes = []
  if (hotel && hotel.city) {
    const cityCp = plan.cityPlans.find(cp => cp.name === hotel.city)
    if (cityCp) {
      const seen = new Set()
      const attrs = []
      cityCp.attractions.forEach(a => {
        if (a.coord && !seen.has(a.name)) { seen.add(a.name); attrs.push({ name: a.name, coord: a.coord }) }
      })
      if (attrs.length === 0) (cityCp.data?.attractions || []).forEach(a => {
        if (a.coord && !seen.has(a.name)) { seen.add(a.name); attrs.push({ name: a.name, coord: a.coord }) }
      })
      hotelRoutes = estimateTransit(hotel, attrs).sort((x, y) => x.km - y.km).slice(0, 8)
    }
  }
  const routeBlockH = hotelRoutes.length ? (14 + 26 + hotelRoutes.length * 26) : 0
  add(hotel ? 100 + routeBlockH : 116, (ctx, y) => {
    y += 16
    drawCardTitle(ctx, X, y, '🏨 精选酒店', C.pink)
    y += 50
    if (hotel) {
      ctx.fillStyle = C.pnkBg
      roundRect(ctx, X, y, CW - M * 2, 100, 14); ctx.fill()
      ctx.strokeStyle = '#fbd5e0'; ctx.lineWidth = 1
      roundRect(ctx, X, y, CW - M * 2, 100, 14); ctx.stroke()
      ctx.fillStyle = C.pink; ctx.font = `bold 22px ${FONT}`; ctx.textBaseline = 'top'; ctx.textAlign = 'left'
      ctx.fillText(truncate(hotel.name, 20), X + 18, y + 14)
      if (hotel.city) {
        ctx.fillStyle = '#fff'; ctx.font = `bold 13px ${FONT}`
        const tagW = hotel.city.length * 14 + 16
        roundRect(ctx, X + CW - M * 2 - tagW - 12, y + 14, tagW, 22, 11); ctx.fill()
        ctx.fillStyle = C.pink
        ctx.fillText(`📍 ${hotel.city}`, X + CW - M * 2 - tagW - 4, y + 18)
      }
      ctx.fillStyle = C.pink; ctx.font = `bold 18px ${FONT}`; ctx.textBaseline = 'top'
      ctx.fillText(formatPrice(hotel), X + 18, y + 48)
      ctx.fillStyle = C.text; ctx.font = `15px ${FONT}`
      ctx.fillText(`${formatRating(hotel)} · 距 ${hotel.attraction || '景点'} ${formatDist(hotel)}`, X + 18, y + 76)
      if (hotel.tags?.length) {
        let tx = X + CW - M * 2 - 14
        hotel.tags.slice(0, 3).reverse().forEach(t => {
          ctx.font = `12px ${FONT}`
          const w = ctx.measureText(t).width + 16
          tx -= (w + 6)
          ctx.fillStyle = '#ffffff'; roundRect(ctx, tx, y + 78, w, 18, 9); ctx.fill()
          ctx.strokeStyle = C.pink; ctx.lineWidth = 1
          roundRect(ctx, tx, y + 78, w, 18, 9); ctx.stroke()
          ctx.fillStyle = C.pink; ctx.textBaseline = 'middle'; ctx.textAlign = 'center'
          ctx.fillText(t, tx + w / 2, y + 87)
        })
      }
      if (hotelRoutes.length) {
        let ry = y + 100 + 14
        ctx.fillStyle = C.sub; ctx.font = `bold 14px ${FONT}`; ctx.textBaseline = 'top'; ctx.textAlign = 'left'
        ctx.fillText('🚉 酒店 → 各景点 出行估算', X + 18, ry)
        ry += 26
        hotelRoutes.forEach(rt => {
          ctx.fillStyle = C.card
          roundRect(ctx, X, ry, CW - M * 2, 22, 6); ctx.fill()
          ctx.fillStyle = C.ink; ctx.font = `13px ${FONT}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left'
          ctx.fillText(`→ ${truncate(rt.attraction, 14)}`, X + 14, ry + 11)
          const modeLabel = TRANSIT_LABEL[rt.mode] || rt.mode
          ctx.fillStyle = C.sub; ctx.textAlign = 'right'
          ctx.fillText(`${rt.km}km · ${modeLabel} ${rt.timeMin}min · ${rt.fee}`, X + CW - M * 2 - 14, ry + 11)
          ry += 26
        })
      }
    } else {
      ctx.fillStyle = C.card
      roundRect(ctx, X, y, CW - M * 2, 40, 8); ctx.fill()
      ctx.fillStyle = C.mute; ctx.font = `13px ${FONT}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'center'
      ctx.fillText('（未选择酒店，可分享前在弹窗挑选）', X + (CW - M * 2) / 2, y + 20)
    }
  })

  // ===== 餐厅推荐（从每日行程中提取真实餐厅，按城市分组）=====
  {
    let foodTotalH = 60
    plan.cityPlans.forEach(cp => {
      const restList = extractCityRestaurants(cp)
      if (restList.length === 0) return
      foodTotalH += 28
      foodTotalH += restList.length * 46 + (restList.length > 0 ? (restList.length - 1) * 4 : 0)
      foodTotalH += 14
    })
    foodTotalH += 8

    add(foodTotalH, (ctx, y) => {
      y += 16
      drawCardTitle(ctx, X, y, '🍽 餐厅推荐', C.red)
      y += 44

      plan.cityPlans.forEach(cp => {
        const restList = extractCityRestaurants(cp)
        if (restList.length === 0) return

        ctx.fillStyle = C.red; ctx.font = `bold 17px ${FONT}`; ctx.textBaseline = 'top'; ctx.textAlign = 'left'
        ctx.fillText(`📍 ${cp.name}（${restList.length} 家）`, X + 4, y)
        y += 28

        restList.forEach((r) => {
          const cardH = 42
          ctx.fillStyle = '#fff5f5'
          roundRect(ctx, X, y, CW - M * 2, cardH, 8); ctx.fill()
          ctx.strokeStyle = '#fde2e2'; ctx.lineWidth = 1
          roundRect(ctx, X, y, CW - M * 2, cardH, 8); ctx.stroke()

          ctx.fillStyle = C.ink; ctx.font = `bold 15px ${FONT}`; ctx.textBaseline = 'top'; ctx.textAlign = 'left'
          ctx.fillText(truncate(r.name, 16), X + 14, y + 8)

          const rightParts = []
          if (r.rating) rightParts.push(`⭐${r.rating}`)
          if (r.price) rightParts.push(r.price)
          if (rightParts.length) {
            ctx.fillStyle = C.red; ctx.font = `bold 13px ${FONT}`; ctx.textAlign = 'right'
            ctx.fillText(rightParts.join('  '), X + CW - M * 2 - 14, y + 8)
          }

          const infoParts = []
          if (r.tag) infoParts.push(r.tag)
          if (r.address) infoParts.push(`📍 ${truncate(r.address, 24)}`)
          if (infoParts.length) {
            ctx.fillStyle = C.sub; ctx.font = `12px ${FONT}`; ctx.textAlign = 'left'
            ctx.fillText(infoParts.join('  '), X + 14, y + 26)
          }
          y += cardH + 4
        })
        y += 10
      })
    })
  }

  // ===== 本地人去的地方（从每日行程中提取，按城市分组）=====
  {
    let localTotalH = 60
    plan.cityPlans.forEach(cp => {
      const spotList = extractCityLocalSpots(cp)
      if (spotList.length === 0) return
      localTotalH += 28
      localTotalH += spotList.length * 42 + (spotList.length > 0 ? (spotList.length - 1) * 4 : 0)
      localTotalH += 14
    })
    localTotalH += 8

    add(localTotalH, (ctx, y) => {
      y += 16
      drawCardTitle(ctx, X, y, '🏮 本地人去的地方', C.orange)
      y += 44

      plan.cityPlans.forEach(cp => {
        const spotList = extractCityLocalSpots(cp)
        if (spotList.length === 0) return

        ctx.fillStyle = C.orange; ctx.font = `bold 17px ${FONT}`; ctx.textBaseline = 'top'; ctx.textAlign = 'left'
        ctx.fillText(`📍 ${cp.name}（${spotList.length} 处）`, X + 4, y)
        y += 28

        spotList.forEach((sp) => {
          const cardH = 38
          ctx.fillStyle = '#fffbeb'
          roundRect(ctx, X, y, CW - M * 2, cardH, 8); ctx.fill()
          ctx.strokeStyle = '#fde6c8'; ctx.lineWidth = 1
          roundRect(ctx, X, y, CW - M * 2, cardH, 8); ctx.stroke()

          ctx.fillStyle = C.ink; ctx.font = `bold 15px ${FONT}`; ctx.textBaseline = 'top'; ctx.textAlign = 'left'
          ctx.fillText(`🏮 ${truncate(sp.name, 16)}`, X + 14, y + 8)

          if (sp.label) {
            ctx.fillStyle = C.orange; ctx.font = `bold 12px ${FONT}`; ctx.textAlign = 'right'
            ctx.fillText(sp.label, X + CW - M * 2 - 14, y + 8)
          }

          const infoParts = []
          if (sp.tag) infoParts.push(truncate(sp.tag, 18))
          if (sp.address) infoParts.push(`📍 ${truncate(sp.address, 22)}`)
          if (infoParts.length) {
            ctx.fillStyle = C.sub; ctx.font = `12px ${FONT}`; ctx.textAlign = 'left'
            ctx.fillText(infoParts.join('  '), X + 14, y + 24)
          }
          y += cardH + 4
        })
        y += 10
      })
    })
  }

  // ===== 实用贴士 =====
  const totalTips = plan.cityPlans.reduce((s, cp) => s + cp.data.tips.length, 0)
  add(66 + 30 * totalTips, (ctx, y) => {
    y += 16
    drawCardTitle(ctx, X, y, '💡 实用贴士', C.blue)
    y += 50
    plan.cityPlans.forEach(cp => {
      cp.data.tips.forEach(t => {
        ctx.fillStyle = C.bBg
        roundRect(ctx, X, y, CW - M * 2, 26, 6); ctx.fill()
        ctx.fillStyle = C.text; ctx.font = `13px ${FONT}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left'
        ctx.fillText(`💡 【${cp.name}】${truncate(t, 50)}`, X + 12, y + 13)
        y += 30
      })
    })
  })

  // ===== Footer =====
  add(80, (ctx, y) => {
    y += 16
    ctx.fillStyle = C.sub; ctx.font = `13px ${FONT}`; ctx.textAlign = 'center'
    const now = new Date()
    ctx.fillText(`🧭 漫途 · 骑行 & 旅行攻略`, X + (CW - M * 2) / 2, y + 10)
    ctx.fillStyle = C.mute
    ctx.fillText(`radom-path-vue.vercel.app  ·  生成于 ${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`, X + (CW - M * 2) / 2, y + 36)
    ctx.textAlign = 'left'
  })

  // ===== 创建 canvas 并逐段渲染 =====
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = totalH
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = C.bg
  ctx.fillRect(0, 0, W, canvas.height)

  let y = 0
  for (const r of rows) {
    ctx.save()
    r.fn(ctx, y)
    ctx.restore()
    y += r.h
  }
  return canvas
}

function drawCardTitle(ctx, x, y, title, accentColor) {
  ctx.fillStyle = accentColor
  roundRect(ctx, x, y, 4, 26, 2); ctx.fill()
  ctx.fillStyle = C.ink; ctx.font = `bold 22px ${FONT}`; ctx.textBaseline = 'top'; ctx.textAlign = 'left'
  ctx.fillText(title, x + 14, y)
}

/** 从城市行程中提取不重复的餐厅列表 */
function extractCityRestaurants(cp) {
  const seen = new Set()
  const list = []
  cp.daily?.forEach(d => {
    d.slots?.forEach(s => {
      if (s.meal && !seen.has(s.meal.name)) {
        seen.add(s.meal.name)
        list.push(s.meal)
      }
    })
  })
  return list
}

/** 从城市行程中提取不重复的本地地点列表 */
function extractCityLocalSpots(cp) {
  const seen = new Set()
  const list = []
  cp.daily?.forEach(d => {
    d.slots?.forEach(s => {
      if (s.local && !seen.has(s.spot.name)) {
        seen.add(s.spot.name)
        list.push(s.spot)
      }
    })
  })
  return list
}

function drawSlot(ctx, x, y, w, s, dayColor) {
  const isMeal = !!s.meal
  const isLocal = !!s.local
  const isFree = s.period === 'free'
  const hasShop = isMeal && (s.meal.address || s.meal.tag)
  const hasLocalAddr = isLocal && s.spot.address
  const slotH = (hasShop || hasLocalAddr) ? 42 : 28
  const mealColor = s.period === 'breakfast' ? C.orange : C.pink
  const localColor = C.orange
  ctx.fillStyle = isMeal ? (s.period === 'breakfast' ? '#fff7e6' : '#fff5f8') : isLocal ? '#fffbeb' : isFree ? '#faf8fd' : '#ffffff'
  roundRect(ctx, x, y, w, slotH, 6); ctx.fill()
  ctx.strokeStyle = isMeal ? (s.period === 'breakfast' ? '#fde6c8' : '#fbd5e0') : isLocal ? '#fde6c8' : isFree ? '#ece6f0' : C.line; ctx.lineWidth = 1
  roundRect(ctx, x, y, w, slotH, 6); ctx.stroke()
  const periodLabel = s.periodLabel || '时段'
  const tagW = 44
  ctx.fillStyle = isMeal ? mealColor : isLocal ? localColor : isFree ? C.mute : dayColor
  roundRect(ctx, x, y, tagW, slotH, 6); ctx.fill()
  ctx.fillStyle = '#ffffff'; ctx.font = `bold 11px ${FONT}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'center'
  ctx.fillText(periodLabel, x + tagW / 2, y + slotH / 2)
  // 内容
  ctx.textAlign = 'left'
  if (isMeal) {
    ctx.fillStyle = mealColor; ctx.font = `bold 13px ${FONT}`; ctx.textBaseline = 'top'
    ctx.fillText(`🍴 ${truncate(s.meal.name, 14)}`, x + tagW + 8, y + 6)
    const rightParts = []
    if (s.meal.rating) rightParts.push(`⭐${s.meal.rating}`)
    if (s.meal.price) rightParts.push(s.meal.price)
    if (rightParts.length) {
      ctx.fillStyle = C.sub; ctx.font = `12px ${FONT}`; ctx.textAlign = 'right'
      ctx.fillText(rightParts.join('  '), x + w - 8, y + 7)
    }
    if (hasShop) {
      const infoText = s.meal.tag ? truncate(s.meal.tag, 20) : ''
      const addrText = s.meal.address ? `📍 ${truncate(s.meal.address, 22)}` : ''
      ctx.fillStyle = C.mute; ctx.font = `11px ${FONT}`; ctx.textAlign = 'left'
      ctx.fillText([infoText, addrText].filter(Boolean).join('  '), x + tagW + 8, y + 26)
    }
  } else if (isLocal) {
    ctx.fillStyle = localColor; ctx.font = `bold 13px ${FONT}`; ctx.textBaseline = 'top'
    ctx.fillText(`🏮 ${truncate(s.spot.name, 14)}`, x + tagW + 8, y + 6)
    if (s.spot.label) {
      ctx.fillStyle = C.sub; ctx.font = `12px ${FONT}`; ctx.textAlign = 'right'
      ctx.fillText(s.spot.label, x + w - 8, y + 7)
    }
    if (hasLocalAddr) {
      const tagText = s.spot.tag ? truncate(s.spot.tag, 20) : ''
      const addrText = `📍 ${truncate(s.spot.address, 22)}`
      ctx.fillStyle = C.mute; ctx.font = `11px ${FONT}`; ctx.textAlign = 'left'
      ctx.fillText([tagText, addrText].filter(Boolean).join('  '), x + tagW + 8, y + 26)
    }
  } else if (isFree) {
    ctx.fillStyle = C.sub; ctx.font = `12px ${FONT}`; ctx.textBaseline = 'middle'
    ctx.fillText(truncate(s.attraction.name, 22) + (s.attraction.desc ? `  ·  ${s.attraction.desc}` : ''), x + tagW + 8, y + 14)
  } else {
    ctx.fillStyle = C.ink; ctx.font = `bold 13px ${FONT}`; ctx.textBaseline = 'middle'
    ctx.fillText(truncate(s.attraction.name, 14), x + tagW + 8, y + 14)
    const meta = []
    if (s.attraction.ticket) meta.push(`🎫 ${s.attraction.ticket}`)
    if (s.attraction.duration) meta.push(`⏱ ${s.attraction.duration}`)
    const metaText = meta.join(' · ')
    if (metaText) {
      ctx.fillStyle = C.sub; ctx.font = `11px ${FONT}`
      ctx.fillText(truncate(metaText, 28), x + tagW + 8, y + 26 - 12 + 14)
    }
  }
}

function formatPrice(h) {
  if (h.price != null) return `¥${Math.round(h.price)}/晚`
  if (h.priceRange) return `¥${h.priceRange[0]}~${h.priceRange[1]}/晚（参考）`
  return '价格未知'
}
function formatRating(h) {
  if (h.rating != null) return `${h.rating} 分`
  if (h.reputation) return `${h.reputation.label}`
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
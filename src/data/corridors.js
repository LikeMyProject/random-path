// src/data/corridors.js
// 单一事实源：手工精编条目 + 构建脚本产物（corridors.auto.json）在此合并，运行时只读。
// 注：JSON 导入必须带 import attributes，否则 Node 单测（node --test）无法 import 本模块。
// trust: grey(自动待实测)|yellow(疑点)|green(实骑)|blue(人工精校)
import autoCorridors from './corridors.auto.json' with { type: 'json' }

const MANUAL = [
  {
    id: 'nl-fengyu-fenshuiling', name: '沣峪口→分水岭(G210)', region: '关中·南山',
    type: 'climbRoad', surface: 'paved', climbBand: 'hill', playpool: ['nan-ling'],
    distKm: 33, climbM: 1900, trust: 'blue', src: 'preset:西安·秦岭分水岭', status: 'open',
    start: { name: '沣峪口', lng: 108.83, lat: 34.05 }, end: { name: '分水岭', lng: 108.95, lat: 33.88 },
  },
  {
    id: 'nl-fengyu-jiaowozi', name: '沣峪口→鸡窝子', region: '关中·南山',
    type: 'climbRoad', surface: 'paved', climbBand: 'hill', playpool: ['nan-ling'],
    distKm: 17, climbM: 700, trust: 'green', src: 'preset:西安·秦岭分水岭(G210爬坡线)途经', status: 'open',
    start: { name: '沣峪口', lng: 108.83, lat: 34.05 }, end: { name: '鸡窝子', lng: 108.92, lat: 33.92 },
  },
  {
    id: 'nl-jiaowozi-fenshuiling', name: '鸡窝子→分水岭', region: '关中·南山',
    type: 'climbRoad', surface: 'paved', climbBand: 'hill', playpool: ['nan-ling'],
    distKm: 9, climbM: 300, trust: 'green', src: 'preset:西安·秦岭分水岭', status: 'open',
    start: { name: '鸡窝子', lng: 108.92, lat: 33.92 }, end: { name: '分水岭', lng: 108.95, lat: 33.88 },
  },
  {
    id: 'nl-zongguan-chanhe', name: '子午峪→祥峪串骑(环山路北侧乡道)', region: '关中·南山',
    type: 'countyRoad', surface: 'paved', climbBand: 'rolling', playpool: ['nan-ling'],
    distKm: 16, climbM: 180, trust: 'grey', src: 'preset:西安·关中环线串骑峪口', status: 'open',
    start: { name: '子午峪', lng: 108.87, lat: 34.02 }, end: { name: '祥峪', lng: 108.75, lat: 34.0 },
  },
  {
    id: 'wh-fengxi-yangling', name: '沣西→杨凌(渭河堤顶路)', region: '关中·西',
    type: 'riverDyke', surface: 'paved', climbBand: 'flat', playpool: ['weihe-west'],
    distKm: 38, climbM: 60, trust: 'green', src: 'preset:西安→杨凌（渭河河堤路）', status: 'open',
    start: { name: '沣西新城', lng: 108.74, lat: 34.27 }, end: { name: '杨凌', lng: 108.07, lat: 34.272 },
  },
  {
    id: 'wh-xianyang-lake', name: '咸阳湖环湖+渭河湿地段', region: '关中·西',
    type: 'riverDyke', surface: 'paved', climbBand: 'flat', playpool: ['weihe-west'],
    distKm: 12, climbM: 30, trust: 'grey', src: 'preset:咸阳·五陵塬骑行', status: 'open',
    start: { name: '咸阳钟楼', lng: 108.71, lat: 34.336 }, end: { name: '渭河横桥', lng: 108.79, lat: 34.38 },
  },
  {
    id: 'gw-bahe-shiboyuan', name: '浐灞→世博园→洪庆（灞河绿道）', region: '西安·城区',
    type: 'greenway', surface: 'paved', climbBand: 'flat', playpool: ['greenway'],
    // 注：原起终点均为「浐灞」109.06,34.32（与世博园 109.061,34.323 仅相距约 300m，预设数据 3 位小数精度所致），
    // 属零长度廊道会让桥接距离恒为 0、高德同点规划报错。故终点取该预设线终点「洪庆山」。
    distKm: 14, climbM: 40, trust: 'green', src: 'preset:西安·浐灞→世博园→洪庆（灞河绿道）', status: 'open',
    start: { name: '浐灞', lng: 109.060, lat: 34.320 }, end: { name: '洪庆山', lng: 109.180, lat: 34.280 },
  },
  {
    id: 'gw-yizhi-hu', name: '沣河绿道·仪祉湖段', region: '西安·城区',
    type: 'greenway', surface: 'paved', climbBand: 'flat', playpool: ['greenway'],
    distKm: 10, climbM: 20, trust: 'grey', src: 'preset:西安·三河一山绿道', status: 'open',
    start: { name: '仪祉湖', lng: 108.764, lat: 34.106 }, end: { name: '沣峪口转盘', lng: 108.822, lat: 34.051 },
  },
]

export const CORRIDORS = [...MANUAL, ...autoCorridors]
// src/data/playpools.js —— 关中 v1 三个玩法池，按骑行语义归堆
export const PLAYPOOLS = [
  {
    id: 'nan-ling', region: '关中·南山', label: '南山·峪口爬坡', icon: '⛰',
    desc: '秦岭北麓各峪口、分水岭方向，坡多为折返', anchors: ['沣峪口', '子午大道', '环山路'],
    defaultShape: 'outback', defaultBand: 'hill', corridorIds: [],
  },
  {
    id: 'weihe-west', region: '关中·西', label: '渭河河堤平路', icon: '🏞',
    desc: '渭河/沣河河堤顶路，平缓少车', anchors: ['沣西新城', '咸阳湖', '渭河湿地'],
    defaultShape: 'loop', defaultBand: 'flat', corridorIds: [],
  },
  {
    id: 'greenway', region: '西安·城区', label: '三河一山绿道', icon: '🌳',
    desc: '三河一山/灞河绿道串骑，城郊通达', anchors: ['浐灞', '灞桥生态湿地', '仪祉湖'],
    defaultShape: 'loop', defaultBand: 'flat', corridorIds: [],
  },
]

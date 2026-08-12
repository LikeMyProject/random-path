// ============================================================
// 美食补充数据 — 推荐门店 + 扩充品种
// 与 cities.js 中的 foods 合并使用：优先使用 shop 字段，
// 补充的美食追加到原列表后面
// ============================================================

// 每个城市的美食补充：{ existingShops: { 美食名: 门店 }, extraFoods: [...] }
export const FOOD_SUPPLEMENTS = {
  北京: {
    existingShops: {
      '北京烤鸭': '全聚德 / 四季民福 / 大董',
      '炸酱面': '海碗居 / 方砖厂69号',
      '涮羊肉': '东来顺 / 聚宝源 / 满恒记',
      '豆汁儿焦圈': '尹三豆汁 / 老磁器口豆汁店',
      '卤煮火烧': '小肠陈 / 北新桥卤煮',
      '宫廷糕点': '稻香村 / 富华斋饽饽铺',
    },
    extraFoods: [
      { name: '爆肚', desc: '脆嫩鲜香，蘸麻酱', price: '¥30-50', shop: '爆肚冯 / 金生隆' },
      { name: '炒肝', desc: '猪肠猪肝勾芡蒜香', price: '¥15-25', shop: '姚记炒肝 / 天兴居' },
      { name: '门钉肉饼', desc: '牛肉大葱馅饼', price: '¥20-35', shop: '门钉李 / 合义斋' },
    ],
  },
  天津: {
    existingShops: {
      '狗不理包子': '狗不理总店 / 津门老字号',
      '煎饼果子': '二嫂子煎饼 / 老金煎饼果子',
      '耳朵眼炸糕': '耳朵眼总店',
      '十八街麻花': '桂发祥十八街麻花总店',
      '锅巴菜': '真素诚 / 大福来',
    },
    extraFoods: [
      { name: '老豆腐', desc: '嫩豆腐浇卤汁', price: '¥8-15', shop: '真素诚 / 至美斋' },
      { name: '卷圈', desc: '豆芽腐竹卷起炸', price: '¥8-15', shop: '西北角回民风味' },
      { name: '糖礅儿', desc: '冰糖葫芦天津版', price: '¥10-20', shop: '古文化街小摊' },
      { name: '面茶', desc: '糜子面铺芝麻盐', price: '¥10-15', shop: '西北角早点铺' },
      { name: '茶汤', desc: '高粱面冲壶茶汤', price: '¥10-20', shop: '古文化街 / 食品街' },
    ],
  },
  上海: {
    existingShops: {
      '小笼包': '南翔馒头店 / 佳家汤包',
      '生煎': '大壶春 / 小杨生煎',
      '蟹粉面': '裕兴记 / 哈灵面馆',
      '白斩鸡': '小绍兴 / 振鼎鸡',
      '排骨年糕': '鲜得来 / 北万新',
    },
    extraFoods: [
      { name: '葱油拌面', desc: '葱油酱油香拌面', price: '¥15-25', shop: '沪西老弄堂 / 海强面馆' },
      { name: '蟹壳黄', desc: '酥脆芝麻烧饼', price: '¥8-15', shop: '大壶春 / 老上海点心' },
      { name: '排骨年糕', desc: '炸排骨配年糕', price: '¥20-30', shop: '鲜得来' },
      { name: '油墩子', desc: '萝卜丝糯米炸', price: '¥5-10', shop: '弄堂口小摊' },
    ],
  },
  杭州: {
    existingShops: {
      '西湖醋鱼': '楼外楼 / 知味观',
      '东坡肉': '楼外楼 / 杭州酒家',
      '龙井虾仁': '楼外楼 / 龙井草堂',
      '片儿川': '奎元馆 / 慧娟面馆',
    },
    extraFoods: [
      { name: '叫化鸡', desc: '荷叶泥裹烤鸡', price: '¥80-150', shop: '楼外楼 / 王润兴' },
      { name: '葱包桧', desc: '油条面饼裹葱烤', price: '¥8-15', shop: '孙奶奶葱包桧' },
      { name: '定胜糕', desc: '糯米粉红豆糕', price: '¥8-15', shop: '河坊街传统糕点' },
      { name: '油冬儿', desc: '萝卜丝油炸饼', price: '¥5-10', shop: '街头小摊' },
    ],
  },
  成都: {
    existingShops: {
      '麻婆豆腐': '陈麻婆豆腐 / 蜀九香',
      '担担面': '洞子口张老二凉粉 / 小名堂',
      '夫妻肺片': '夫妻肺片总店 / 蜀九香',
      '钟水饺': '钟水饺总店',
      '龙抄手': '龙抄手总店',
    },
    extraFoods: [
      { name: '钵钵鸡', desc: '冷锅串串泡红油', price: '¥30-60', shop: '廖记棒棒鸡 / 蜀婆娘' },
      { name: '甜水面', desc: '粗面条甜辣酱', price: '¥12-20', shop: '洞子口张老二凉粉' },
      { name: '冒菜', desc: '一人份火锅冒菜', price: '¥25-40', shop: '芙蓉树下 / 三顾冒菜' },
      { name: '兔头', desc: '麻辣/五香兔头', price: '¥15-30', shop: '双流老妈兔头 / 邓氏兔头' },
    ],
  },
  重庆: {
    existingShops: {
      '重庆火锅': '珮姐 / 周师兄 / 朝天门',
      '重庆小面': '花市碗杂面 / 板凳面庄',
      '酸辣粉': '好又来 / 罗汉寺酸辣粉',
      '毛血旺': '磁器口古镇 / 洪崖洞',
    },
    extraFoods: [
      { name: '烤鱼', desc: '万州烤鱼烤盘上桌', price: '¥60-120', shop: '独门冲烤鱼 / 谭谭鱼' },
      { name: '江湖菜', desc: '辣子鸡/水煮鱼', price: '¥50-100', shop: '杨记隆府 / 林中乐辣子鸡' },
      { name: '抄手', desc: '红油抄手馄饨', price: '¥15-25', shop: '老麻抄手 / 吴抄手' },
      { name: '豆花', desc: '嫩豆花蘸辣酱', price: '¥10-20', shop: '梯坎豆花 / 张豆花' },
    ],
  },
  西安: {
    existingShops: {
      '肉夹馍': '秦豫肉夹馍 / 子午路张记',
      '羊肉泡馍': '同盛祥 / 老孙家',
      'biangbiang面': '老白家 / 海荣锅贴',
      '凉皮': '盛志望 / 秦镇刘老三',
    },
    extraFoods: [
      { name: '胡辣汤', desc: '牛肉丸子糊辣汤', price: '¥10-15', shop: '老刘家肉丸糊辣汤' },
      { name: '甑糕', desc: '糯米红枣蒸糕', price: '¥8-15', shop: '东南亚甑糕 / 回民街' },
      { name: '水盆羊肉', desc: '清汤羊肉泡饼', price: '¥25-40', shop: '老白家水盆羊肉' },
      { name: '葫芦鸡', desc: '整鸡蒸煮炸', price: '¥80-150', shop: '西安饭庄' },
    ],
  },
  南京: {
    existingShops: {
      '鸭血粉丝汤': '鸭得堡 / 小潘记',
      '盐水鸭': '韩复兴 / 桂花鸭',
    },
    extraFoods: [
      { name: '牛肉锅贴', desc: '牛肉馅煎饺', price: '¥15-25', shop: '李记清真馆 / 蒋有记' },
      { name: '汤包', desc: '蟹黄/鲜肉汤包', price: '¥25-40', shop: '徐建萍汤包 / 鲁氏汤包' },
      { name: '赤豆元宵', desc: '红豆沙煮元宵', price: '¥12-20', shop: '莲湖糕团店' },
      { name: '糖芋苗', desc: '桂花糖芋苗甜品', price: '¥10-15', shop: '芳婆糕团店' },
    ],
  },
  苏州: {
    existingShops: {
      '松鼠桂鱼': '松鹤楼 / 得月楼',
      '苏式汤面': '裕兴记 / 同得兴',
    },
    extraFoods: [
      { name: '生煎', desc: '苏州风味生煎', price: '¥15-25', shop: '哑巴生煎' },
      { name: '蟹壳黄', desc: '酥脆芝麻烧饼', price: '¥8-12', shop: '黄天源' },
      { name: '桂花糕', desc: '糯米桂花糕', price: '¥10-20', shop: '黄天源 / 采芝斋' },
      { name: '糖粥', desc: '红豆沙白粥', price: '¥12-20', shop: '潘玉麟糖粥' },
    ],
  },
  厦门: {
    existingShops: {
      '沙茶面': '乌糖沙茶面 / 四里沙茶面',
      '海蛎煎': '1980烧肉粽 / 莲欢海蛎煎',
      '土笋冻': '安海土笋冻 / 老二市土笋冻',
    },
    extraFoods: [
      { name: '花生汤', desc: '花生仁酥烂汤甜', price: '¥10-15', shop: '黄则和花生汤' },
      { name: '烧肉粽', desc: '香菇虾米肉粽', price: '¥12-20', shop: '1980烧肉粽' },
      { name: '姜母鸭', desc: '姜麻酱焖鸭', price: '¥50-80', shop: '灌顶姜母鸭 / 银桥姜母鸭' },
      { name: '面线糊', desc: '细面线配大肠醋肉', price: '¥12-20', shop: '阿玲面线糊' },
    ],
  },
  广州: {
    existingShops: {
      '早茶点心': '陶陶居 / 广州酒家 / 点都德',
      '肠粉': '银记肠粉 / 源记肠粉',
      '煲仔饭': '超记煲仔饭 / 祺祺小食店',
    },
    extraFoods: [
      { name: '云吞面', desc: '鲜虾云吞竹升面', price: '¥15-25', shop: '竹升面馆 / 宝华面店' },
      { name: '白切鸡', desc: '清远鸡白切', price: '¥40-80', shop: '清平饭店 / 文记壹心鸡' },
      { name: '牛杂', desc: '萝卜牛杂煲', price: '¥15-30', shop: '阿婆牛杂 / 林林牛杂' },
      { name: '双皮奶', desc: '顺德双皮奶', price: '¥12-20', shop: '南信牛奶甜品专家' },
    ],
  },
  武汉: {
    existingShops: {
      '热干面': '蔡林记 / 顶好牛肉面',
      '豆皮': '老通城 / 严老烧',
    },
    extraFoods: [
      { name: '鸭脖', desc: '麻辣卤鸭脖', price: '¥15-30', shop: '周黑鸭 / 精武鸭脖' },
      { name: '面窝', desc: '米浆炸圈饼', price: '¥5-8', shop: '街头早点摊' },
      { name: '排骨藕汤', desc: '粉藕排骨汤', price: '¥30-50', shop: '亢龙太子酒轩' },
      { name: '糊汤粉', desc: '鱼糊汤配油条', price: '¥10-15', shop: '徐嫂糊汤粉' },
    ],
  },
  长沙: {
    existingShops: {
      '臭豆腐': '黑色经典 / 罗记臭豆腐',
      '糖油粑粑': '李公庙 / 金记糖油粑粑',
    },
    extraFoods: [
      { name: '米粉', desc: '长沙扁粉汤粉', price: '¥10-15', shop: '公交新村粉店 / 周记粉店' },
      { name: '口味虾', desc: '麻辣小龙虾', price: '¥80-150', shop: '文和友 / 盛记海鲜' },
      { name: '剁椒鱼头', desc: '湘菜头牌', price: '¥60-120', shop: '炊烟时代 / 费大厨' },
      { name: '茶颜悦色', desc: '长沙本土奶茶', price: '¥15-20', shop: '茶颜悦色各门店' },
    ],
  },
  青岛: {
    existingShops: {
      '海鲜烧烤': '船歌鱼水饺 / 劈柴院',
    },
    extraFoods: [
      { name: '鲅鱼水饺', desc: '鲜鲅鱼馅水饺', price: '¥30-50', shop: '船歌鱼水饺 / 双合园' },
      { name: '辣炒蛤蜊', desc: '青岛花蛤辣炒', price: '¥25-40', shop: '劈柴院 / 台东夜市' },
      { name: '排骨米饭', desc: '排骨炖汤泡饭', price: '¥20-30', shop: '万年春 / 美达尔' },
      { name: '青岛啤酒', desc: '原浆/纯生鲜啤', price: '¥10-30', shop: '啤酒博物馆 / 街头袋装' },
    ],
  },
  大连: {
    existingShops: {},
    extraFoods: [
      { name: '海鲜焖子', desc: '炒粉块浇海鲜汁', price: '¥15-25', shop: '大连老菜馆' },
      { name: '海胆蒸蛋', desc: '鲜海胆蒸蛋', price: '¥30-60', shop: '日丰园 / 海鲜大排档' },
      { name: '鲅鱼水饺', desc: '鲜鲅鱼馅水饺', price: '¥30-50', shop: '双合园 / 日丰园' },
      { name: '铁板鱿鱼', desc: '大连铁板鲜鱿鱼', price: '¥15-30', shop: '天津街夜市' },
    ],
  },
  丽江: {
    existingShops: {},
    extraFoods: [
      { name: '腊排骨', desc: '腌制排骨火锅', price: '¥50-80', shop: '阿妈意 / 铁拐李' },
      { name: '黑山羊火锅', desc: '高原山羊火锅', price: '¥60-100', shop: '阿寿黑山羊 / 滇厨' },
      { name: '鸡豆凉粉', desc: '丽江特色凉粉', price: '¥10-15', shop: '大石桥凉粉' },
      { name: '纳西烤鱼', desc: '香料烤鲜鱼', price: '¥40-60', shop: '古城纳西餐馆' },
    ],
  },
  桂林: {
    existingShops: {
      '桂林米粉': '崇善米粉 / 明桂米粉',
    },
    extraFoods: [
      { name: '啤酒鱼', desc: '阳朔啤酒剑骨鱼', price: '¥60-100', shop: '谢大姐啤酒鱼 / 彭大厨' },
      { name: '田螺酿', desc: '螺肉猪肉酿田螺', price: '¥30-50', shop: '阳朔西街餐馆' },
      { name: '荔浦芋扣肉', desc: '芋头夹五花肉', price: '¥40-60', shop: '桂林老字号' },
      { name: '油茶', desc: '恭城打油茶', price: '¥15-25', shop: '瑶山油茶馆' },
    ],
  },
  三亚: {
    existingShops: {},
    extraFoods: [
      { name: '文昌鸡', desc: '海南四大名菜之首', price: '¥50-80', shop: '利国餐厅 / 海亚餐厅' },
      { name: '清补凉', desc: '椰奶冰沙甜品', price: '¥15-25', shop: '椰奶清补凉 / 郑阿婆' },
      { name: '海鲜大餐', desc: '龙虾石斑生蚝', price: '¥150-400', shop: '第一市场 / 林姐香味海鲜' },
      { name: '抱罗粉', desc: '海南汤粉', price: '¥12-20', shop: '街边老店' },
    ],
  },
  拉萨: {
    existingShops: {
      '酥油茶': '玛吉阿米 / 仓姑寺茶馆',
    },
    extraFoods: [
      { name: '藏面', desc: '牦牛肉汤面', price: '¥15-25', shop: '光明港琼甜茶馆' },
      { name: '甜茶', desc: '红茶牛奶糖煮', price: '¥8-15', shop: '光明港琼 / 仓姑寺' },
      { name: '牦牛肉', desc: '风干/炖煮牦牛', price: '¥40-80', shop: '雪域餐厅 / 拉萨厨房' },
      { name: '藏式糌粑', desc: '青稞面酥油茶拌', price: '¥10-20', shop: '玛吉阿米 / 雪域餐厅' },
    ],
  },
  哈尔滨: {
    existingShops: {},
    extraFoods: [
      { name: '锅包肉', desc: '酸甜炸肉片', price: '¥30-50', shop: '老厨家 / 哈尔滨餐厅' },
      { name: '红肠', desc: '哈尔滨蒜味红肠', price: '¥20-40', shop: '秋林里道斯 / 哈肉联' },
      { name: '杀猪菜', desc: '血肠酸菜炖猪肉', price: '¥40-60', shop: '老六杀猪菜 / 杀猪菜馆' },
      { name: '马迭尔冰棍', desc: '百年品牌冰棍', price: '¥5-10', shop: '中央大街马迭尔' },
    ],
  },
  乌鲁木齐: {
    existingShops: {},
    extraFoods: [
      { name: '大盘鸡', desc: '土豆鸡肉宽面', price: '¥50-90', shop: '血站大盘鸡 / 柴窝堡' },
      { name: '手抓饭', desc: '胡萝卜羊肉饭', price: '¥25-40', shop: '五月花 / 五一星光夜市' },
      { name: '馕', desc: '馕坑烤饼', price: '¥5-15', shop: '馕王 / 街边馕坑' },
      { name: '架子肉', desc: '铁架烤羊排', price: '¥50-80', shop: '海尔巴格 / 大湾夜市' },
    ],
  },
}

/**
 * 合并补充美食数据到城市 foods 列表
 * 1. 给已有美食添加 shop 字段
 * 2. 追加额外美食
 * 3. 去重（按名称）
 */
export function enrichFoods(cityName, originalFoods = []) {
  const supp = FOOD_SUPPLEMENTS[cityName]
  if (!supp) return originalFoods

  // 1. 给已有美食添加 shop
  const enriched = originalFoods.map(f => {
    if (f.shop) return f
    const shop = supp.existingShops?.[f.name]
    return shop ? { ...f, shop } : f
  })

  // 2. 追加额外美食（去重）
  const existingNames = new Set(enriched.map(f => f.name))
  const extras = (supp.extraFoods || []).filter(f => !existingNames.has(f.name))

  return [...enriched, ...extras]
}

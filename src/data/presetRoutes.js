// ====== ALL 100 PRESET ROUTES (≥30km, most 50km+) ======
export const PRESET_ROUTES = [
  // === 西安经典 (11条) ===
  { name:'西安·三河一山绿道',start:{name:'三河一山起点',lng:109.063,lat:34.314},end:{name:'三河一山起点',lng:109.063,lat:34.314},waypoints:[{name:'灞渭驿',lng:109.010,lat:34.431},{name:'漕渭驿',lng:108.946,lat:34.403},{name:'沣河绿道',lng:108.747,lat:34.323},{name:'仪祉湖',lng:108.764,lat:34.106},{name:'沣峪口转盘',lng:108.822,lat:34.051},{name:'太乙驿',lng:109.015,lat:34.032},{name:'库峪河大桥',lng:109.172,lat:34.028},{name:'半坡驿',lng:109.044,lat:34.267}]},
  { name:'西安·骊山环山路（最美72拐）',start:{name:'骊山索道大门',lng:109.210,lat:34.360},end:{name:'骊山索道大门',lng:109.210,lat:34.360},waypoints:[{name:'骊山牡丹门',lng:109.220,lat:34.350},{name:'骊山天文台',lng:109.230,lat:34.340},{name:'藤原豆腐店',lng:109.240,lat:34.330},{name:'人祖庙',lng:109.250,lat:34.320},{name:'洪庆山',lng:109.180,lat:34.280}]},
  { name:'西安·秦岭分水岭（G210爬坡线）',start:{name:'沣峪口',lng:108.830,lat:34.050},end:{name:'分水岭',lng:108.950,lat:33.880},waypoints:[{name:'净业寺',lng:108.850,lat:34.020},{name:'九龙潭',lng:108.870,lat:33.980},{name:'黎元坪',lng:108.890,lat:33.950},{name:'鸡窝子',lng:108.920,lat:33.920},{name:'广货街',lng:108.800,lat:33.830}]},
  { name:'西安·关中环线串骑峪口',start:{name:'祥峪',lng:108.750,lat:34.000},end:{name:'库峪',lng:109.070,lat:33.920},waypoints:[{name:'高冠峪',lng:108.780,lat:34.020},{name:'沣峪',lng:108.830,lat:34.050},{name:'子午峪',lng:108.870,lat:34.020},{name:'天子峪',lng:108.890,lat:34.010},{name:'石砭峪',lng:108.920,lat:34.000},{name:'太乙峪',lng:108.980,lat:33.980},{name:'小峪',lng:109.010,lat:33.960},{name:'大峪',lng:109.040,lat:33.940}]},
  { name:'西安·大雁塔→祥峪',start:{name:'大雁塔',lng:108.963,lat:34.217},end:{name:'祥峪',lng:108.750,lat:34.000},waypoints:[{name:'秦岭野生动物园',lng:108.868,lat:34.102},{name:'沣峪口',lng:108.830,lat:34.050},{name:'高冠瀑布',lng:108.780,lat:34.020}]},
  { name:'西安·蓝田荞麦岭',start:{name:'蓝田',lng:109.320,lat:34.150},end:{name:'蓝田',lng:109.320,lat:34.150},waypoints:[{name:'九间房镇',lng:109.350,lat:34.120},{name:'荞麦岭',lng:109.380,lat:34.100},{name:'蓝田猿人遗址',lng:109.320,lat:34.080}]},
  { name:'西安·周至骆峪线',start:{name:'周至',lng:108.222,lat:34.163},end:{name:'骆峪',lng:108.120,lat:34.090},waypoints:[{name:'最美环山路',lng:108.200,lat:34.140},{name:'骆峪水库',lng:108.150,lat:34.110}]},
  { name:'西安·秦楚古道穿越线',start:{name:'沣峪口',lng:108.830,lat:34.050},end:{name:'终南山',lng:109.050,lat:33.730},waypoints:[{name:'分水岭',lng:108.950,lat:33.880},{name:'广货街',lng:108.800,lat:33.830},{name:'黄花岭',lng:109.000,lat:33.790},{name:'营盘镇',lng:109.100,lat:33.750}]},
  { name:'西安·蓝关古道',start:{name:'蓝田',lng:109.317,lat:34.152},end:{name:'蓝桥镇',lng:109.370,lat:34.060},waypoints:[{name:'辋川',lng:109.280,lat:34.110},{name:'蓝关古道',lng:109.340,lat:34.090}]},
  { name:'西安·三环全环',start:{name:'曲江',lng:108.99,lat:34.2},end:{name:'曲江',lng:108.99,lat:34.2},waypoints:[{name:'长安立交',lng:108.94,lat:34.19},{name:'西三环',lng:108.83,lat:34.23},{name:'北三环',lng:108.93,lat:34.35},{name:'东三环',lng:109.05,lat:34.3}]},
  { name:'西安·二环全环',start:{name:'辛家庙',lng:108.99,lat:34.31},end:{name:'辛家庙',lng:108.99,lat:34.31},waypoints:[{name:'石家街',lng:109.01,lat:34.27},{name:'沙坡',lng:108.99,lat:34.24},{name:'沙坡西',lng:108.9721,lat:34.2335},{name:'西影路口',lng:108.9406,lat:34.2302},{name:'太白立交',lng:108.92,lat:34.23},{name:'太白立交北',lng:108.9083,lat:34.2371},{name:'土门',lng:108.89,lat:34.26},{name:'丰庆路口',lng:108.8914,lat:34.2756},{name:'大兴立交',lng:108.91,lat:34.29},{name:'未央立交',lng:108.95,lat:34.31}]},

  // === 西安→周边城市 (12条) ===
  { name:'西安→临潼（骊山方向）',start:{name:'十里铺',lng:109.020,lat:34.287},end:{name:'华清池',lng:109.207,lat:34.364},waypoints:[{name:'灞桥',lng:109.059,lat:34.309}]},
  { name:'西安→蓝田（G312东行）',start:{name:'纺织城',lng:109.068,lat:34.261},end:{name:'水陆庵',lng:109.330,lat:34.135},waypoints:[{name:'白鹿原',lng:109.130,lat:34.220},{name:'蓝田县城',lng:109.317,lat:34.152}]},
  { name:'西安→鄠邑区（西户）',start:{name:'西安高新',lng:108.890,lat:34.198},end:{name:'鄠邑区钟楼',lng:108.608,lat:34.112},waypoints:[{name:'秦渡镇',lng:108.730,lat:34.156}]},
  { name:'西安→周至（S107西行）',start:{name:'西安高新',lng:108.890,lat:34.198},end:{name:'周至县城',lng:108.222,lat:34.163},waypoints:[{name:'秦渡镇',lng:108.730,lat:34.156},{name:'鄠邑区',lng:108.608,lat:34.112},{name:'终南镇',lng:108.390,lat:34.140}]},
  { name:'西安→杨凌（渭河河堤路）',start:{name:'沣西新城',lng:108.740,lat:34.270},end:{name:'杨凌',lng:108.070,lat:34.272},waypoints:[{name:'涝渭湿地',lng:108.680,lat:34.240},{name:'耿峪河大桥',lng:108.550,lat:34.220},{name:'黑河大桥',lng:108.250,lat:34.190},{name:'杨凌渭河大桥',lng:108.080,lat:34.260}]},
  { name:'西安→阎良（航空城）',start:{name:'西安北站',lng:108.935,lat:34.377},end:{name:'阎良',lng:109.230,lat:34.656},waypoints:[{name:'高陵区',lng:109.082,lat:34.534}]},
  { name:'西安→渭南（关中平原东行）',start:{name:'临潼',lng:109.207,lat:34.364},end:{name:'渭南',lng:109.502,lat:34.499},waypoints:[{name:'新丰镇',lng:109.290,lat:34.410}]},
  { name:'西安→铜川（G210北上）',start:{name:'张家堡',lng:108.948,lat:34.340},end:{name:'铜川',lng:109.075,lat:35.069},waypoints:[{name:'高陵区',lng:109.082,lat:34.534},{name:'三原县',lng:108.936,lat:34.617},{name:'铜川新区',lng:108.979,lat:34.893}]},
  { name:'西安→商洛（G312蓝小公路）',start:{name:'纺织城',lng:109.068,lat:34.261},end:{name:'商洛',lng:109.918,lat:33.870},waypoints:[{name:'蓝田县城',lng:109.317,lat:34.152},{name:'水陆庵',lng:109.330,lat:34.135},{name:'牧户关隧道',lng:109.570,lat:34.040},{name:'黑龙口镇',lng:109.700,lat:33.980}]},
  { name:'西安→宝鸡（渭河南岸）',start:{name:'西安高新',lng:108.890,lat:34.198},end:{name:'宝鸡',lng:107.238,lat:34.363},waypoints:[{name:'周至县',lng:108.222,lat:34.163},{name:'眉县',lng:107.755,lat:34.274},{name:'岐山县',lng:107.621,lat:34.444}]},
  { name:'西安→汉中（G210翻秦岭）',start:{name:'沣峪口',lng:108.830,lat:34.050},end:{name:'汉中',lng:107.023,lat:33.068},waypoints:[{name:'分水岭',lng:108.950,lat:33.880},{name:'广货街',lng:108.800,lat:33.830},{name:'宁陕县',lng:108.310,lat:33.310},{name:'石泉县',lng:108.247,lat:33.038}]},
  { name:'西安→华山（G310东行）',start:{name:'十里铺',lng:109.020,lat:34.287},end:{name:'华山',lng:110.09,lat:34.49},waypoints:[{name:'临潼',lng:109.207,lat:34.364},{name:'渭南',lng:109.502,lat:34.499},{name:'华州区',lng:109.76,lat:34.512}]},

  // === 西安→远距离城市 (6条) ===
  { name:'西安→延安（G210北上）',start:{name:'西安',lng:108.948,lat:34.340},end:{name:'延安',lng:109.494,lat:36.591},waypoints:[{name:'铜川',lng:109.075,lat:35.069},{name:'金锁关',lng:109.100,lat:35.225},{name:'黄帝陵',lng:109.256,lat:35.580},{name:'洛川县',lng:109.428,lat:35.762}]},
  { name:'西安→安康（G210秦岭段）',start:{name:'沣峪口',lng:108.830,lat:34.050},end:{name:'安康',lng:109.029,lat:32.685},waypoints:[{name:'分水岭',lng:108.950,lat:33.880},{name:'广货街',lng:108.800,lat:33.830},{name:'宁陕县',lng:108.310,lat:33.310},{name:'石泉县',lng:108.247,lat:33.038},{name:'汉阴县',lng:108.510,lat:32.893}]},
  { name:'西安→天水（丝路西行）',start:{name:'西安',lng:108.890,lat:34.198},end:{name:'天水',lng:105.725,lat:34.581},waypoints:[{name:'宝鸡',lng:107.238,lat:34.363},{name:'坪头镇',lng:106.850,lat:34.400},{name:'麦积山石窟',lng:105.990,lat:34.360}]},
  { name:'西安→榆林（G210纵贯陕北）',start:{name:'西安',lng:108.948,lat:34.340},end:{name:'榆林',lng:109.734,lat:38.286},waypoints:[{name:'铜川',lng:109.075,lat:35.069},{name:'黄陵',lng:109.256,lat:35.580},{name:'延安',lng:109.494,lat:36.591},{name:'绥德',lng:110.263,lat:37.503},{name:'米脂',lng:110.184,lat:37.755}]},
  { name:'西安→兰州（G30丝路千里）',start:{name:'西安',lng:108.890,lat:34.198},end:{name:'兰州',lng:103.834,lat:36.062},waypoints:[{name:'宝鸡',lng:107.238,lat:34.363},{name:'天水',lng:105.725,lat:34.581},{name:'定西',lng:104.626,lat:35.581}]},
  { name:'西安→银川（G65北上塞外）',start:{name:'西安北站',lng:108.935,lat:34.377},end:{name:'银川',lng:106.231,lat:38.487},waypoints:[{name:'铜川',lng:109.075,lat:35.069},{name:'延安',lng:109.494,lat:36.591},{name:'靖边',lng:108.806,lat:37.599},{name:'盐池',lng:107.407,lat:37.783}]},

  // === 关中·渭北环线 (2条) ===
  { name:'关中环线S107',start:{name:'西安',lng:108.958,lat:34.379},end:{name:'西安',lng:108.958,lat:34.379},waypoints:[{name:'蓝田县',lng:109.317,lat:34.152},{name:'渭南',lng:109.502,lat:34.499},{name:'阎良',lng:109.230,lat:34.656},{name:'三原县',lng:108.936,lat:34.617},{name:'礼泉县',lng:108.422,lat:34.483},{name:'乾县',lng:108.240,lat:34.528},{name:'扶风法门寺',lng:107.900,lat:34.439},{name:'岐山县',lng:107.621,lat:34.444},{name:'眉县',lng:107.755,lat:34.274},{name:'周至',lng:108.222,lat:34.163},{name:'鄠邑区',lng:108.608,lat:34.112}]},
  { name:'渭北环线（泾阳→三原→富平→阎良→高陵）',start:{name:'泾阳',lng:108.842,lat:34.530},end:{name:'泾阳',lng:108.842,lat:34.530},waypoints:[{name:'三原',lng:108.936,lat:34.617},{name:'富平',lng:109.180,lat:34.751},{name:'阎良',lng:109.230,lat:34.656},{name:'高陵',lng:109.082,lat:34.534},{name:'泾渭分明',lng:109.050,lat:34.460}]},

  // === 秦岭深度穿越 (12条) ===
  { name:'秦岭·鳌太穿越线（太白→鳌山）',start:{name:'太白县',lng:107.319,lat:34.058},end:{name:'太白县',lng:107.319,lat:34.058},waypoints:[{name:'咀头镇',lng:107.300,lat:34.050},{name:'鳌山登山口',lng:107.420,lat:33.950},{name:'塘口村',lng:107.500,lat:33.920},{name:'桃川镇',lng:107.250,lat:34.020}]},
  { name:'秦岭·傥骆道（周至→华阳→佛坪）',start:{name:'周至',lng:108.222,lat:34.163},end:{name:'佛坪',lng:107.990,lat:33.525},waypoints:[{name:'黑河水库',lng:108.180,lat:33.980},{name:'厚畛子',lng:107.950,lat:33.850},{name:'老县城',lng:107.850,lat:33.720},{name:'华阳古镇',lng:107.550,lat:33.590}]},
  { name:'秦岭·黄柏塬环线',start:{name:'太白县',lng:107.319,lat:34.058},end:{name:'太白县',lng:107.319,lat:34.058},waypoints:[{name:'黄柏塬',lng:107.510,lat:33.820},{name:'二郎坝',lng:107.620,lat:33.750},{name:'华阳古镇',lng:107.550,lat:33.590},{name:'核桃坪',lng:107.420,lat:33.880}]},
  { name:'秦岭·紫柏山穿越（留坝→凤县）',start:{name:'留坝',lng:106.921,lat:33.618},end:{name:'凤县',lng:106.524,lat:33.911},waypoints:[{name:'张良庙',lng:106.880,lat:33.650},{name:'紫柏山',lng:106.700,lat:33.720},{name:'留凤关',lng:106.620,lat:33.800}]},
  { name:'秦岭·光头山登顶（分水岭旁线）',start:{name:'沣峪口',lng:108.830,lat:34.050},end:{name:'广货街',lng:108.800,lat:33.830},waypoints:[{name:'净业寺',lng:108.850,lat:34.020},{name:'分水岭',lng:108.950,lat:33.880},{name:'光头山',lng:108.920,lat:33.860},{name:'黄花岭',lng:109.000,lat:33.790}]},
  { name:'秦岭·牛背梁穿越（柞水→广货街）',start:{name:'柞水',lng:109.114,lat:33.686},end:{name:'广货街',lng:108.800,lat:33.830},waypoints:[{name:'牛背梁',lng:108.990,lat:33.760},{name:'营盘镇',lng:109.100,lat:33.750},{name:'秦楚古道',lng:109.030,lat:33.780}]},
  { name:'秦岭·米仓山环线（汉中→南郑→光雾山）',start:{name:'汉中',lng:107.023,lat:33.068},end:{name:'汉中',lng:107.023,lat:33.068},waypoints:[{name:'南郑',lng:106.940,lat:33.000},{name:'红寺湖',lng:106.870,lat:32.910},{name:'米仓山',lng:106.950,lat:32.680},{name:'光雾山',lng:106.990,lat:32.660},{name:'南江',lng:106.829,lat:32.521}]},
  { name:'秦岭·麦积山穿越（宝鸡→天水麦积山）',start:{name:'宝鸡',lng:107.238,lat:34.363},end:{name:'麦积山',lng:105.990,lat:34.360},waypoints:[{name:'坪头镇',lng:106.850,lat:34.400},{name:'东岔',lng:106.550,lat:34.380},{name:'街亭',lng:106.150,lat:34.400}]},
  { name:'秦岭·华阳古镇穿越（洋县→太白）',start:{name:'洋县',lng:107.546,lat:33.223},end:{name:'太白县',lng:107.319,lat:34.058},waypoints:[{name:'华阳古镇',lng:107.550,lat:33.590},{name:'二郎坝',lng:107.620,lat:33.750},{name:'黄柏塬',lng:107.510,lat:33.820}]},
  { name:'秦岭·子午道穿越（子午镇→宁陕）',start:{name:'子午镇',lng:108.870,lat:34.050},end:{name:'宁陕',lng:108.310,lat:33.310},waypoints:[{name:'子午峪',lng:108.890,lat:33.970},{name:'喂子坪',lng:108.870,lat:33.800},{name:'广货街',lng:108.800,lat:33.830},{name:'旬阳坝',lng:108.520,lat:33.510}]},
  { name:'秦岭·G108翻越（周至→佛坪→洋县）',start:{name:'周至',lng:108.222,lat:34.163},end:{name:'洋县',lng:107.546,lat:33.223},waypoints:[{name:'马召',lng:108.230,lat:34.040},{name:'板房子',lng:108.100,lat:33.820},{name:'佛坪',lng:107.990,lat:33.525},{name:'金水',lng:107.800,lat:33.300}]},
  { name:'秦岭·洛南→蓝田（灞源古道）',start:{name:'洛南',lng:110.148,lat:34.091},end:{name:'蓝田',lng:109.317,lat:34.152},waypoints:[{name:'石门',lng:110.080,lat:34.120},{name:'灞源',lng:109.650,lat:34.170},{name:'九间房',lng:109.350,lat:34.120}]},

  // === 西安周边长途环线 (9条) ===
  { name:'西安·沣峪→广货街→牛背梁→营盘→西安（大秦岭环线）',start:{name:'沣峪口',lng:108.830,lat:34.050},end:{name:'西安曲江',lng:108.990,lat:34.200},waypoints:[{name:'分水岭',lng:108.950,lat:33.880},{name:'广货街',lng:108.800,lat:33.830},{name:'黄花岭',lng:109.000,lat:33.790},{name:'牛背梁',lng:108.990,lat:33.760},{name:'营盘镇',lng:109.100,lat:33.750},{name:'太乙宫',lng:108.980,lat:34.000}]},
  { name:'西安·蓝田→商洛→丹凤→洛南→蓝田（商洛大环线）',start:{name:'蓝田',lng:109.317,lat:34.152},end:{name:'蓝田',lng:109.317,lat:34.152},waypoints:[{name:'牧户关',lng:109.570,lat:34.040},{name:'商洛',lng:109.918,lat:33.870},{name:'丹凤',lng:110.332,lat:33.696},{name:'洛南',lng:110.148,lat:34.091},{name:'灞源',lng:109.650,lat:34.170}]},
  { name:'西安·黑河穿越（户县→厚畛子→老县城）',start:{name:'户县',lng:108.608,lat:34.112},end:{name:'老县城',lng:107.850,lat:33.720},waypoints:[{name:'周至',lng:108.222,lat:34.163},{name:'马召',lng:108.230,lat:34.040},{name:'黑河水库',lng:108.180,lat:33.980},{name:'厚畛子',lng:107.950,lat:33.850}]},
  { name:'西安·涝沣环线（鄠邑→涝峪→朱雀→广货街→沣峪→鄠邑）',start:{name:'鄠邑区',lng:108.608,lat:34.112},end:{name:'鄠邑区',lng:108.608,lat:34.112},waypoints:[{name:'涝峪口',lng:108.550,lat:34.000},{name:'朱雀森林公园',lng:108.580,lat:33.800},{name:'广货街',lng:108.800,lat:33.830},{name:'分水岭',lng:108.950,lat:33.880},{name:'沣峪口',lng:108.830,lat:34.050}]},
  { name:'西安·翠华山→南五台→石砭峪→子午峪（终南群穿）',start:{name:'太乙宫',lng:108.980,lat:34.000},end:{name:'子午镇',lng:108.870,lat:34.050},waypoints:[{name:'翠华山山门',lng:109.000,lat:33.970},{name:'南五台山门',lng:108.960,lat:33.960},{name:'石砭峪水库',lng:108.940,lat:33.970},{name:'子午峪口',lng:108.880,lat:34.030}]},
  { name:'西安·骊山→洪庆山→白鹿原（三山连穿）',start:{name:'临潼',lng:109.207,lat:34.364},end:{name:'纺织城',lng:109.068,lat:34.261},waypoints:[{name:'骊山牡丹门',lng:109.220,lat:34.350},{name:'人祖庙',lng:109.250,lat:34.320},{name:'洪庆山',lng:109.180,lat:34.280},{name:'白鹿原',lng:109.130,lat:34.220}]},
  { name:'西安·北站→分水岭',start:{name:'西安北站',lng:108.935,lat:34.377},end:{name:'分水岭',lng:108.950,lat:33.880},waypoints:[{name:'朱宏路',lng:108.920,lat:34.290},{name:'子午大道',lng:108.900,lat:34.150},{name:'沣峪口',lng:108.830,lat:34.050}]},
  { name:'西安·北郊→骊山',start:{name:'行政中心',lng:108.940,lat:34.340},end:{name:'骊山顶',lng:109.240,lat:34.330},waypoints:[{name:'灞桥',lng:109.059,lat:34.309},{name:'临潼',lng:109.207,lat:34.364},{name:'骊山牡丹门',lng:109.220,lat:34.350},{name:'藤原豆腐店',lng:109.235,lat:34.332}]},
  { name:'西安·南郊→楼观台',start:{name:'韦曲',lng:108.940,lat:34.160},end:{name:'楼观台',lng:108.350,lat:34.050},waypoints:[{name:'西沣路',lng:108.880,lat:34.100},{name:'草堂寺',lng:108.680,lat:34.070}]},

  // === 西安→邻省 (8条) ===
  { name:'西安→运城（三省交界）',start:{name:'临潼',lng:109.207,lat:34.364},end:{name:'运城',lng:111.007,lat:35.027},waypoints:[{name:'华阴',lng:110.090,lat:34.490},{name:'潼关',lng:110.247,lat:34.545},{name:'永济',lng:110.448,lat:34.867},{name:'解州',lng:110.840,lat:34.920}]},
  { name:'西安→三门峡（沿黄东行）',start:{name:'渭南',lng:109.502,lat:34.499},end:{name:'三门峡',lng:111.194,lat:34.773},waypoints:[{name:'华阴',lng:110.090,lat:34.490},{name:'潼关',lng:110.247,lat:34.545},{name:'灵宝',lng:110.894,lat:34.518}]},
  { name:'西安→十堰（G70武当方向）',start:{name:'蓝田',lng:109.317,lat:34.152},end:{name:'十堰',lng:110.798,lat:32.629},waypoints:[{name:'商洛',lng:109.918,lat:33.870},{name:'山阳',lng:109.882,lat:33.532},{name:'郧西',lng:110.426,lat:32.993}]},
  { name:'西安→广元（G5入川）',start:{name:'西安',lng:108.890,lat:34.198},end:{name:'广元',lng:105.823,lat:32.434},waypoints:[{name:'汉中',lng:107.023,lat:33.068},{name:'宁强',lng:106.257,lat:32.830},{name:'朝天区',lng:105.890,lat:32.640}]},
  { name:'西安→洛阳（古都双城）',start:{name:'临潼',lng:109.207,lat:34.364},end:{name:'洛阳',lng:112.454,lat:34.620},waypoints:[{name:'渭南',lng:109.502,lat:34.499},{name:'华阴',lng:110.090,lat:34.490},{name:'三门峡',lng:111.194,lat:34.773},{name:'渑池',lng:111.762,lat:34.767}]},
  { name:'西安→平凉（崆峒山方向）',start:{name:'咸阳',lng:108.710,lat:34.336},end:{name:'平凉',lng:106.665,lat:35.543},waypoints:[{name:'礼泉',lng:108.422,lat:34.483},{name:'乾县',lng:108.240,lat:34.528},{name:'长武',lng:107.795,lat:35.206},{name:'泾川',lng:107.368,lat:35.333}]},
  { name:'西安→重庆（G65纵贯川东）',start:{name:'西安',lng:108.890,lat:34.198},end:{name:'重庆',lng:106.551,lat:29.563},waypoints:[{name:'安康',lng:109.029,lat:32.685},{name:'达州',lng:107.468,lat:31.209},{name:'广安',lng:106.633,lat:30.456}]},
  { name:'西安→韩城（沿黄公路南段）',start:{name:'西安北站',lng:108.935,lat:34.377},end:{name:'韩城',lng:110.443,lat:35.479},waypoints:[{name:'阎良',lng:109.230,lat:34.656},{name:'合阳',lng:110.149,lat:35.238},{name:'司马迁祠',lng:110.400,lat:35.380}]},

  // === 陕北黄土高原 (6条) ===
  { name:'延安→榆林（红色走廊）',start:{name:'延安',lng:109.494,lat:36.591},end:{name:'榆林',lng:109.734,lat:38.286},waypoints:[{name:'子长',lng:109.675,lat:37.143},{name:'绥德',lng:110.263,lat:37.503},{name:'米脂',lng:110.184,lat:37.755}]},
  { name:'延安→壶口瀑布（沿黄观光）',start:{name:'延安',lng:109.494,lat:36.591},end:{name:'壶口瀑布',lng:110.444,lat:36.148},waypoints:[{name:'南泥湾',lng:109.780,lat:36.320},{name:'宜川',lng:110.169,lat:36.050}]},
  { name:'延安·梁家河→乾坤湾→延川',start:{name:'延川',lng:110.194,lat:36.878},end:{name:'延川',lng:110.194,lat:36.878},waypoints:[{name:'梁家河',lng:110.080,lat:36.870},{name:'乾坤湾',lng:110.420,lat:36.720},{name:'清水关',lng:110.350,lat:36.770}]},
  { name:'延安→黄陵（黄帝陵环线）',start:{name:'延安',lng:109.494,lat:36.591},end:{name:'延安',lng:109.494,lat:36.591},waypoints:[{name:'富县',lng:109.379,lat:35.988},{name:'洛川',lng:109.428,lat:35.762},{name:'黄帝陵',lng:109.256,lat:35.580},{name:'黄陵',lng:109.256,lat:35.580}]},
  { name:'榆林→佳县（白云山沿黄）',start:{name:'榆林',lng:109.734,lat:38.286},end:{name:'佳县',lng:110.491,lat:38.020},waypoints:[{name:'镇川',lng:109.920,lat:38.050},{name:'白云山',lng:110.500,lat:38.000}]},
  { name:'靖边→吴起（长征会师路）',start:{name:'靖边',lng:108.806,lat:37.599},end:{name:'吴起',lng:108.176,lat:36.927},waypoints:[{name:'志丹',lng:108.769,lat:36.822},{name:'吴起镇',lng:108.176,lat:36.927}]},

  // === 陕南·巴山汉水 (8条) ===
  { name:'汉中→青木川（川陕古道）',start:{name:'汉中',lng:107.023,lat:33.068},end:{name:'青木川',lng:105.580,lat:32.830},waypoints:[{name:'勉县',lng:106.673,lat:33.155},{name:'宁强',lng:106.257,lat:32.830},{name:'阳平关',lng:106.050,lat:32.960}]},
  { name:'汉中→黎坪（巴山秘境）',start:{name:'汉中',lng:107.023,lat:33.068},end:{name:'黎坪',lng:106.580,lat:32.680},waypoints:[{name:'南郑',lng:106.940,lat:33.000},{name:'红庙',lng:106.820,lat:32.780}]},
  { name:'汉中→宝鸡（G316褒斜道）',start:{name:'汉中',lng:107.023,lat:33.068},end:{name:'宝鸡',lng:107.238,lat:34.363},waypoints:[{name:'留坝',lng:106.921,lat:33.618},{name:'太白',lng:107.319,lat:34.058},{name:'凤州',lng:106.770,lat:33.980}]},
  { name:'汉中→镇巴（巴山腹地）',start:{name:'汉中',lng:107.023,lat:33.068},end:{name:'镇巴',lng:107.896,lat:32.537},waypoints:[{name:'西乡',lng:107.766,lat:32.984},{name:'骆家坝',lng:107.550,lat:32.740}]},
  { name:'安康→岚皋（南宫山环线）',start:{name:'安康',lng:109.029,lat:32.685},end:{name:'安康',lng:109.029,lat:32.685},waypoints:[{name:'瀛湖',lng:108.960,lat:32.610},{name:'岚皋',lng:108.902,lat:32.307},{name:'南宫山',lng:109.070,lat:32.220},{name:'花里',lng:109.150,lat:32.450}]},
  { name:'安康→紫阳（汉江画廊）',start:{name:'安康',lng:109.029,lat:32.685},end:{name:'紫阳',lng:108.538,lat:32.519},waypoints:[{name:'流水镇',lng:108.820,lat:32.620},{name:'焕古镇',lng:108.620,lat:32.530}]},
  { name:'商洛→金丝峡（陕南峡谷）',start:{name:'商洛',lng:109.918,lat:33.870},end:{name:'金丝峡',lng:110.560,lat:33.380},waypoints:[{name:'丹凤',lng:110.332,lat:33.696},{name:'商南',lng:110.882,lat:33.531}]},
  { name:'商洛→镇安→柞水（秦岭南麓环线）',start:{name:'商洛',lng:109.918,lat:33.870},end:{name:'商洛',lng:109.918,lat:33.870},waypoints:[{name:'山阳',lng:109.882,lat:33.532},{name:'镇安',lng:109.154,lat:33.423},{name:'柞水',lng:109.114,lat:33.686},{name:'牛背梁',lng:108.990,lat:33.760}]},

  // === 陕西经典追加 (8条) ===
  { name:'西安·浐灞→世博园→洪庆（灞河绿道）',start:{name:'浐灞',lng:109.060,lat:34.320},end:{name:'洪庆山',lng:109.180,lat:34.280},waypoints:[{name:'世博园',lng:109.060,lat:34.320},{name:'广运潭',lng:109.035,lat:34.310},{name:'灞桥',lng:109.059,lat:34.309},{name:'洪庆街道',lng:109.130,lat:34.310}]},
  { name:'西安·长安大道→环山路→汤峪',start:{name:'韦曲',lng:108.940,lat:34.160},end:{name:'汤峪',lng:109.220,lat:34.020},waypoints:[{name:'环山路',lng:108.970,lat:34.050},{name:'太乙宫',lng:108.980,lat:34.000},{name:'南五台',lng:108.960,lat:33.960}]},
  { name:'西安·翠华→太乙→库峪（三峪串骑）',start:{name:'太乙宫',lng:108.980,lat:34.000},end:{name:'库峪',lng:109.070,lat:33.920},waypoints:[{name:'翠华山',lng:109.000,lat:33.970},{name:'南五台',lng:108.960,lat:33.960},{name:'石砭峪',lng:108.940,lat:33.970},{name:'大峪',lng:109.040,lat:33.940}]},
  { name:'铜川→照金→旬邑（红色照金线）',start:{name:'铜川',lng:109.075,lat:35.069},end:{name:'旬邑',lng:108.334,lat:35.112},waypoints:[{name:'照金',lng:108.640,lat:34.960},{name:'石门山',lng:108.520,lat:35.020},{name:'马栏',lng:108.440,lat:35.080}]},
  { name:'渭南→合阳→韩城（黄河湿地）',start:{name:'渭南',lng:109.502,lat:34.499},end:{name:'韩城',lng:110.443,lat:35.479},waypoints:[{name:'大荔',lng:109.942,lat:34.795},{name:'合阳',lng:110.149,lat:35.238},{name:'洽川湿地',lng:110.290,lat:35.300}]},
  { name:'宝鸡→太白→黄柏塬（太洋公路）',start:{name:'宝鸡',lng:107.238,lat:34.363},end:{name:'黄柏塬',lng:107.510,lat:33.820},waypoints:[{name:'太白县',lng:107.319,lat:34.058},{name:'鳌山登山口',lng:107.420,lat:33.950},{name:'核桃坪',lng:107.420,lat:33.880}]},
  { name:'汉中→宁强→广坪（汉江源头）',start:{name:'汉中',lng:107.023,lat:33.068},end:{name:'广坪',lng:105.990,lat:32.780},waypoints:[{name:'宁强',lng:106.257,lat:32.830},{name:'汉江源',lng:106.150,lat:32.810},{name:'燕子砭',lng:106.030,lat:32.850}]},
  { name:'商洛→洛南→巡检（洛河峡谷）',start:{name:'商洛',lng:109.918,lat:33.870},end:{name:'巡检',lng:110.220,lat:34.280},waypoints:[{name:'洛南',lng:110.148,lat:34.091},{name:'石门',lng:110.080,lat:34.120},{name:'洛河峡谷',lng:110.160,lat:34.200}]},

  // === 咸阳及周边 (3条) ===
  { name:'咸阳·五陵塬骑行',start:{name:'咸阳钟楼',lng:108.710,lat:34.336},end:{name:'咸阳钟楼',lng:108.710,lat:34.336},waypoints:[{name:'汉阳陵',lng:108.780,lat:34.370},{name:'长陵',lng:108.820,lat:34.390},{name:'安陵',lng:108.850,lat:34.400},{name:'渭河横桥',lng:108.790,lat:34.380}]},
  { name:'咸阳→乾陵→法门寺（盛唐文化线）',start:{name:'咸阳',lng:108.710,lat:34.336},end:{name:'法门寺',lng:107.900,lat:34.439},waypoints:[{name:'礼泉',lng:108.422,lat:34.483},{name:'乾陵',lng:108.220,lat:34.570},{name:'扶风',lng:107.870,lat:34.360}]},
  { name:'渭河全程（宝鸡峡→潼关）',start:{name:'宝鸡峡',lng:107.080,lat:34.380},end:{name:'潼关',lng:110.247,lat:34.545},waypoints:[{name:'杨凌',lng:108.070,lat:34.272},{name:'咸阳',lng:108.710,lat:34.336},{name:'西安北郊',lng:108.950,lat:34.350},{name:'临潼',lng:109.207,lat:34.364},{name:'华阴',lng:110.090,lat:34.490}]},

  // === 陕西→周边新增长途 (4条) ===
  { name:'西安→陇县（关山草原）',start:{name:'宝鸡',lng:107.238,lat:34.363},end:{name:'关山草原',lng:106.450,lat:34.890},waypoints:[{name:'千阳',lng:107.132,lat:34.643},{name:'陇县',lng:106.864,lat:34.893}]},
  { name:'延安→吴起（长征终点）',start:{name:'延安',lng:109.494,lat:36.591},end:{name:'吴起',lng:108.176,lat:36.927},waypoints:[{name:'志丹',lng:108.769,lat:36.822},{name:'铁边城',lng:108.080,lat:36.950}]},
  { name:'汉中→凤县（G316秦岭南麓）',start:{name:'汉中',lng:107.023,lat:33.068},end:{name:'凤县',lng:106.524,lat:33.911},waypoints:[{name:'留坝',lng:106.921,lat:33.618},{name:'柴关岭',lng:106.950,lat:33.780},{name:'留凤关',lng:106.620,lat:33.800}]},
  { name:'宝鸡→陇南（S212入甘）',start:{name:'宝鸡',lng:107.238,lat:34.363},end:{name:'陇南',lng:104.922,lat:33.401},waypoints:[{name:'凤县',lng:106.524,lat:33.911},{name:'两当',lng:106.305,lat:33.910},{name:'徽县',lng:106.088,lat:33.769},{name:'成县',lng:105.742,lat:33.751}]},

  // === 秦岭追加 (3条) ===
  { name:'秦岭·太平峪→朱雀→冰晶顶',start:{name:'太平口',lng:108.630,lat:34.020},end:{name:'冰晶顶',lng:108.710,lat:33.870},waypoints:[{name:'太平森林公园',lng:108.620,lat:33.970},{name:'朱雀森林公园',lng:108.580,lat:33.800},{name:'营盘沟',lng:108.650,lat:33.830}]},
  { name:'秦岭·柞水溶洞→凤凰古镇',start:{name:'柞水',lng:109.114,lat:33.686},end:{name:'凤凰古镇',lng:109.290,lat:33.320},waypoints:[{name:'柞水溶洞',lng:109.150,lat:33.620},{name:'小岭',lng:109.200,lat:33.480},{name:'杏坪',lng:109.260,lat:33.390}]},
  { name:'秦岭·蓝田→葛牌古镇→文公岭',start:{name:'蓝田',lng:109.317,lat:34.152},end:{name:'葛牌古镇',lng:109.510,lat:33.890},waypoints:[{name:'辋川',lng:109.280,lat:34.110},{name:'草坪',lng:109.380,lat:34.000},{name:'文公岭',lng:109.490,lat:33.940}]},

  // === 陕西新增 (2条) ===
  { name:'西安→礼泉→乾县→永寿→彬州（G312西行）',start:{name:'咸阳',lng:108.710,lat:34.336},end:{name:'彬州',lng:108.081,lat:35.036},waypoints:[{name:'礼泉',lng:108.422,lat:34.483},{name:'乾县',lng:108.240,lat:34.528},{name:'永寿',lng:108.143,lat:34.692}]},
  { name:'延安→志丹→吴起→定边（陕北长城线）',start:{name:'延安',lng:109.494,lat:36.591},end:{name:'定边',lng:107.601,lat:37.595},waypoints:[{name:'志丹',lng:108.769,lat:36.822},{name:'吴起',lng:108.176,lat:36.927},{name:'铁边城',lng:108.080,lat:36.950}]},

  // === 陕南追加 (2条) ===
  { name:'安康→白河（汉江顺流）',start:{name:'安康',lng:109.029,lat:32.685},end:{name:'白河',lng:110.113,lat:32.809},waypoints:[{name:'旬阳',lng:109.365,lat:32.834},{name:'蜀河古镇',lng:109.710,lat:32.870}]},
  { name:'汉中→略阳（嘉陵江峡谷）',start:{name:'汉中',lng:107.023,lat:33.068},end:{name:'略阳',lng:106.157,lat:33.327},waypoints:[{name:'勉县',lng:106.673,lat:33.155},{name:'茶店',lng:106.480,lat:33.220},{name:'何家岩',lng:106.280,lat:33.290}]},

  // === 陕西追加 (4条) ===
  { name:'西安·太白山穿越（汤峪→拔仙台→厚畛子）',start:{name:'汤峪',lng:107.920,lat:34.110},end:{name:'厚畛子',lng:107.950,lat:33.850},waypoints:[{name:'下板寺',lng:107.820,lat:34.020},{name:'上板寺',lng:107.800,lat:34.000},{name:'拔仙台',lng:107.760,lat:33.960},{name:'南天门',lng:107.800,lat:33.900}]},
  { name:'安康→平利→镇坪（化龙山脉）',start:{name:'安康',lng:109.029,lat:32.685},end:{name:'镇坪',lng:109.527,lat:31.884},waypoints:[{name:'平利',lng:109.362,lat:32.389},{name:'八仙',lng:109.380,lat:32.200},{name:'化龙山',lng:109.450,lat:32.050}]},
  { name:'榆林·红碱淖环湖',start:{name:'榆林',lng:109.734,lat:38.286},end:{name:'榆林',lng:109.734,lat:38.286},waypoints:[{name:'神木',lng:110.499,lat:38.842},{name:'红碱淖',lng:110.040,lat:38.980},{name:'尔林兔',lng:109.920,lat:38.920},{name:'大保当',lng:109.850,lat:38.600}]},
  { name:'延安·南泥湾→云岩→壶口（延壶公路）',start:{name:'南泥湾',lng:109.780,lat:36.320},end:{name:'壶口瀑布',lng:110.444,lat:36.148},waypoints:[{name:'麻洞川',lng:109.880,lat:36.230},{name:'云岩',lng:110.050,lat:36.140},{name:'高柏',lng:110.250,lat:36.110}]},
]

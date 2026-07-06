<script setup>
import { ref, computed } from 'vue'
import { loadAddresses } from '../composables/useStorage.js'
import { fetchBicyclingRoute } from '../composables/useAMap.js'
import { rateDifficulty } from '../composables/useScoring.js'
import { useSuggest } from '../composables/useAutoComplete.js'
import { nameWaypoint, buildNavUrl, openNavigation, buildGPX, calcCalories } from '../composables/useRouteEngine.js'
import RouteThumbnail from '../components/RouteThumbnail.vue'

const toast = (m, t) => window.$toast?.(m, t)
const addresses = loadAddresses()
const { suggestions, showSuggest, searchAddress, pickSuggestion, closeSuggest } = useSuggest()

// ====== ALL 90+ PRESET ROUTES ======
const PRESET_ROUTES = [
  { name:'西安·三河一山绿道',start:{name:'隆源国际城',lng:108.958,lat:34.379},end:{name:'隆源国际城',lng:108.958,lat:34.379},waypoints:[{name:'三河一山起点',lng:109.063,lat:34.314},{name:'灞渭驿',lng:109.010,lat:34.431},{name:'漕渭驿',lng:108.946,lat:34.403},{name:'沣河绿道',lng:108.747,lat:34.323},{name:'仪祉湖',lng:108.764,lat:34.106},{name:'沣峪口转盘',lng:108.822,lat:34.051},{name:'太乙驿',lng:109.015,lat:34.032},{name:'库峪河大桥',lng:109.172,lat:34.028},{name:'半坡驿',lng:109.044,lat:34.267}]},
  { name:'西安·骊山环山路（最美72拐）',start:{name:'隆源国际城',lng:108.958,lat:34.379},end:{name:'隆源国际城',lng:108.958,lat:34.379},waypoints:[{name:'骊山索道大门',lng:109.210,lat:34.360},{name:'骊山牡丹门',lng:109.220,lat:34.350},{name:'骊山天文台',lng:109.230,lat:34.340},{name:'藤原豆腐店',lng:109.240,lat:34.330},{name:'人祖庙',lng:109.250,lat:34.320},{name:'洪庆山',lng:109.180,lat:34.280}]},
  { name:'西安·秦岭分水岭（G210爬坡线）',start:{name:'沣峪口',lng:108.830,lat:34.050},end:{name:'分水岭',lng:108.950,lat:33.880},waypoints:[{name:'净业寺',lng:108.850,lat:34.020},{name:'九龙潭',lng:108.870,lat:33.980},{name:'黎元坪',lng:108.890,lat:33.950},{name:'鸡窝子',lng:108.920,lat:33.920},{name:'广货街',lng:108.800,lat:33.830}]},
  { name:'西安·城墙环线',start:{name:'永宁门',lng:108.948,lat:34.254},end:{name:'永宁门',lng:108.948,lat:34.254},waypoints:[{name:'长乐门',lng:108.970,lat:34.263},{name:'安远门',lng:108.948,lat:34.274},{name:'安定门',lng:108.926,lat:34.263}]},
  { name:'西安·曲江池盛唐文化线',start:{name:'大雁塔',lng:108.963,lat:34.217},end:{name:'寒窑',lng:108.993,lat:34.199},waypoints:[{name:'大唐芙蓉园',lng:108.977,lat:34.213},{name:'曲江池遗址公园',lng:108.985,lat:34.206}]},
  { name:'西安·昆明池七夕公园环湖',start:{name:'昆明池',lng:108.771,lat:34.233},end:{name:'昆明池',lng:108.771,lat:34.233},waypoints:[{name:'七夕公园',lng:108.780,lat:34.228},{name:'沐云亭',lng:108.786,lat:34.220},{name:'湖光桥',lng:108.776,lat:34.217}]},
  { name:'西安·后海灞河东路',start:{name:'后海',lng:109.020,lat:34.365},end:{name:'水牛广场',lng:109.045,lat:34.325},waypoints:[{name:'灞河东路',lng:109.033,lat:34.345}]},
  { name:'西安·顺城巷慢行',start:{name:'朱雀门',lng:108.938,lat:34.257},end:{name:'西南城角',lng:108.923,lat:34.260},waypoints:[{name:'勿幕门',lng:108.933,lat:34.257},{name:'含光门',lng:108.928,lat:34.257}]},
  { name:'西安·穿行城市街巷',start:{name:'莲湖公园',lng:108.935,lat:34.275},end:{name:'湘子庙',lng:108.943,lat:34.256},waypoints:[{name:'钟楼',lng:108.947,lat:34.261},{name:'德福巷',lng:108.944,lat:34.258}]},
  { name:'西安·环山旅游公路鄠邑段',start:{name:'吕公西路',lng:108.608,lat:34.110},end:{name:'版本馆',lng:108.575,lat:34.060},waypoints:[{name:'涝河大桥',lng:108.595,lat:34.090},{name:'天桥湖',lng:108.580,lat:34.075}]},
  { name:'西安·长安绿道（西沣路→南横线）',start:{name:'西沣路口',lng:108.838,lat:34.180},end:{name:'南横线终点',lng:108.980,lat:34.138},waypoints:[{name:'长安公园',lng:108.910,lat:34.149}]},
  { name:'西安·浐灞世博园滨水线',start:{name:'世博园',lng:109.060,lat:34.320},end:{name:'浐灞湿地',lng:109.030,lat:34.395},waypoints:[{name:'长安塔',lng:109.064,lat:34.314}]},
  { name:'西安·杜邑遗址公园',start:{name:'踏青路',lng:108.965,lat:34.191},end:{name:'唐苑北路',lng:108.975,lat:34.183},waypoints:[{name:'登高路',lng:108.970,lat:34.188}]},
  { name:'西安·大雁塔→祥峪',start:{name:'大雁塔',lng:108.963,lat:34.217},end:{name:'祥峪',lng:108.750,lat:34.000},waypoints:[{name:'秦岭野生动物园',lng:108.868,lat:34.102},{name:'沣峪口',lng:108.830,lat:34.050},{name:'高冠瀑布',lng:108.780,lat:34.020}]},
  { name:'西安·关中环线串骑峪口',start:{name:'祥峪',lng:108.750,lat:34.000},end:{name:'库峪',lng:109.070,lat:33.920},waypoints:[{name:'高冠峪',lng:108.780,lat:34.020},{name:'沣峪',lng:108.830,lat:34.050},{name:'子午峪',lng:108.870,lat:34.020},{name:'天子峪',lng:108.890,lat:34.010},{name:'石砭峪',lng:108.920,lat:34.000},{name:'太乙峪',lng:108.980,lat:33.980},{name:'小峪',lng:109.010,lat:33.960},{name:'大峪',lng:109.040,lat:33.940}]},
  { name:'西安·蓝田荞麦岭',start:{name:'蓝田',lng:109.320,lat:34.150},end:{name:'蓝田',lng:109.320,lat:34.150},waypoints:[{name:'九间房镇',lng:109.350,lat:34.120},{name:'荞麦岭',lng:109.380,lat:34.100},{name:'蓝田猿人遗址',lng:109.320,lat:34.080}]},
  { name:'西安·周至骆峪线',start:{name:'周至',lng:108.222,lat:34.163},end:{name:'骆峪',lng:108.120,lat:34.090},waypoints:[{name:'最美环山路',lng:108.200,lat:34.140},{name:'骆峪水库',lng:108.150,lat:34.110}]},
  { name:'西安·秦楚古道穿越线',start:{name:'沣峪口',lng:108.830,lat:34.050},end:{name:'终南山',lng:109.050,lat:33.730},waypoints:[{name:'分水岭',lng:108.950,lat:33.880},{name:'广货街',lng:108.800,lat:33.830},{name:'黄花岭',lng:109.000,lat:33.790},{name:'营盘镇',lng:109.100,lat:33.750}]},
  { name:'西安·蓝关古道',start:{name:'蓝田',lng:109.317,lat:34.152},end:{name:'蓝桥镇',lng:109.370,lat:34.060},waypoints:[{name:'辋川',lng:109.280,lat:34.110},{name:'蓝关古道',lng:109.340,lat:34.090}]},
  { name:'西安·沣河绿道单独段',start:{name:'沣河入渭口',lng:108.820,lat:34.360},end:{name:'沣河大桥',lng:108.760,lat:34.180},waypoints:[{name:'沣河森林公园',lng:108.740,lat:34.290},{name:'沣河湿地公园',lng:108.750,lat:34.250}]},
  { name:'西安→咸阳（河堤路）',start:{name:'西安三桥',lng:108.820,lat:34.310},end:{name:'咸阳钟楼',lng:108.710,lat:34.336},waypoints:[{name:'沣河森林公园',lng:108.740,lat:34.290},{name:'咸阳渭河大桥',lng:108.710,lat:34.320}]},
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
  { name:'西安→延安（G210北上）',start:{name:'西安',lng:108.948,lat:34.340},end:{name:'延安',lng:109.494,lat:36.591},waypoints:[{name:'铜川',lng:109.075,lat:35.069},{name:'金锁关',lng:109.100,lat:35.225},{name:'黄帝陵',lng:109.256,lat:35.580},{name:'洛川县',lng:109.428,lat:35.762}]},
  { name:'西安→安康（G210秦岭段）',start:{name:'沣峪口',lng:108.830,lat:34.050},end:{name:'安康',lng:109.029,lat:32.685},waypoints:[{name:'分水岭',lng:108.950,lat:33.880},{name:'广货街',lng:108.800,lat:33.830},{name:'宁陕县',lng:108.310,lat:33.310},{name:'石泉县',lng:108.247,lat:33.038},{name:'汉阴县',lng:108.510,lat:32.893}]},
  { name:'西安→天水（丝路西行）',start:{name:'西安',lng:108.890,lat:34.198},end:{name:'天水',lng:105.725,lat:34.581},waypoints:[{name:'宝鸡',lng:107.238,lat:34.363},{name:'坪头镇',lng:106.850,lat:34.400},{name:'麦积山石窟',lng:105.990,lat:34.360}]},
  { name:'关中环线S107',start:{name:'西安',lng:108.958,lat:34.379},end:{name:'西安',lng:108.958,lat:34.379},waypoints:[{name:'蓝田县',lng:109.317,lat:34.152},{name:'渭南',lng:109.502,lat:34.499},{name:'阎良',lng:109.230,lat:34.656},{name:'三原县',lng:108.936,lat:34.617},{name:'礼泉县',lng:108.422,lat:34.483},{name:'乾县',lng:108.240,lat:34.528},{name:'扶风法门寺',lng:107.900,lat:34.439},{name:'岐山县',lng:107.621,lat:34.444},{name:'眉县',lng:107.755,lat:34.274},{name:'周至',lng:108.222,lat:34.163},{name:'鄠邑区',lng:108.608,lat:34.112}]},
  { name:'西安→高陵（泾渭分明）',start:{name:'西安北站',lng:108.935,lat:34.377},end:{name:'高陵',lng:109.082,lat:34.534},waypoints:[{name:'泾渭湿地',lng:109.03,lat:34.42},{name:'泾渭分明',lng:109.05,lat:34.46}]},
  { name:'西安→乾县·经礼泉北上',start:{name:'礼泉',lng:108.480,lat:34.480},end:{name:'乾县',lng:108.240,lat:34.530},waypoints:[{name:'乾陵南门',lng:108.220,lat:34.550}]},
  { name:'西安→华山（G310东行）',start:{name:'十里铺',lng:109.020,lat:34.287},end:{name:'华山',lng:110.09,lat:34.49},waypoints:[{name:'临潼',lng:109.207,lat:34.364},{name:'渭南',lng:109.502,lat:34.499},{name:'华州区',lng:109.76,lat:34.512}]},
  { name:'西安·二环全环',start:{name:'辛家庙',lng:108.99,lat:34.31},end:{name:'辛家庙',lng:108.99,lat:34.31},waypoints:[{name:'石家街',lng:109.01,lat:34.27},{name:'沙坡',lng:108.99,lat:34.24},{name:'太白立交',lng:108.92,lat:34.23},{name:'土门',lng:108.89,lat:34.26},{name:'大兴立交',lng:108.91,lat:34.29},{name:'未央立交',lng:108.95,lat:34.31}]},
  { name:'西安·三环全环',start:{name:'曲江',lng:108.99,lat:34.2},end:{name:'曲江',lng:108.99,lat:34.2},waypoints:[{name:'长安立交',lng:108.94,lat:34.19},{name:'西三环',lng:108.83,lat:34.23},{name:'北三环',lng:108.93,lat:34.35},{name:'东三环',lng:109.05,lat:34.3}]},
  { name:'西安·高新区环线',start:{name:'科技路',lng:108.89,lat:34.23},end:{name:'科技路',lng:108.89,lat:34.23},waypoints:[{name:'锦业路',lng:108.87,lat:34.19},{name:'西太路',lng:108.85,lat:34.17},{name:'唐延路',lng:108.89,lat:34.22},{name:'高新路',lng:108.9,lat:34.24}]},
  { name:'西安·曲江新区环线',start:{name:'大雁塔南广场',lng:108.963,lat:34.217},end:{name:'大雁塔南广场',lng:108.963,lat:34.217},waypoints:[{name:'大唐芙蓉园西门',lng:108.977,lat:34.213},{name:'曲江池西路',lng:108.99,lat:34.205},{name:'南湖东路',lng:108.985,lat:34.195},{name:'芙蓉西路',lng:108.97,lat:34.208},{name:'慈恩路',lng:108.96,lat:34.215}]},
  { name:'西安·经开→未央湖→浐灞环线',start:{name:'行政中心',lng:108.94,lat:34.34},end:{name:'行政中心',lng:108.94,lat:34.34},waypoints:[{name:'未央湖',lng:108.97,lat:34.39},{name:'浐灞湿地',lng:109.03,lat:34.395},{name:'世博园',lng:109.06,lat:34.32},{name:'广运潭',lng:109.035,lat:34.31},{name:'凤城五路',lng:108.96,lat:34.33}]},
  { name:'秦岭·子午峪',start:{name:'子午镇',lng:108.87,lat:34.05},end:{name:'子午峪顶',lng:108.89,lat:33.97},waypoints:[{name:'金仙观',lng:108.87,lat:34.02},{name:'土地梁',lng:108.88,lat:33.99}]},
  { name:'秦岭·沣峪→净业寺→观音山',start:{name:'沣峪口',lng:108.83,lat:34.05},end:{name:'九龙潭',lng:108.87,lat:33.98},waypoints:[{name:'净业寺',lng:108.85,lat:34.02},{name:'观音山',lng:108.87,lat:33.99}]},
  { name:'秦岭·祥峪',start:{name:'祥峪口',lng:108.75,lat:34},end:{name:'祥峪顶',lng:108.76,lat:33.95},waypoints:[{name:'祥峪森林公园',lng:108.75,lat:33.98}]},
  { name:'秦岭·高冠峪',start:{name:'高冠瀑布',lng:108.78,lat:34.02},end:{name:'高冠顶',lng:108.78,lat:33.95},waypoints:[{name:'高冠峪',lng:108.77,lat:33.99}]},
  { name:'秦岭·太平峪',start:{name:'太平口',lng:108.63,lat:34.02},end:{name:'彩虹瀑布',lng:108.61,lat:33.93},waypoints:[{name:'太平森林公园',lng:108.62,lat:33.97}]},
  { name:'秦岭·涝峪',start:{name:'涝峪口',lng:108.55,lat:34},end:{name:'涝峪深处',lng:108.5,lat:33.88},waypoints:[{name:'纸坊',lng:108.52,lat:33.93}]},
  { name:'秦岭·太乙峪→翠华山',start:{name:'太乙宫',lng:108.98,lat:34},end:{name:'翠华山天池',lng:109.01,lat:33.94},waypoints:[{name:'翠华山山门',lng:109,lat:33.97}]},
  { name:'秦岭·南五台',start:{name:'五台镇',lng:108.95,lat:33.98},end:{name:'南五台顶',lng:108.97,lat:33.93},waypoints:[{name:'南五台山门',lng:108.96,lat:33.96}]},
  { name:'秦岭·石砭峪',start:{name:'石砭峪口',lng:108.93,lat:34.01},end:{name:'石砭峪顶',lng:108.95,lat:33.94},waypoints:[{name:'石砭峪水库',lng:108.94,lat:33.97}]},
  { name:'秦岭·小峪',start:{name:'小峪口',lng:109.01,lat:33.99},end:{name:'小峪深处',lng:109.03,lat:33.93},waypoints:[{name:'小峪水库',lng:109.02,lat:33.96}]},
  { name:'秦岭·大峪',start:{name:'大峪口',lng:109.04,lat:33.98},end:{name:'大峪顶',lng:109.06,lat:33.92},waypoints:[{name:'大峪水库',lng:109.05,lat:33.95}]},
  { name:'秦岭·库峪',start:{name:'库峪口',lng:109.07,lat:33.97},end:{name:'库峪顶',lng:109.09,lat:33.91},waypoints:[{name:'库峪水库',lng:109.08,lat:33.94}]},
  { name:'秦岭·辋峪→王顺山',start:{name:'蓝田',lng:109.317,lat:34.152},end:{name:'王顺山',lng:109.31,lat:34.05},waypoints:[{name:'辋川',lng:109.280,lat:34.110},{name:'辋峪口',lng:109.290,lat:34.080}]},
  { name:'西安·大明宫→汉城湖',start:{name:'大明宫',lng:108.966,lat:34.295},end:{name:'汉城湖',lng:108.918,lat:34.304},waypoints:[{name:'龙首原',lng:108.948,lat:34.293},{name:'大兴东路',lng:108.922,lat:34.290}]},
  { name:'西安·钟楼→大雁塔',start:{name:'钟楼',lng:108.948,lat:34.261},end:{name:'大雁塔',lng:108.963,lat:34.219},waypoints:[{name:'南门永宁门',lng:108.948,lat:34.255},{name:'南稍门',lng:108.948,lat:34.245},{name:'小寨',lng:108.948,lat:34.228}]},
  { name:'西安·南门→曲江池遗址',start:{name:'南门',lng:108.948,lat:34.255},end:{name:'曲江池',lng:108.990,lat:34.210},waypoints:[{name:'文昌门',lng:108.956,lat:34.254},{name:'西安交大北门',lng:108.980,lat:34.250},{name:'青龙寺',lng:108.990,lat:34.240}]},
  { name:'西安·小寨→高新区',start:{name:'小寨',lng:108.948,lat:34.228},end:{name:'高新',lng:108.895,lat:34.230},waypoints:[{name:'吉祥村',lng:108.930,lat:34.228},{name:'科技路',lng:108.900,lat:34.230}]},
  { name:'西安·高校巡礼',start:{name:'西安交大',lng:108.980,lat:34.250},end:{name:'西电',lng:108.920,lat:34.235},waypoints:[{name:'长安大学',lng:108.955,lat:34.240},{name:'西北工业大学',lng:108.910,lat:34.245}]},
  { name:'西安·汉长安城遗址',start:{name:'汉城湖',lng:108.918,lat:34.304},end:{name:'建章宫',lng:108.860,lat:34.300},waypoints:[{name:'未央宫遗址',lng:108.895,lat:34.310},{name:'长乐宫遗址',lng:108.880,lat:34.295}]},
  { name:'西安·大明宫→兴庆宫',start:{name:'大明宫',lng:108.966,lat:34.295},end:{name:'兴庆宫',lng:108.978,lat:34.255},waypoints:[{name:'含元殿',lng:108.968,lat:34.285},{name:'长乐门',lng:108.965,lat:34.260}]},
  { name:'西安·青龙寺→大唐芙蓉园',start:{name:'青龙寺',lng:108.990,lat:34.240},end:{name:'大唐芙蓉园',lng:108.978,lat:34.215},waypoints:[{name:'大雁塔北广场',lng:108.963,lat:34.219}]},
  { name:'西安·公园串烧北线',start:{name:'文景公园',lng:108.94,lat:34.33},end:{name:'桃花潭',lng:109.04,lat:34.33},waypoints:[{name:'城市运动公园',lng:108.94,lat:34.35},{name:'未央湖',lng:108.97,lat:34.39},{name:'浐灞湿地',lng:109.03,lat:34.395}]},
  { name:'西安·公园串烧南线',start:{name:'木塔寺',lng:108.88,lat:34.21},end:{name:'兴庆公园',lng:108.987,lat:34.25},waypoints:[{name:'唐城墙遗址公园',lng:108.9,lat:34.21},{name:'曲江池',lng:108.985,lat:34.206},{name:'大唐芙蓉园',lng:108.977,lat:34.213}]},
  { name:'西安·公园串烧西线',start:{name:'丰庆公园',lng:108.91,lat:34.25},end:{name:'阿房宫',lng:108.82,lat:34.27},waypoints:[{name:'牡丹苑',lng:108.89,lat:34.25},{name:'汉城湖',lng:108.91,lat:34.29}]},
  { name:'西安·公园串烧东线',start:{name:'兴庆公园',lng:108.987,lat:34.25},end:{name:'桃花潭',lng:109.04,lat:34.33},waypoints:[{name:'长乐公园',lng:109.01,lat:34.26},{name:'半坡遗址',lng:109.05,lat:34.27}]},
  { name:'西安·曲江→子午峪',start:{name:'曲江',lng:108.99,lat:34.2},end:{name:'子午镇',lng:108.87,lat:34.05},waypoints:[{name:'韦曲',lng:108.94,lat:34.16},{name:'子午大道',lng:108.9,lat:34.1}]},
  { name:'西安·高新→沣峪口',start:{name:'西安高新',lng:108.89,lat:34.23},end:{name:'沣峪口',lng:108.83,lat:34.05},waypoints:[{name:'西沣路',lng:108.88,lat:34.18},{name:'郭杜',lng:108.87,lat:34.15}]},
  { name:'西安·北站→分水岭',start:{name:'西安北站',lng:108.935,lat:34.377},end:{name:'分水岭',lng:108.95,lat:33.88},waypoints:[{name:'朱宏路',lng:108.92,lat:34.29},{name:'子午大道',lng:108.9,lat:34.15},{name:'沣峪口',lng:108.83,lat:34.05}]},
  { name:'西安·东郊→洪庆山',start:{name:'纺织城',lng:109.068,lat:34.261},end:{name:'人祖庙',lng:109.25,lat:34.32},waypoints:[{name:'洪庆街道',lng:109.13,lat:34.31},{name:'洪庆山森林公园',lng:109.18,lat:34.28}]},
  { name:'西安·北郊→骊山',start:{name:'行政中心',lng:108.94,lat:34.34},end:{name:'骊山顶',lng:109.24,lat:34.33},waypoints:[{name:'灞桥',lng:109.059,lat:34.309},{name:'临潼',lng:109.207,lat:34.364},{name:'骊山牡丹门',lng:109.22,lat:34.35},{name:'藤原豆腐店',lng:109.235,lat:34.332}]},
  { name:'西安·南郊→楼观台',start:{name:'韦曲',lng:108.94,lat:34.16},end:{name:'楼观台',lng:108.35,lat:34.05},waypoints:[{name:'西沣路',lng:108.88,lat:34.1},{name:'草堂寺',lng:108.68,lat:34.07}]},
  { name:'西安·寺庙之旅',start:{name:'大兴善寺',lng:108.94,lat:34.24},end:{name:'青龙寺',lng:109,lat:34.23},waypoints:[{name:'荐福寺小雁塔',lng:108.94,lat:34.24},{name:'广仁寺',lng:108.92,lat:34.268},{name:'罔极寺',lng:108.98,lat:34.262}]},
  { name:'西安·博物馆之旅',start:{name:'陕历博',lng:108.95,lat:34.222},end:{name:'半坡博物馆',lng:109.05,lat:34.27},waypoints:[{name:'西安博物院',lng:108.94,lat:34.24},{name:'碑林博物馆',lng:108.95,lat:34.255}]},
  { name:'西安·城门之旅',start:{name:'永宁门',lng:108.948,lat:34.254},end:{name:'永宁门',lng:108.948,lat:34.254},waypoints:[{name:'朱雀门',lng:108.938,lat:34.257},{name:'含光门',lng:108.928,lat:34.257},{name:'安定门',lng:108.926,lat:34.263},{name:'玉祥门',lng:108.92,lat:34.269},{name:'安远门',lng:108.948,lat:34.274},{name:'尚德门',lng:108.955,lat:34.274},{name:'解放门',lng:108.962,lat:34.274},{name:'朝阳门',lng:108.975,lat:34.268},{name:'长乐门',lng:108.97,lat:34.263},{name:'建国门',lng:108.962,lat:34.257},{name:'和平门',lng:108.955,lat:34.257},{name:'文昌门',lng:108.95,lat:34.256}]},
  { name:'西安·回坊美食巡礼',start:{name:'钟楼',lng:108.948,lat:34.261},end:{name:'洒金桥',lng:108.938,lat:34.268},waypoints:[{name:'鼓楼',lng:108.946,lat:34.262},{name:'回民街',lng:108.944,lat:34.265},{name:'大皮院',lng:108.943,lat:34.267}]},
  { name:'西安·灞柳风雪',start:{name:'世博园',lng:109.06,lat:34.32},end:{name:'后海',lng:109.02,lat:34.365},waypoints:[{name:'灞桥镇',lng:109.058,lat:34.309},{name:'灞柳西路',lng:109.04,lat:34.3},{name:'广运潭',lng:109.035,lat:34.31}]},
  { name:'咸阳·渭河两岸环线',start:{name:'咸阳钟楼',lng:108.71,lat:34.336},end:{name:'咸阳钟楼',lng:108.71,lat:34.336},waypoints:[{name:'咸阳湖',lng:108.7,lat:34.33},{name:'渭河大桥',lng:108.71,lat:34.32},{name:'沣河入渭口',lng:108.69,lat:34.34},{name:'渭河横桥',lng:108.71,lat:34.35}]},
  { name:'咸阳·五陵塬骑行',start:{name:'咸阳钟楼',lng:108.71,lat:34.336},end:{name:'咸阳钟楼',lng:108.71,lat:34.336},waypoints:[{name:'汉阳陵',lng:108.78,lat:34.37},{name:'长陵',lng:108.82,lat:34.39},{name:'安陵',lng:108.85,lat:34.4},{name:'渭河横桥',lng:108.79,lat:34.38}]},
  { name:'宝鸡·市区→天台山',start:{name:'宝鸡',lng:107.150,lat:34.360},end:{name:'天台山',lng:107.130,lat:34.290},waypoints:[{name:'炎帝陵',lng:107.140,lat:34.330}]},
  { name:'渭南·市区→少华山',start:{name:'渭南',lng:109.510,lat:34.500},end:{name:'少华山',lng:109.830,lat:34.400},waypoints:[{name:'华州区',lng:109.770,lat:34.510}]},
  { name:'汉中·市区→南湖',start:{name:'汉中',lng:107.020,lat:33.070},end:{name:'南湖',lng:106.980,lat:33.030},waypoints:[{name:'南郑区',lng:106.940,lat:33.000}]},
  { name:'延安·宝塔山→清凉山',start:{name:'延安',lng:109.490,lat:36.580},end:{name:'清凉山',lng:109.490,lat:36.590},waypoints:[{name:'宝塔山',lng:109.500,lat:36.585}]},
  { name:'铜川·新区→照金',start:{name:'铜川新区',lng:108.980,lat:34.910},end:{name:'照金',lng:108.640,lat:34.960},waypoints:[{name:'小丘镇',lng:108.820,lat:34.930}]},
  { name:'安康·市区→瀛湖',start:{name:'安康',lng:109.030,lat:32.690},end:{name:'瀛湖',lng:108.960,lat:32.610},waypoints:[{name:'汉江大桥',lng:109.020,lat:32.680}]},
]

const selectedKey = ref(''), customFilter = ref('')
const customStart = ref({ name: '', lng: '', lat: '' })
const waypoints = ref([])
const loading = ref(false), tryInfo = ref(''), progress = ref(0)
const result = ref(null), resultShow = ref(false), collapseOpen = ref(false)
const supplyPoints = ref([]), supplyLoading = ref(false), highlightSupply = ref(-1)
function onSupplyChipClick(i) { highlightSupply.value = i }
function onSupplyMarkerClick(i) { highlightSupply.value = i; const sp = supplyPoints.value[i]; if (sp) toast(sp.name) }
let supplyCoords = [], supplySearched = 0

let st = null
function onStartInput() { clearTimeout(st); st = setTimeout(() => searchAddress(customStart.value.name), 200) }
function selectSugg(i) { const p = pickSuggestion(i); if (p) { customStart.value = { name: p.name, lng: p.lng, lat: p.lat }; toast(p.name) } }
function pickStart(alias) { const a = addresses[alias]; if (a) { customStart.value = { name: a.name, lng: a.lng, lat: a.lat }; toast(alias) } }

const filteredRoutes = computed(() => {
  const f = customFilter.value.toLowerCase().trim()
  return f ? PRESET_ROUTES.filter(r => r.name.includes(f) || r.start.name.includes(f) || r.waypoints.some(w => w.name.includes(f))) : PRESET_ROUTES
})

const groups = computed(() => {
  const cityOrder = ['西安','咸阳','关中','秦岭','宝鸡','渭南','汉中','延安','铜川','商洛','安康']
  const g = {}
  for (const r of filteredRoutes.value) {
    for (const city of cityOrder) { if (r.name.startsWith(city)) { if (!g[city]) g[city] = []; g[city].push(r); break } }
  }
  return cityOrder.filter(c => g[c]).map(c => ({ city: c, routes: g[c] }))
})

function onPresetChange() {
  resultShow.value = false
  const route = PRESET_ROUTES.find(r => r.name === selectedKey.value)
  if (route) waypoints.value = route.waypoints.map(p => ({ ...p }))
  else waypoints.value = []
}
function addWP() { waypoints.value.push({ name: '', lng: '', lat: '' }) }
function removeWP(i) { waypoints.value.splice(i, 1) }

const activeRoute = computed(() => PRESET_ROUTES.find(r => r.name === selectedKey.value))

const fullPoints = computed(() => {
  const pts = []
  const route = activeRoute.value
  if (!route) return pts
  if (customStart.value.name && customStart.value.lng && customStart.value.lat) pts.push({ name: customStart.value.name, lng: parseFloat(customStart.value.lng), lat: parseFloat(customStart.value.lat) })
  else pts.push({ ...route.start })
  pts.push(...waypoints.value.filter(w => w.name && w.lng && w.lat && !isNaN(parseFloat(w.lng)) && !isNaN(parseFloat(w.lat))).map(w => ({ name: w.name, lng: parseFloat(w.lng), lat: parseFloat(w.lat) })))
  pts.push({ ...route.end })
  return pts
})

const presetObj = computed(() => {
  const r = activeRoute.value
  if (!r) return null
  return {
    start: customStart.value.name && customStart.value.lng ? { name: customStart.value.name, lng: parseFloat(customStart.value.lng), lat: parseFloat(customStart.value.lat) } : r.start,
    end: r.end,
    waypoints: r.waypoints
  }
})

const diffObj = computed(() => result.value ? rateDifficulty(result.value.totalDistance, result.value.totalClimb) : null)
const navUrl = computed(() => {
  if (!result.value) return ''
  const route = activeRoute.value
  if (!route) return ''
  const start = customStart.value.name && customStart.value.lng ? { name: customStart.value.name, lng: parseFloat(customStart.value.lng), lat: parseFloat(customStart.value.lat) } : route.start
  return buildNavUrl(start, route.end, result.value.waypoints)
})
function openNav() {
  if (!result.value || !activeRoute.value) return
  const route = activeRoute.value
  const start = customStart.value.name && customStart.value.lng ? { name: customStart.value.name, lng: parseFloat(customStart.value.lng), lat: parseFloat(customStart.value.lat) } : route.start
  openNavigation(start, route.end, result.value.waypoints)
}
function copyNav() { if (navUrl.value) { navigator.clipboard?.writeText(navUrl.value); toast('已复制') } }
function downloadGpx() {
  if (!result.value || !activeRoute.value) return
  const route = activeRoute.value
  const start = customStart.value.name && customStart.value.lng ? { name: customStart.value.name, lng: parseFloat(customStart.value.lng), lat: parseFloat(customStart.value.lat) } : route.start
  const gpx = buildGPX(result.value, start, route.end)
  const blob = new Blob([gpx], { type: 'application/gpx+xml' }); const a = document.createElement('a')
  a.href = URL.createObjectURL(blob); a.download = `RandomPath_Preset_${start.name}_${route.end.name}_${(result.value.totalDistance/1000).toFixed(1)}km.gpx`
  a.click(); URL.revokeObjectURL(a.href)
}

async function searchSupply() {
  if (supplyLoading.value) return
  // first click: sample the route polyline
  if (supplyCoords.length === 0) {
    const segs = result.value?.segments
    if (!segs) return
    const all = []; const { parsePolyline, samplePoints } = await import('../utils/math.js')
    for (const seg of segs) { if (seg.polyline) all.push(...parsePolyline(seg.polyline)) }
    if (all.length >= 2) supplyCoords = samplePoints(all, Math.min(9, Math.ceil(all.length / 15)))
  }
  if (supplySearched >= supplyCoords.length) { toast('已搜索全部区域', 'warn'); return }
  supplyLoading.value = true
  const batch = supplyCoords.slice(supplySearched, supplySearched + 3)
  try {
    const { searchPOIs } = await import('../composables/useAMap.js')
    const seen = new Set(supplyPoints.value.map(p => `${p.name}|${p.lng.toFixed(4)}|${p.lat.toFixed(4)}`))
    for (const pt of batch) {
      const pois = await searchPOIs(pt.lng, pt.lat, '080100|010100|060000|050000', 800, 15)
      for (const poi of pois) {
        const key = `${poi.name}|${poi.lng.toFixed(4)}|${poi.lat.toFixed(4)}`
        if (!seen.has(key)) { seen.add(key); supplyPoints.value.push(poi) }
      }
      await new Promise(r => setTimeout(r, 1000))
    }
    supplySearched += batch.length
    toast(`找到 ${supplyPoints.value.length} 个补给点`)
  } catch(e) { toast('搜索失败，请稍后重试', 'warn') }
  supplyLoading.value = false
}

async function generate() {
  const pts = fullPoints.value
  if (pts.length < 2) { toast('至少需要起终点', 'warn'); return }
  loading.value = true; resultShow.value = false; progress.value = 0; tryInfo.value = '正在拉取路线数据…'
  // reset supply state
  supplyPoints.value = []; supplyCoords = []; supplySearched = 0
  try {
    let td = 0, tt = 0; const segs = []
    for (let i = 0; i < pts.length - 1; i++) {
      const seg = await fetchBicyclingRoute(pts[i], pts[i + 1])
      td += seg.distance; tt += seg.duration
      segs.push({ ...seg, from: pts[i], to: pts[i + 1], idx: i })
      progress.value = 30 + (i / (pts.length - 1)) * 40
      tryInfo.value = `正在获取第${i+1}段路线…`
      if (i < pts.length - 2) await new Promise(r => setTimeout(r, 800))
    }
    const wps = pts.slice(1, -1)
    if (wps.length > 0) { tryInfo.value = '正在获取途经点地名…'; for (let i = 0; i < wps.length; i++) { const wp = wps[i]; wp.poiName = await nameWaypoint(wp.lng, wp.lat); if (i < wps.length - 1) await new Promise(r => setTimeout(r, 800)) } }
    progress.value = 100; await new Promise(r => setTimeout(r, 200))
    result.value = { waypoints: wps, segments: segs, totalDistance: td, totalDuration: tt, sector: -1, totalClimb: null }
    resultShow.value = true
  } catch (e) { toast('错误: ' + e.message, 'err') }
  loading.value = false
}
</script>

<template>
<div>
  <div class="card">
    <h2>选择经典路线</h2>
    <input v-model="customFilter" placeholder="搜索路线..." style="margin-bottom:8px;font-size:13px" />
    <select v-model="selectedKey" @change="onPresetChange" style="font-size:13px">
      <option value="">-- 选择预置路线 ({{ PRESET_ROUTES.length }}条) --</option>
      <optgroup v-for="g in groups" :key="g.city" :label="g.city">
        <option v-for="r in g.routes" :key="r.name" :value="r.name">{{ r.name }}</option>
      </optgroup>
    </select>
  </div>

  <div v-if="activeRoute" class="card" style="background:linear-gradient(135deg,#fff9fb,#faf7fc);border:1.5px dashed #ece0ec">
    <h2>路线详情</h2>
    <div style="font-size:11px;color:#8a8098;line-height:1.8">
      <div>起点: <strong>{{ activeRoute.start.name }} ({{ activeRoute.start.lng }}, {{ activeRoute.start.lat }})</strong></div>
      <div>终点: <strong>{{ activeRoute.end.name }} ({{ activeRoute.end.lng }}, {{ activeRoute.end.lat }})</strong></div>
      <div>途经点: <strong>{{ activeRoute.waypoints.length }}个</strong></div>
    </div>
    <div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;margin-top:8px;font-size:10px;color:#8a7a98">
      <span style="background:#e27790;color:#fff;padding:1px 6px;border-radius:4px;font-size:10px">起点</span>{{ activeRoute.start.name }}
      <span v-for="w in activeRoute.waypoints.slice(0,6)" :key="w.name">→ <span style="background:#8cb8a8;color:#fff;padding:1px 6px;border-radius:4px;font-size:10px">途经</span>{{ w.name }}</span>
      <span v-if="activeRoute.waypoints.length>6">... ({{ activeRoute.waypoints.length-6 }}+)</span>
      → <span style="background:#f0a870;color:#fff;padding:1px 6px;border-radius:4px;font-size:10px">终点</span>{{ activeRoute.end.name }}
    </div>
  </div>

  <div class="card">
    <h2>自定义起点 <span style="font-size:11px;color:#a898b8;font-weight:400">(可选)</span></h2>
    <div class="addr-quick"><span>地址簿：</span><button v-for="(v,k) in addresses" :key="k" class="btn btn-sm" style="background:#334155;color:#e2e8f0;font-size:9px;margin:1px" @click="pickStart(k)">{{ k }}</button></div>
    <div class="row" style="position:relative">
      <input v-model="customStart.name" placeholder="起点名称" style="flex:2;font-size:12px" @input="onStartInput" @focus="onStartInput" @blur="setTimeout(closeSuggest,200)">
      <input v-model.number="customStart.lng" type="number" step="0.000001" placeholder="经度" style="flex:1;font-size:12px">
      <input v-model.number="customStart.lat" type="number" step="0.000001" placeholder="纬度" style="flex:1;font-size:12px">
      <div v-if="showSuggest" class="suggest-drop"><div v-for="(s,i) in suggestions" :key="i" class="suggest-item" @mousedown.prevent="selectSugg(i)"><span class="s-name">{{ s.name }}</span><span class="s-dist">{{ s.district }}</span></div></div>
    </div>
  </div>

  <div v-if="selectedKey" class="card">
    <h2>途经点 ({{ waypoints.length }})<span style="font-size:11px;color:#a898b8;font-weight:400"> - 可编辑</span></h2>
    <div v-for="(wp,i) in waypoints" :key="i" style="display:flex;gap:4px;align-items:center;padding:2px 0;border-bottom:1px dashed #ece0ec">
      <span style="color:#8cb8a8;font-size:10px;min-width:16px;font-weight:700">{{ i+1 }}</span>
      <input v-model="wp.name" placeholder="地名" style="flex:2;font-size:11px;padding:5px">
      <input v-model.number="wp.lng" type="number" step="0.000001" placeholder="经度" style="flex:1;font-size:11px;padding:5px">
      <input v-model.number="wp.lat" type="number" step="0.000001" placeholder="纬度" style="flex:1;font-size:11px;padding:5px">
      <button class="btn btn-sm" style="background:#ff5252;color:#fff;font-size:9px;padding:3px 5px;flex-shrink:0" @click="removeWP(i)">X</button>
    </div>
    <div v-if="waypoints.length===0" style="text-align:center;padding:20px;color:#a898b8;font-size:13px">暂无途经点</div>
    <button class="btn btn-sm btn-secondary" style="display:block;margin:8px auto;font-size:11px" @click="addWP">+ 添加途经点</button>
  </div>

  <div v-if="fullPoints.length>=2" class="card">
    <button class="btn btn-primary" :disabled="loading" @click="generate">{{ loading ? '生成中...' : '生成骑行导航' }}</button>
  </div>

  <div v-if="loading" class="loading-overlay card">
    <div class="progress-ring">
      <svg width="64" height="64" viewBox="0 0 64 64"><circle class="bg" cx="32" cy="32" r="26"/><circle class="fg" cx="32" cy="32" r="26" :style="{strokeDasharray:163.36,strokeDashoffset:163.36-(progress/100)*163.36}"/></svg>
      <div class="txt">{{ progress }}%</div>
    </div>
    <p class="loading-hint">{{ tryInfo }}</p>
  </div>

  <div v-if="resultShow && result" class="card" style="animation:cardIn .4s cubic-bezier(.34,1.56,.64,1)">
    <div class="stats">
      <div class="stat"><div class="val">{{ (result.totalDistance/1000).toFixed(1) }}</div><div class="lbl">总距离 km</div></div>
      <div class="stat"><div class="val">{{ Math.round(result.totalDuration/60) }}</div><div class="lbl">预计 分钟</div></div>
      <div class="stat"><div class="val small" :style="{color:diffObj?.color}">{{ diffObj?.label }}</div><div class="lbl">难度</div></div>
    </div>
    <RouteThumbnail :segments="result.segments" :waypoints="result.waypoints" :supplyPoints="supplyPoints" :highlightIndex="highlightSupply" :home="fullPoints[0]" :work="fullPoints[fullPoints.length-1]" @supply-click="onSupplyMarkerClick" />
    <div class="route-thumb-legend"><span>🟢 起点</span><span>🟠 终点</span><span>🔵 途经点</span><span>🟣 补给点</span><span>⬆ 北</span></div>
    <div class="route-summary"><strong>{{ fullPoints[0]?.name }}</strong> → {{ result.waypoints.map((w,i) => w.poiName || w.name || '途经点'+(i+1)).join(' → ') || '直达' }} → <strong>{{ fullPoints[fullPoints.length-1]?.name }}</strong></div>
    <div class="collapse-toggle" :class="{open:collapseOpen}" @click="collapseOpen=!collapseOpen"><span class="arrow">▶</span> 详细数据</div>
    <div class="collapse-body" :class="{open:collapseOpen}">
      <div class="stats" style="margin-top:8px">
        <div class="stat"><div class="val small">{{ result.totalClimb != null ? result.totalClimb+'m' : '--' }}</div><div class="lbl">爬升 m</div></div>
        <div class="stat"><div class="val small">{{ calcCalories(result.totalDistance, result.totalDuration) }}kcal</div><div class="lbl">消耗</div></div>
        <div class="stat"><div class="val small">{{ result.waypoints.length }}</div><div class="lbl">途经点</div></div>
      </div>
      <div class="segments"><div class="seg" v-for="(seg,i) in result.segments" :key="i"><span class="seg-detail">第{{ i+1 }}段: {{ fullPoints[i]?.name }} → {{ fullPoints[i+1]?.name }}</span><span class="seg-nums">{{ (seg.distance/1000).toFixed(1) }}km · {{ Math.round(seg.duration/60) }}min</span></div></div>
      <div v-if="supplyPoints.length" style="margin-top:12px;border-top:1px dashed #ece0ec;padding-top:10px">
        <div style="font-size:12px;font-weight:700;color:#5e5468;margin-bottom:6px">💧 沿途补给点 ({{ supplyPoints.length }})</div>
        <div class="supply-chips"><span v-for="(sp, i) in supplyPoints" :key="i" class="supply-chip" :class="{active: highlightSupply===i}" :title="sp.type" @click="onSupplyChipClick(i)">{{ i+1 }}. {{ sp.name }}</span></div>
      </div>
    </div>
    <button class="btn btn-supply" @click="searchSupply" :disabled="supplyLoading">
      {{ supplyLoading ? '搜索中…' : supplyPoints.length ? '🔄 加载更多补给点' : '🔍 搜索沿途补给点' }}
    </button>
    <button class="btn btn-nav" @click="openNav">开始导航</button>
    <div class="nav-link-box"><div class="label">高德导航链接（可复制）：</div><div class="url">{{ navUrl }}</div></div>
    <div style="display:flex;gap:8px;margin-top:8px"><button class="btn btn-sm btn-secondary" style="flex:1" @click="copyNav">复制</button><button class="btn btn-sm btn-secondary" style="flex:1" @click="downloadGpx">GPX</button></div>
  </div>
</div>
</template>

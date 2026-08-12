import { createApp } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import App from './App.vue'
import ExploreView from './views/ExploreView.vue'
import PresetView from './views/PresetView.vue'
import TravelView from './views/TravelView.vue'

const routes = [
  { path: '/', redirect: '/explore' },
  { path: '/explore', component: ExploreView, meta: { group: 'ride', tab: 'explore' } },
  { path: '/commute', redirect: '/explore' },
  { path: '/loop', redirect: '/explore' },
  { path: '/travel', component: TravelView, meta: { group: 'travel', tab: 'travel' } },
  { path: '/preset', component: PresetView, meta: { group: 'ride', tab: 'preset' } },
]
const router = createRouter({ history: createWebHashHistory(), routes })
createApp(App).use(router).mount('#app')

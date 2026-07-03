import { createApp } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import App from './App.vue'
import CommuteView from './views/CommuteView.vue'
import LoopView from './views/LoopView.vue'
import PresetView from './views/PresetView.vue'

const routes = [
  { path: '/', redirect: '/commute' },
  { path: '/commute', component: CommuteView, meta: { tab: 'commute' } },
  { path: '/loop', component: LoopView, meta: { tab: 'loop' } },
  { path: '/preset', component: PresetView, meta: { tab: 'preset' } },
]
const router = createRouter({ history: createWebHashHistory(), routes })
createApp(App).use(router).mount('#app')

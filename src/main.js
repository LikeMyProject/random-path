import { createApp } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import App from './App.vue'
import ExploreView from './views/ExploreView.vue'
import PresetView from './views/PresetView.vue'

const routes = [
  { path: '/', redirect: '/explore' },
  { path: '/explore', component: ExploreView, meta: { tab: 'explore' } },
  { path: '/commute', redirect: '/explore' },
  { path: '/loop', redirect: '/explore' },
  { path: '/preset', component: PresetView, meta: { tab: 'preset' } },
]
const router = createRouter({ history: createWebHashHistory(), routes })
createApp(App).use(router).mount('#app')

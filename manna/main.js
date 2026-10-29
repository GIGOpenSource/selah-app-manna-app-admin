/**
 * uni-app 入口：挂载 uview-plus、i18n，以及全局 $getImg。
 */
import App from './App'
import uviewPlus from 'uview-plus'
import { getImg } from '@/utils/http.js'
// #ifndef VUE3
import Vue from 'vue'
import './uni.promisify.adaptor'
Vue.config.productionTip = false
// 将 getImg 挂载到 Vue 原型上，全局可用
Vue.prototype.$getImg = getImg
App.mpType = 'app'
const app = new Vue({
  ...App
})
app.$mount()
// #endif

// #ifdef VUE3
import { createSSRApp } from 'vue'
import i18n from './i18n/index.js'
import MannaDialog from '@/components/manna-dialog/manna-dialog.vue'
import MannaSheet from '@/components/manna-sheet/manna-sheet.vue'
import MannaBadgeToast from '@/components/manna-badge-toast/manna-badge-toast.vue'
import LPainter from 'lime-painter/components/l-painter/l-painter.vue'
import LPainterView from 'lime-painter/components/l-painter-view/l-painter-view.vue'
import LPainterImage from 'lime-painter/components/l-painter-image/l-painter-image.vue'
import LPainterText from 'lime-painter/components/l-painter-text/l-painter-text.vue'
export function createApp() {
  const app = createSSRApp(App)
  app.use(uviewPlus);
  app.use(i18n)
  // 全局注册：避免离线包 easycom 失效导致弹窗 / 画板组件不存在
  app.component('manna-dialog', MannaDialog)
  app.component('manna-sheet', MannaSheet)
  app.component('manna-badge-toast', MannaBadgeToast)
  app.component('l-painter', LPainter)
  app.component('l-painter-view', LPainterView)
  app.component('l-painter-image', LPainterImage)
  app.component('l-painter-text', LPainterText)
  // 将 getImg 挂载到全局属性上，全局可用
  app.config.globalProperties.$getImg = getImg
  return {
    app
  }
}
// #endif
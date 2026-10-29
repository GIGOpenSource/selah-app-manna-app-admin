/**
 * uni-app 入口：挂载 uview-plus、i18n，以及全局 $getImg。
 */
import App from './App'
import uviewPlus from 'uview-plus'
import { getImg } from '@/utils/http.js'
import { noBounceMixin } from '@/utils/pageBounce.js'
// #ifndef VUE3
import Vue from 'vue'
import './uni.promisify.adaptor'
Vue.config.productionTip = false
Vue.mixin(noBounceMixin)
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
import SelahDialog from '@/components/selah-dialog/selah-dialog.vue'
import SelahSheet from '@/components/selah-sheet/selah-sheet.vue'
import SelahVipLock from '@/components/selah-vip-lock/selah-vip-lock.vue'
import SelahWidgetNudge from '@/components/selah-widget-nudge/selah-widget-nudge.vue'
import SelahDiscountNudge from '@/components/selah-discount-nudge/selah-discount-nudge.vue'
import SelahDeletionPrompt from '@/components/selah-deletion-prompt/selah-deletion-prompt.vue'
export function createApp() {
  const app = createSSRApp(App)
  app.use(uviewPlus);
  app.use(i18n)
  app.mixin(noBounceMixin)
  // 全局注册：避免离线包 easycom 失效导致弹窗组件不存在
  app.component('selah-dialog', SelahDialog)
  app.component('selah-sheet', SelahSheet)
  app.component('selah-vip-lock', SelahVipLock)
  app.component('selah-widget-nudge', SelahWidgetNudge)
  app.component('selah-discount-nudge', SelahDiscountNudge)
  app.component('selah-deletion-prompt', SelahDeletionPrompt)
  // 将 getImg 挂载到全局属性上，全局可用
  app.config.globalProperties.$getImg = getImg
  return {
    app
  }
}
// #endif
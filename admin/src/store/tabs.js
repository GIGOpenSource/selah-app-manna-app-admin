/**
 * 多标签页状态：打开/关闭/关闭其他，与 Tabs 组件联动。
 */
import { defineStore } from 'pinia'

export const useTabsStore = defineStore('tabs', {
  state: () => ({
    list: [],
  }),
  getters: {
    nameList: (state) => state.list.map((item) => item.name),
  },
  actions: {
    delTabsItem(index) {
      this.list.splice(index, 1)
    },
    setTabsItem(data) {
      this.list.push(data)
    },
    clearTabs() {
      this.list = []
    },
    closeTabsOther(data) {
      this.list = data
    },
    closeCurrentTag({ $router, $route }) {
      for (let i = 0, len = this.list.length; i < len; i++) {
        const item = this.list[i]
        if (item.path === $route.fullPath) {
          if (i < len - 1) {
            $router.push(this.list[i + 1].path)
          } else if (i > 0) {
            $router.push(this.list[i - 1].path)
          } else {
            $router.push('/')
          }
          this.list.splice(i, 1)
          break
        }
      }
    },
  },
})

/**
 * 侧边栏折叠与主题色，供 Header / Sidebar 共用。
 */
import { defineStore } from 'pinia'

export const useSidebarStore = defineStore('sidebar', {
  state: () => ({
    collapse: false,
    bgColor: '#001529',
    textColor: 'rgba(255, 255, 255, 0.65)',
    activeTextColor: '#ffffff',
  }),
  actions: {
    handleCollapse() {
      this.collapse = !this.collapse
    },
  },
})

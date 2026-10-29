<!--
  侧边栏：按权限过滤 menuData，折叠状态来自 sidebar store。
-->
<template>
  <div class="sidebar">
    <el-menu
      class="sidebar-el-menu"
      :key="`${currentAppKey}-${sidebar.collapse ? 'c' : 'e'}`"
      :default-active="onRoutes"
      :collapse="sidebar.collapse"
      :collapse-transition="false"
      :background-color="sidebar.bgColor"
      :text-color="sidebar.textColor"
      :active-text-color="sidebar.activeTextColor"
      router
    >
      <template v-for="item in menus" :key="item.index">
        <el-sub-menu v-if="item.children" :index="item.index">
          <template #title>
            <el-icon>
              <component :is="item.icon" />
            </el-icon>
            <span>{{ item.title }}</span>
          </template>
          <el-menu-item v-for="sub in item.children" :key="sub.index" :index="sub.index">
            {{ sub.title }}
          </el-menu-item>
        </el-sub-menu>
        <el-menu-item v-else :index="item.index">
          <el-icon>
            <component :is="item.icon" />
          </el-icon>
          <template #title>{{ item.title }}</template>
        </el-menu-item>
      </template>
    </el-menu>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useSidebarStore } from '../store/sidebar'
import { useAuthStore } from '../store/auth'
import { menuData, mannaMenuData, filterMenuByPerms } from './menu'
import { currentAppKey } from '../utils/productContext'
import { SIDEBAR_ACTIVE_ALIAS } from '../utils/moduleTabs'

const route = useRoute()
const sidebar = useSidebarStore()
const auth = useAuthStore()
const onRoutes = computed(() => SIDEBAR_ACTIVE_ALIAS[route.path] || route.path)
const menus = computed(() =>
  filterMenuByPerms(currentAppKey.value === 'manna' ? mannaMenuData : menuData, auth.permissions),
)
</script>

<style scoped>
.sidebar {
  display: block;
  position: absolute;
  left: 0;
  top: var(--pro-header-height);
  bottom: 0;
  overflow-y: auto;
  overflow-x: hidden;
  background: var(--pro-sider-bg);
  box-shadow: 2px 0 8px 0 rgba(29, 35, 41, 0.05);
}

.sidebar::-webkit-scrollbar {
  width: 0;
}

.sidebar-el-menu {
  min-height: 100%;
  border-right: none !important;
}

.sidebar-el-menu:not(.el-menu--collapse) {
  width: 208px;
}

.sidebar-el-menu :deep(.el-menu-item),
.sidebar-el-menu :deep(.el-sub-menu__title) {
  height: 40px;
  line-height: 40px;
  margin: 4px 8px;
  border-radius: 6px;
  width: auto;
}

.sidebar-el-menu :deep(.el-menu-item.is-active) {
  background-color: var(--pro-primary) !important;
  color: #fff !important;
}

.sidebar-el-menu.el-menu--collapse :deep(.el-menu-item),
.sidebar-el-menu.el-menu--collapse :deep(.el-sub-menu__title) {
  margin: 4px 8px;
}
</style>

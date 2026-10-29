<!--
  顶栏：折叠侧栏、切换 App、全屏、当前账号与退出登录。
-->
<template>
  <div class="header">
    <div class="header-left">
      <img class="logo" src="../assets/img/logo.svg" alt="" />
      <div class="web-title">{{ titleText }}</div>
      <div class="collapse-btn" @click="collapseChange">
        <el-icon v-if="sidebar.collapse"><Expand /></el-icon>
        <el-icon v-else><Fold /></el-icon>
      </div>
      <div class="header-app">
        <span class="header-app-label">切换 App</span>
        <el-select
          class="header-app-switch"
          :model-value="currentAppKey"
          size="small"
          teleported
          @update:model-value="onAppChange"
        >
          <el-option
            v-for="opt in APP_SWITCH_OPTIONS"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>
      </div>
    </div>
    <div class="header-right">
      <div class="header-user-con">
        <div class="btn-icon" @click="setFullScreen">
          <el-tooltip effect="dark" content="全屏" placement="bottom">
            <el-icon><FullScreen /></el-icon>
          </el-tooltip>
        </div>
        <el-avatar class="user-avator" :size="28" :src="imgurl" />
        <el-dropdown class="user-name" trigger="click" @command="handleCommand">
          <span class="el-dropdown-link">
            {{ auth.username || 'admin' }}
            <el-icon class="el-icon--right"><ArrowDown /></el-icon>
          </span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item divided command="loginout">退出登录</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSidebarStore } from '../store/sidebar'
import { useTabsStore } from '../store/tabs'
import { useAuthStore } from '../store/auth'
import imgurl from '../assets/img/img.jpg'
import {
  APP_SWITCH_OPTIONS,
  appLabel,
  currentAppKey,
  setCurrentAppKey,
} from '../utils/productContext'
import { landingPathForApp } from './menu'

const router = useRouter()
const route = useRoute()
const sidebar = useSidebarStore()
const tabs = useTabsStore()
const auth = useAuthStore()

const titleText = computed(() => `${appLabel(currentAppKey.value)} 运营后台`)

function collapseChange() {
  sidebar.handleCollapse()
}

function syncCurrentTab(r) {
  if (!r?.meta?.title) return
  tabs.setTabsItem({
    name: r.name,
    title: r.meta.title,
    path: r.fullPath,
  })
}

function onAppChange(v) {
  if (v === currentAppKey.value) return
  const next = setCurrentAppKey(v)
  tabs.clearTabs()
  const target = landingPathForApp(next, route.path)
  if (target !== route.path) {
    router.push(target)
    return
  }
  // 共用页（如 App 用户）路径不变，Tabs 收不到路由更新，需把当前标签重新挂上
  syncCurrentTab(route)
}

onMounted(() => {
  if (document.body.clientWidth < 1500) {
    collapseChange()
  }
})

function handleCommand(command) {
  if (command === 'loginout') {
    auth.clearSession()
    tabs.clearTabs()
    router.push('/login')
  }
}

function setFullScreen() {
  if (document.fullscreenElement) {
    document.exitFullscreen()
  } else {
    document.body.requestFullscreen()
  }
}
</script>

<style scoped>
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-sizing: border-box;
  width: 100%;
  height: var(--pro-header-height);
  color: var(--header-text-color);
  background-color: var(--header-bg-color);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 1px 4px rgba(0, 21, 41, 0.08);
  position: relative;
  z-index: 20;
}

.header-left {
  display: flex;
  align-items: center;
  padding-left: 16px;
  height: 100%;
}

.logo {
  width: 28px;
  height: 28px;
}

.web-title {
  margin: 0 24px 0 10px;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.2px;
}

.collapse-btn {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  padding: 0 12px;
  cursor: pointer;
  opacity: 0.85;
  font-size: 18px;
  transition: opacity 0.2s;
}

.collapse-btn:hover {
  opacity: 1;
}

.header-app {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: 8px;
  height: 100%;
}

.header-app-label {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.65);
  white-space: nowrap;
}

.header-app-switch {
  width: 128px;
}

.header-app-switch :deep(.el-select__wrapper) {
  min-height: 28px;
  background: rgba(255, 255, 255, 0.1);
  box-shadow: none;
  color: #fff;
}

.header-app-switch :deep(.el-select__placeholder),
.header-app-switch :deep(.el-select__selected-item) {
  color: #fff;
}

.header-app-switch :deep(.el-select__caret) {
  color: rgba(255, 255, 255, 0.75);
}

.header-right {
  padding-right: 24px;
}

.header-user-con {
  display: flex;
  height: var(--pro-header-height);
  align-items: center;
}

.btn-icon {
  position: relative;
  width: 32px;
  height: 32px;
  text-align: center;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--header-text-color);
  margin: 0 4px;
  font-size: 16px;
  border-radius: 6px;
  transition: background 0.2s;
}

.btn-icon:hover {
  background: rgba(255, 255, 255, 0.08);
}

.user-avator {
  margin: 0 8px 0 12px;
}

.el-dropdown-link {
  color: var(--header-text-color);
  cursor: pointer;
  display: flex;
  align-items: center;
  font-size: 14px;
}
</style>

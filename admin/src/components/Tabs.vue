<!--
  多标签导航：随路由增删标签，支持关闭当前/其他/全部。
-->
<template>
  <div class="tabs-container">
    <el-tabs
      v-model="activePath"
      class="tabs"
      type="card"
      closable
      @tab-click="clickTabs"
      @tab-remove="closeTabs"
    >
      <el-tab-pane
        v-for="item in tabs.list"
        :key="item.path"
        :label="item.title"
        :name="item.path"
      />
    </el-tabs>
    <div class="tabs-close-box">
      <el-dropdown @command="handleTags">
        <el-button size="small">
          标签选项
          <el-icon class="el-icon--right"><ArrowDown /></el-icon>
        </el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="other">关闭其他</el-dropdown-item>
            <el-dropdown-item command="current">关闭当前</el-dropdown-item>
            <el-dropdown-item command="all">关闭所有</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { onBeforeRouteUpdate, useRoute, useRouter } from 'vue-router'
import { useTabsStore } from '../store/tabs'

const route = useRoute()
const router = useRouter()
const activePath = ref(route.fullPath)
const tabs = useTabsStore()

function setTags(r) {
  const isExist = tabs.list.some((item) => item.path === r.fullPath)
  if (!isExist && r.meta?.title) {
    tabs.setTabsItem({
      name: r.name,
      title: r.meta.title,
      path: r.fullPath,
    })
  }
}

setTags(route)
onBeforeRouteUpdate((to) => {
  setTags(to)
})

function closeAll() {
  tabs.clearTabs()
  router.push('/dashboard')
}

function closeOther() {
  const curItem = tabs.list.filter((item) => item.path === route.fullPath)
  tabs.closeTabsOther(curItem)
}

function handleTags(command) {
  if (command === 'current') {
    tabs.closeCurrentTag({ $router: router, $route: route })
  } else if (command === 'all') {
    closeAll()
  } else if (command === 'other') {
    closeOther()
  }
}

function clickTabs(item) {
  router.push(item.props.name)
}

function closeTabs(path) {
  const index = tabs.list.findIndex((item) => item.path === path)
  tabs.delTabsItem(index)
  const item = tabs.list[index] || tabs.list[index - 1]
  router.push(item ? item.path : '/dashboard')
}

watch(
  () => route.fullPath,
  (newVal) => {
    activePath.value = newVal
  },
)
</script>

<style>
.tabs-container {
  position: relative;
  overflow: hidden;
  background: #fff;
  padding: 0 112px 0 0;
  border-bottom: 1px solid #f0f0f0;
}

.tabs .el-tabs__header {
  margin-bottom: 0;
  border-bottom: none;
}

.tabs .el-tabs__nav {
  border: none !important;
}

.tabs .el-tabs__item {
  height: 40px;
  line-height: 40px;
  border: none !important;
  color: rgba(0, 0, 0, 0.65);
  font-weight: 400;
  transition: color 0.2s;
}

.tabs .el-tabs__item.is-active {
  color: var(--pro-primary);
  background: transparent;
}

.tabs .el-tabs__item:hover {
  color: var(--pro-primary);
}

.tabs .el-tabs__nav-next,
.tabs .el-tabs__nav-prev {
  line-height: 40px;
}

.tabs.el-tabs {
  --el-tabs-header-height: 40px;
}

.tabs.el-tabs--card > .el-tabs__header .el-tabs__item.is-active {
  border-bottom: 2px solid var(--pro-primary) !important;
}

.tabs-close-box {
  position: absolute;
  right: 0;
  top: 0;
  box-sizing: border-box;
  padding: 4px 12px 0 0;
  text-align: center;
  width: 112px;
  height: 40px;
  background: #fff;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: flex-end;
}
</style>

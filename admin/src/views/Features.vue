<!--
  Selah 3.0 功能开关 + 登录会话：维度打包，避免散落在 KV / Manna 规则页。
-->
<template>
  <div class="container">
    <ConfigPackList
      title="功能开关"
      tips="控制 App 3.0 能力与登录门禁。空维=看全部包；同维取优先级更大者。Widget / 图标 / 动态壁纸的 teaser 键会与真能力开关对齐下发。"
      :keys="KEYS"
      :defaults="defaults"
      remark="功能开关"
      dialog-width="640px"
      :summary-keys="['selah_3_0_features_enabled', 'quiz_enabled', 'compose_enabled']"
    >
      <template #form="{ form }">
        <el-divider content-position="left">3.0 能力</el-divider>
        <el-form-item label="3.0 总开关"><el-switch v-model="form.selah_3_0_features_enabled" /></el-form-item>
        <el-form-item label="测验"><el-switch v-model="form.quiz_enabled" /></el-form-item>
        <el-form-item label="Compose / 肯定语"><el-switch v-model="form.compose_enabled" /></el-form-item>
        <el-form-item label="Widget">
          <el-switch
            v-model="form.widget_enabled"
            @change="(v) => { form.widget_teaser_enabled = v }"
          />
        </el-form-item>
        <el-form-item label="App 图标">
          <el-switch
            v-model="form.app_icon_enabled"
            @change="(v) => { form.app_icon_teaser_enabled = v }"
          />
        </el-form-item>
        <el-form-item label="动态壁纸">
          <el-switch
            v-model="form.dynamic_wallpaper_enabled"
            @change="(v) => { form.dynamic_wallpaper_tab_enabled = v }"
          />
        </el-form-item>
        <el-form-item label="Watch 入口"><el-switch v-model="form.watch_enabled" /></el-form-item>
        <el-form-item label="Support Selah"><el-switch v-model="form.support_selah_enabled" /></el-form-item>
        <el-form-item label="评分链接">
          <el-input v-model="form.url_rate" placeholder="空=客户端商店默认" />
        </el-form-item>
        <el-form-item label="Compose 入口文案">
          <el-input v-model="form.compose_entry_label" maxlength="40" />
        </el-form-item>
        <el-form-item label="评分入口文案">
          <el-input v-model="form.support_rate_label" maxlength="40" placeholder="Rate Selah" />
        </el-form-item>
        <el-form-item label="分享入口文案">
          <el-input v-model="form.support_share_label" maxlength="40" placeholder="Share with friends" />
        </el-form-item>
        <el-form-item label="帮助入口文案">
          <el-input v-model="form.support_help_label" maxlength="40" placeholder="Help" />
        </el-form-item>

        <el-divider content-position="left">Widget 默认</el-divider>
        <el-form-item label="默认主题">
          <el-input v-model="form.widget_default_theme" placeholder="如 cream / dusk" />
        </el-form-item>
        <el-form-item label="默认边框">
          <el-input v-model="form.widget_default_border" placeholder="边框样式 key" />
        </el-form-item>
        <el-form-item label="默认刷新">
          <el-input v-model="form.widget_default_refresh" placeholder="刷新策略 key" />
        </el-form-item>
        <el-form-item label="VIP 边框列表">
          <el-input v-model="form.widget_vip_borders" type="textarea" :rows="2" placeholder="逗号分隔或 JSON 数组" />
        </el-form-item>

        <el-divider content-position="left">登录 / 会话</el-divider>
        <el-form-item label="设备登录"><el-switch v-model="form.device_login_enabled" /></el-form-item>
        <el-form-item label="Google / Apple 登录"><el-switch v-model="form.oauth_login_enabled" /></el-form-item>
        <el-form-item label="登录页标题">
          <el-input v-model="form.login_title" maxlength="80" />
        </el-form-item>
        <el-form-item label="登录页副标题">
          <el-input v-model="form.login_subtitle" maxlength="120" />
        </el-form-item>
        <el-form-item label="会话天数">
          <el-input-number v-model="form.session_ttl_days" :min="1" :max="365" />
        </el-form-item>
        <el-form-item label="记住我天数">
          <el-input-number v-model="form.session_remember_days" :min="1" :max="365" />
        </el-form-item>
      </template>
    </ConfigPackList>
  </div>
</template>

<script setup>
import ConfigPackList from '../components/ConfigPackList.vue'

const defaults = {
  selah_3_0_features_enabled: true,
  quiz_enabled: true,
  compose_enabled: true,
  widget_enabled: true,
  app_icon_enabled: true,
  dynamic_wallpaper_enabled: true,
  // teaser 与真开关对齐写入，避免 App 双读不一致
  widget_teaser_enabled: true,
  app_icon_teaser_enabled: true,
  dynamic_wallpaper_tab_enabled: true,
  watch_enabled: true,
  support_selah_enabled: true,
  url_rate: '',
  compose_entry_label: 'Create',
  support_rate_label: 'Rate Selah',
  support_share_label: 'Share with friends',
  support_help_label: 'Help',
  widget_default_theme: '',
  widget_default_border: '',
  widget_default_refresh: '',
  widget_vip_borders: '',
  device_login_enabled: true,
  oauth_login_enabled: true,
  login_title: '',
  login_subtitle: '',
  session_ttl_days: 7,
  session_remember_days: 30,
}
const KEYS = Object.keys(defaults)
</script>

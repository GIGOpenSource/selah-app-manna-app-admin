<!--
  品牌与法务：维度打包列表（App×语言×设备）。
-->
<template>
  <div class="container">
    <ConfigPackList
      title="品牌与法务"
      tips="App 优先读这里的外链；空 URL 时回落本机 /legal/<slug>/。社交链接空则设置页不展示 Follow 入口。双端下载链接填 App Store / Google Play，分享只带落地页，对方点开后按机型跳转。正文覆写仅作用于本机法务页。空维=看全部包。Manna 包若覆写 Privacy/Terms，须保留：经文翻译调用 Google 翻译 API、实时生成、不落库保存译本。"
      :keys="KEYS"
      :defaults="defaults"
      remark="品牌与法务"
      dialog-width="720px"
      label-width="180px"
      :summary-keys="['brand_name', 'support_email']"
    >
      <template #form="{ form }">
        <el-divider content-position="left">品牌</el-divider>
        <el-form-item label="品牌名">
          <el-input v-model="form.brand_name" placeholder="Selah" />
        </el-form-item>
        <el-form-item label="法律主体">
          <el-input v-model="form.legal_entity_name" placeholder="公司法定名称" />
        </el-form-item>
        <el-form-item label="支持邮箱">
          <el-input v-model="form.support_email" placeholder="support@selah.app" />
        </el-form-item>
        <el-form-item label="发行方名称">
          <el-input v-model="form.publisher_name" placeholder="发行商 / 开发者展示名" />
        </el-form-item>
        <el-form-item label="更多应用 URL">
          <el-input v-model="form.url_more_apps" placeholder="空则不展示" />
        </el-form-item>

        <el-divider content-position="left">法务 / 帮助外链</el-divider>
        <el-form-item label="隐私政策 URL">
          <el-input v-model="form.url_privacy" placeholder="空则本机 /legal/privacy/" />
        </el-form-item>
        <el-form-item label="用户条款 URL">
          <el-input v-model="form.url_terms" placeholder="空则本机 /legal/terms/" />
        </el-form-item>
        <el-form-item label="订阅条款 URL">
          <el-input v-model="form.url_subscription" placeholder="空则本机 /legal/subscription/" />
        </el-form-item>
        <el-form-item label="帮助 URL">
          <el-input v-model="form.url_help" placeholder="空则本机 /legal/help/" />
        </el-form-item>

        <el-divider content-position="left">双端下载链接</el-divider>
        <el-form-item label="iOS App Store">
          <el-input v-model="form.url_app_store" placeholder="https://apps.apple.com/app/idxxxx" />
        </el-form-item>
        <el-form-item label="Android Google Play">
          <el-input v-model="form.url_play_store" placeholder="https://play.google.com/store/apps/details?id=..." />
        </el-form-item>
        <el-form-item label="分享落地页">
          <el-input v-model="form.url_download" placeholder="空则本机 /legal/download/（按对方机型跳上面双端链接）" />
        </el-form-item>

        <el-divider content-position="left">社交（设置页 Follow us）</el-divider>
        <el-form-item label="Instagram">
          <el-input v-model="form.url_instagram" placeholder="空则不展示，如 https://instagram.com/selah" />
        </el-form-item>
        <el-form-item label="TikTok">
          <el-input v-model="form.url_tiktok" placeholder="空则不展示，如 https://www.tiktok.com/@selah" />
        </el-form-item>
        <el-form-item label="Facebook">
          <el-input v-model="form.url_facebook" placeholder="空则不展示，如 https://facebook.com/selah" />
        </el-form-item>

        <el-divider content-position="left">本机法务正文覆写（可选）</el-divider>
        <el-form-item label="Privacy 正文">
          <el-input v-model="form.legal_body_privacy" type="textarea" :rows="4" />
        </el-form-item>
        <el-form-item label="Terms 正文">
          <el-input v-model="form.legal_body_terms" type="textarea" :rows="4" />
        </el-form-item>
        <el-form-item label="Subscription 正文">
          <el-input v-model="form.legal_body_subscription" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item label="Help 正文">
          <el-input v-model="form.legal_body_help" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item label="Download 正文">
          <el-input v-model="form.legal_body_download" type="textarea" :rows="2" />
        </el-form-item>
      </template>
    </ConfigPackList>
  </div>
</template>

<script setup>
import ConfigPackList from '../components/ConfigPackList.vue'

const defaults = {
  brand_name: 'Selah',
  legal_entity_name: '[Pending legal entity name]',
  support_email: 'support@selah.app',
  publisher_name: '',
  url_more_apps: '',
  url_privacy: '',
  url_terms: '',
  url_subscription: '',
  url_help: '',
  url_download: '',
  url_app_store: '',
  url_play_store: '',
  url_instagram: '',
  url_tiktok: '',
  url_facebook: '',
  legal_body_privacy: '',
  legal_body_terms: '',
  legal_body_subscription: '',
  legal_body_help: '',
  legal_body_download: '',
}
const KEYS = Object.keys(defaults)
</script>

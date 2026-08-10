<!--
  兼容旧路由：重定向到 widgets 配置页。
-->
<template>
	<view />
</template>

<script setup>
import { onLoad } from '@dcloudio/uni-app'

onLoad((q) => {
	const kind = q?.kind === 'lock' ? 'lock' : 'home'
	const from = q?.from === 'profile' ? 'profile' : ''
	const qs = [`kind=${kind}`]
	if (from) qs.push(`from=${from}`)
	uni.redirectTo({
		url: `/pagesA/widgets/widgets?${qs.join('&')}`,
	})
})
</script>

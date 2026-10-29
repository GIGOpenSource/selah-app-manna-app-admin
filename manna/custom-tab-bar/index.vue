<template>
	<!-- 启用 custom tabBar 后原生底栏不再绘制；实际导航用页面内 MannaTabBar -->
	<view class="empty-tab" />
</template>

<script>
export default {
	data() {
		return { selected: 0 }
	},
	methods: {
		setSelected() {},
	},
}
</script>

<style>
.empty-tab {
	height: 0;
	width: 0;
	overflow: hidden;
}
</style>

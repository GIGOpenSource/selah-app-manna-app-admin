/**
 * 关掉 iOS 页面橡皮筋回弹，避免下拉露出顶栏上方的色带。
 */
export function disableCurrentWebviewBounce() {
	// #ifdef APP-PLUS
	try {
		const wv = plus.webview.currentWebview()
		if (wv && typeof wv.setStyle === 'function') {
			wv.setStyle({ bounce: 'none' })
		}
	} catch (e) {}
	// #endif
}

export const noBounceMixin = {
	onShow() {
		disableCurrentWebviewBounce()
	},
}

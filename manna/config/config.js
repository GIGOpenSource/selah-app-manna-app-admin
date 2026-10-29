// 开发环境指向本地后端；真机调试请改为局域网 IP
const develop = true
let host = 'https://www.test-mannabible.site/api'
if (!develop) host = 'https://www.test-mannabible.site/api'

/** 应用标识：Manna 固定 manna；请求头 X-App-Key + device-login.app_key */
const APP_KEY = 'manna'

export {
	host,
	develop,
	APP_KEY,
}

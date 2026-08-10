// 开发环境指向本地后端；真机调试请改为局域网 IP
const develop = true
let host = ' http://192.168.77.152:8000/api'
if (!develop) host = 'https://api.selah.app/api'

/** 应用标识：白牌/多包时改此处；请求头 X-App-Key + device-login.app_key */
const APP_KEY = 'selah'

export {
	host,
	develop,
	APP_KEY,
}

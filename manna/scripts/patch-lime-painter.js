/**
 * iOS 上 lime-painter 把沙盒绝对路径拼成 _www/var/mobile/...，底图读失败，海报只剩黑底。
 * node_modules 被忽略，安装后在这里打一次补丁。
 */
const fs = require('fs')
const path = require('path')

const file = path.join(__dirname, '../node_modules/lime-painter/components/l-painter/utils.js')
if (!fs.existsSync(file)) {
	console.log('[patch-lime-painter] skip, utils.js not found')
	process.exit(0)
}

let src = fs.readFileSync(file, 'utf8')
if (src.includes('iOS 沙盒绝对路径')) {
	process.exit(0)
}

const pathOld = `	if (path.indexOf('/') === 0) {
		const localFilePath = plus.io.convertAbsoluteFileSystem(path)
		if (localFilePath !== path) {
			return localFilePath
		} else {
			path = path.substr(1)
		}
	}`

const pathNew = `	if (path.indexOf('/') === 0) {
		let localFilePath = ''
		try {
			localFilePath = plus.io.convertAbsoluteFileSystem(path)
		} catch (e) {}
		if (localFilePath && localFilePath !== path) {
			return localFilePath
		}
		// iOS 沙盒绝对路径 convert 后不变。再拼成 _www/var/mobile/... 会读不到，背景图被丢掉。
		const os = String((plus.os && plus.os.name) || '').toLowerCase()
		if (os === 'ios') {
			return 'file://' + path
		}
		path = path.substr(1)
	}`

const corsOld = `						pathToBase64(image.path).then(base64 => {
							image.path = base64
							cache[path] = image
							resolve(cache[path])
						}).catch(err => {
							console.error({err, path})
							reject({err,path})
						})`

const corsNew = `						pathToBase64(image.path).then(base64 => {
							image.path = base64
							cache[path] = image
							resolve(cache[path])
						}).catch(err => {
							// base64 失败时仍用 getImageInfo 的本地路径绘制，避免 iOS 海报只剩黑底
							console.error({err, path})
							cache[path] = image
							resolve(cache[path])
						})`

if (!src.includes(pathOld) || !src.includes(corsOld)) {
	console.warn('[patch-lime-painter] lime-painter utils.js layout changed, patch skipped')
	process.exit(0)
}

src = src.replace(pathOld, pathNew).replace(corsOld, corsNew)
fs.writeFileSync(file, src)
console.log('[patch-lime-painter] patched iOS poster background')

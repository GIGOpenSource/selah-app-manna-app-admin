import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'
import fs from 'fs'
import path from 'path'

/** 把分享落地页拷进 H5 dist，现有 nginx try_files 才能命中 /legal/download/ */
function copyHostedLegal() {
	let outDir = 'dist'
	return {
		name: 'copy-hosted-legal',
		apply: 'build',
		configResolved(config) {
			outDir = config.build.outDir
		},
		closeBundle() {
			const src = path.resolve(__dirname, 'hosted/legal/download/index.html')
			if (!fs.existsSync(src)) return
			const dest = path.resolve(outDir, 'legal/download/index.html')
			fs.mkdirSync(path.dirname(dest), { recursive: true })
			fs.copyFileSync(src, dest)
		},
	}
}

export default defineConfig({
  plugins: [uni(), copyHostedLegal()],
  transpileDependencies: ['uview-plus', 'lime-painter'],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './')
    }
  }
})
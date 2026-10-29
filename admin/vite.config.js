import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

const root = path.dirname(fileURLToPath(import.meta.url))
const STATIC_ROOTS = [
  path.resolve(root, '../mobile/static'),
  path.resolve(root, '../mobile-manna/static'),
]

const MIME = {
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
}

function resolveClientStatic(urlPath) {
  const rel = decodeURIComponent(urlPath.replace(/^\/static\//, ''))
  if (!rel) return null
  for (const dir of STATIC_ROOTS) {
    const file = path.resolve(dir, rel)
    if (!file.startsWith(dir + path.sep)) continue
    try {
      if (fs.statSync(file).isFile()) return file
    } catch {
      /* missing in this root */
    }
  }
  return null
}

/** Seeded preview_url 是客户端 /static/ui/…，后台 5173 本身没有这些文件。 */
function serveClientStatic() {
  const handle = (req, res, next) => {
    const pathname = (req.url || '').split('?')[0]
    if (!pathname.startsWith('/static/')) return next()
    const file = resolveClientStatic(pathname)
    if (!file) return next()
    const ext = path.extname(file).toLowerCase()
    res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream')
    if (req.method === 'HEAD') return res.end()
    fs.createReadStream(file).pipe(res)
  }
  return {
    name: 'selah-client-static',
    configureServer(server) {
      server.middlewares.use(handle)
    },
    configurePreviewServer(server) {
      server.middlewares.use(handle)
    },
  }
}

const DEV_API_ORIGIN = 'https://www.test-selahbible.site'
const apiProxy = {
  '/api': {
    target: DEV_API_ORIGIN,
    changeOrigin: true,
  },
}

export default defineConfig({
  base: '/admin/',
  plugins: [vue(), serveClientStatic()],
  server: {
    port: 5173,
    proxy: apiProxy,
  },
  preview: {
    proxy: apiProxy,
  },
})

import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig(({ mode }) => {
  const envDir = fileURLToPath(new URL('../..', import.meta.url))
  const env = loadEnv(mode, envDir, '')
  const apiPath = env.VITE_API_BASE_URL?.split(/[?#]/, 1)[0] ?? ''
  const apiPathParts = apiPath.split('/').filter(Boolean)
  const proxyPrefix =
    apiPath.startsWith('/') && apiPathParts.length > 0
      ? `/${apiPathParts[0]}`
      : undefined

  return {
    envDir,
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        '@packages': fileURLToPath(new URL('../../packages', import.meta.url)),
      },
    },
    server: {
      proxy: proxyPrefix
        ? {
            [proxyPrefix]: {
              target: env.VITE_API_PROXY_TARGET,
              changeOrigin: true,
            },
          }
        : undefined,
    },
  }
})

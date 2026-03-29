import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/yf': {
        target: 'https://query1.finance.yahoo.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/yf/, ''),
      },
      '/yf2': {
        target: 'https://query2.finance.yahoo.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/yf2/, ''),
      },
      '/yfweb': {
        target: 'https://finance.yahoo.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/yfweb/, ''),
        cookieDomainRewrite: 'localhost',
      },
    },
  },
})

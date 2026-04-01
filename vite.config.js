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
      '/blockchain': {
        target: 'https://api.blockchain.info',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/blockchain/, ''),
      },
      '/llama': {
        target: 'https://api.llama.fi',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/llama/, ''),
      },
      '/llama-stables': {
        target: 'https://stablecoins.llama.fi',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/llama-stables/, ''),
      },
      '/santiment': {
        target: 'https://api.santiment.net',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/santiment/, ''),
      },
      '/cg': {
        target: 'https://api.coingecko.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/cg/, ''),
      },
    },
  },
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      // Enable polyfills needed by circomlibjs / snarkjs
      include: ['buffer', 'crypto', 'stream', 'util', 'process'],
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
    }),
  ],
  optimizeDeps: {
    // Pre-bundle these heavy modules
    include: ['snarkjs', 'three'],
    esbuildOptions: {
      target: 'esnext'
    }
  },
  server: {
    port: 3000,
    host: true,
    proxy: {
      '/verify': 'http://127.0.0.1:4000',
      '/health': 'http://127.0.0.1:4000',
      '/merkle-data': 'http://127.0.0.1:4000',
      '/register': 'http://127.0.0.1:4000',
      '/audit-log': 'http://127.0.0.1:4000',
      '/admin': 'http://127.0.0.1:4000'
    }
  }
})

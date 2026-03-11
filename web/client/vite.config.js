import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Polyfills needed for snarkjs/circomlibjs in browser
      stream: 'stream-browserify',
      crypto: 'crypto-browserify',
    }
  },
  optimizeDeps: {
    // Pre-bundle these heavy modules
    include: ['snarkjs', 'three'],
    esbuildOptions: {
      target: 'esnext'
    }
  },
  server: {
    port: 3000,
    proxy: {
      '/verify': 'http://localhost:4000',
      '/health': 'http://localhost:4000'
    }
  }
})

import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

export default defineConfig({
  envDir: '../..',
  optimizeDeps: {
    include: ['maplibre-gl'],
    // Clerk ships its context through both @clerk/react and the TanStack
    // wrapper. Prebundling them separately creates two module instances and
    // makes useAuth throw "can only be used within <ClerkProvider />".
    exclude: ['@clerk/react', '@clerk/tanstack-react-start'],
  },
  resolve: {
    dedupe: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime', '@clerk/react'],
    tsconfigPaths: true,
  },
  plugins: [devtools(), nitro(), tailwindcss(), tanstackStart(), viteReact()],
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The dashboard ships a single ~3.5MB JSON data bundle (src/data/flood-all.json),
// imported synchronously by the data layer (src/core.js). We split it into its
// own chunk ("flood-data") so it caches independently of the app code: a
// code-only redeploy no longer forces returning visitors to re-download the data,
// and Vite emits a modulepreload so it still loads in parallel with the entry
// chunk. chunkSizeWarningLimit is raised so the expected large data chunk doesn't
// trip a false warning.
//
// `base` is the repo name so assets resolve on the GitHub Pages project site
// (https://knu-mobi0224-team4.github.io/flood-traffic-net-web/). Applied on build
// only — `npm run dev` keeps serving from / locally.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/flood-traffic-net-web/' : '/',
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 4096,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('flood-all.json')) return 'flood-data'
        },
      },
    },
  },
}))
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteSingleFile } from 'vite-plugin-singlefile'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function bundleToRootHtmlPlugin() {
  return {
    name: 'bundle-to-root-html',
    closeBundle() {
      try {
        const distDev = path.resolve(__dirname, 'dist', 'index.dev.html')
        const distStandard = path.resolve(__dirname, 'dist', 'index.html')
        const rootIndex = path.resolve(__dirname, 'index.html')

        const srcFile = fs.existsSync(distDev) ? distDev : (fs.existsSync(distStandard) ? distStandard : null)
        if (srcFile) {
          const html = fs.readFileSync(srcFile, 'utf8')

          const scriptStart = html.indexOf('<script')
          const scriptEnd = html.lastIndexOf('</script>') + '</script>'.length

          if (scriptStart !== -1 && scriptEnd !== -1) {
            const scriptTagAndCode = html.substring(scriptStart, scriptEnd)
            const htmlWithoutScript = html.substring(0, scriptStart) + html.substring(scriptEnd)

            // Convert to standard defer script so it runs without CORS/module restrictions on file://
            const safeScript = scriptTagAndCode.replace(/^<script[^>]*>/, '<script defer>')

            // Put right before </body> so #root DOM element is parsed before execution
            // Use function callback so $ in minified JS is not treated as replacement patterns
            const finalHtml = htmlWithoutScript.replace('</body>', () => safeScript + '\n</body>')

            fs.writeFileSync(rootIndex, finalHtml, 'utf8')
            console.log('[bundle-to-root-html] Successfully generated standalone index.html at root!')
          }
        }
      } catch (err) {
        console.error('[bundle-to-root-html] Error generating root index.html:', err)
      }
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    viteSingleFile(),
    bundleToRootHtmlPlugin(),
  ],
  base: './',
  build: {
    rollupOptions: {
      input: path.resolve(__dirname, 'index.dev.html'),
    },
  },
  server: {
    open: '/index.dev.html',
  },
})

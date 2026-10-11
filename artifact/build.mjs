// Empaqueta la versión de prueba de SNACKEATS como una única página HTML para
// publicarla como artefacto privado en claude.ai.
// Uso: node artifact/build.mjs <ruta-esbuild> <fichero-salida.html>
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const [esbuildPath, outFile] = process.argv.slice(2)
if (!esbuildPath || !outFile) {
  console.error('Uso: node artifact/build.mjs <ruta-al-paquete-esbuild> <salida.html>')
  process.exit(1)
}
const esbuild = createRequire(path.join(esbuildPath, 'package.json'))('esbuild')
const shim = (f) => path.join(root, 'artifact/shims', f)

const aliases = {
  '@/lib/session': shim('session.tsx'),
  '@/lib/client-data': shim('client-data.ts'),
  '@/lib/supabase/client': shim('supabase-client.ts'),
  'next/link': shim('next-link.tsx'),
  'next/navigation': shim('next-navigation.ts'),
  'server-only': shim('empty.ts'),
}

const aliasPlugin = {
  name: 'snackeats-alias',
  setup(build) {
    build.onResolve({ filter: /.*/ }, (args) => {
      if (aliases[args.path]) return { path: aliases[args.path] }
      if (args.path === './client' && args.importer.includes(`${path.sep}src${path.sep}lib${path.sep}ai${path.sep}`)) return { path: shim('ai-client.ts') }
      if (args.path.startsWith('@/')) {
        const base = path.join(root, 'src', args.path.slice(2))
        for (const ext of ['', '.ts', '.tsx', '/index.ts', '/index.tsx', '.json']) if (fs.existsSync(base + ext) && fs.statSync(base + ext).isFile()) return { path: base + ext }
      }
      return undefined
    })
  },
}

const result = await esbuild.build({
  entryPoints: [path.join(root, 'artifact/main.tsx')],
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['es2020'],
  jsx: 'automatic',
  write: false,
  legalComments: 'none',
  absWorkingDir: root,
  plugins: [aliasPlugin],
  define: { 'process.env.NODE_ENV': '"production"', 'process.env.NEXT_PUBLIC_SUPABASE_URL': '""', 'process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY': '""' },
  logLevel: 'warning',
})
const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script')

const cssFile = path.join(path.dirname(outFile), 'snackeats-artifact.css')
execFileSync(path.join(root, 'node_modules/.bin/tailwindcss'), ['-i', 'src/app/globals.css', '-o', cssFile, '--minify', '--content', './src/**/*.{ts,tsx},./artifact/**/*.{ts,tsx}'], { cwd: root, stdio: 'inherit' })
const css = fs.readFileSync(cssFile, 'utf8')

const html = `<title>SNACKEATS Prueba</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&family=Unbounded:wght@500;600;700&display=swap">
<style>:root{--font-display:'Unbounded',ui-rounded,system-ui,sans-serif;--font-body:'Figtree',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;--font-mono:'IBM Plex Mono',ui-monospace,Menlo,monospace}
${css}</style>
<div id="snackeats-root"></div>
<script>${js}</script>
`
fs.writeFileSync(outFile, html)
console.log(`OK ${outFile} (${Math.round(html.length / 1024)} KB)`)

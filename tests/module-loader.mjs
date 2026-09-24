import fs from "node:fs"
import path from "node:path"
import { createRequire } from "node:module"
import ts from "typescript"
const requireModule = createRequire(import.meta.url)
const root = path.resolve(import.meta.dirname, "..")

// Execute actual TypeScript modules, replacing only external providers.
export function loader(mocks) {
  const cache = new Map()
  function load(name) {
    if (Object.hasOwn(mocks, name)) return mocks[name]
    if (name === 'server-only') return {}
    if (!name.startsWith('@/')) return requireModule(name)
    const filename = path.join(root, name.slice(2) + '.ts')
    if (cache.has(filename)) return cache.get(filename).exports
    const loadedModule = { exports: {} }
    cache.set(filename, loadedModule)
    const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText
    new Function('require', 'module', 'exports', 'fetch', code)(load, loadedModule, loadedModule.exports, mocks.__fetch ?? globalThis.fetch)
    return loadedModule.exports
  }
  return load
}


import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { loader } from './module-loader.mjs'

test('homepage advertises checkout totals with tax for every participation option', () => {
  const load = loader({})
  const pricing = load('@/lib/experience-plans')
  const mocks = {
    'next/link': { __esModule: true, default: ({ children }) => React.createElement('a', null, children) },
    'lucide-react': new Proxy({}, { get: () => () => null }),
    '@/components/custom-request-card': { CustomRequestCard: () => null },
    '@/components/ui/button': { buttonVariants: () => '' },
    '@/lib/utils': { cn: () => '' },
  }
  const source = fs.readFileSync(new URL('../app/(index)/page.tsx', import.meta.url), 'utf8')
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
  const loadedModule = { exports: {} }
  new Function('require', 'module', 'exports', code)(name => Object.hasOwn(mocks, name) ? mocks[name] : load(name), loadedModule, loadedModule.exports)
  const html = renderToStaticMarkup(React.createElement(loadedModule.exports.default)).replace(/<[^>]*>/g, '')
  for (const plan of pricing.EXPERIENCE_PLANS) {
    const total = pricing.experiencePrice(plan.hours * 60, { peopleCount: 1, faceRecordingConsent: true }).serviceTotalJpy
    assert.ok(html.includes(`With social media participation: ¥${total.toLocaleString('en-US')} total`))
  }
  assert.match(html, /From ¥13,200 with social media participation, including tax and transportation/)
  assert.doesNotMatch(html, /¥12,000 total|From ¥26,000/)
})

#!/usr/bin/env node
/** Read-only source inventory. No network, app imports, database calls or Git writes. */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)))
const output = path.resolve(root, process.argv[2] ?? 'docs/audit/2026-11-18/repository-inventory.json')
const outputDirectory = path.dirname(output)
if (!output.startsWith(root + path.sep) || !output.endsWith('.json')) throw new Error('Output must be a JSON file inside the repository')
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }).trim()
const paths = [...new Set(git('ls-files', '--cached', '--others', '--exclude-standard', '-z').split('\0'))]
  .filter(Boolean).filter(file => path.resolve(root, file) !== output)
  .filter(file => !file.startsWith('docs/audit/2026-11-18/'))
  .filter(file => existsSync(path.join(root, file)) && statSync(path.join(root, file)).isFile()).sort()
const config = ts.readConfigFile(path.join(root, 'tsconfig.json'), ts.sys.readFile)
if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'))
const compilerOptions = ts.parseJsonConfigFileContent(config.config, ts.sys, root).options
const relative = file => path.relative(root, file).split(path.sep).join('/')
const resolveImport = (specifier, file) => {
  if (!specifier.startsWith('.') && !specifier.startsWith('@/')) return null
  const resolution = ts.resolveModuleName(specifier, path.join(root, file), compilerOptions, ts.sys).resolvedModule
  if (resolution && !resolution.isExternalLibraryImport) return relative(resolution.resolvedFileName)
  // TypeScript does not resolve Next's CSS/asset side-effect imports as source
  // modules. An existing asset is not an unresolved application dependency.
  const asset = specifier.startsWith('@/') ? path.join(root, 'src', specifier.slice(2)) : path.resolve(root, path.dirname(file), specifier)
  return /\.(?:css|json|svg|png|jpe?g|webp)$/i.test(asset) && existsSync(asset) && statSync(asset).isFile() ? relative(asset) : null
}
const rolesDeclaration = readFileSync(path.join(root, 'src/lib/constants.ts'), 'utf8').match(/export const ROLES = \[([\s\S]*?)\] as const/)
if (!rolesDeclaration) throw new Error('Canonical roles declaration was not found; refusing an incomplete role inventory')
const declaredRoles = [...rolesDeclaration[1].matchAll(/['"]([A-Z_]+)['"]/g)].map(match => match[1])
const roleLiteralPattern = new RegExp(`['"](${[...declaredRoles, 'EMPLOYEE', 'CLIENT', 'OWNER'].join('|')})['"]`, 'g')
const methodNames = new Set(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'])
const sourcePattern = /\.(?:[cm]?[jt]sx?)$/i
const files = paths.map(file => {
  const buffer = readFileSync(path.join(root, file))
  const binary = buffer.subarray(0, 8192).includes(0) || /\.(?:webp|png|jpe?g|gif|mp4|woff2?|ico|zip|pdf)$/i.test(file)
  const text = binary ? '' : buffer.toString('utf8')
  const archived = /^(?:legacy|examples|fixes|\.zscripts)\//.test(file)
  const category = archived ? 'historical/reference, excluded from application build'
    : /^src\/app\/api\//.test(file) ? 'Next.js API route'
    : /^src\/app\//.test(file) ? 'Next.js page/layout/route'
    : /^src\/components\//.test(file) ? 'React component'
    : /^src\/lib\//.test(file) ? 'application service/policy/helper'
    : /^src\/hooks\//.test(file) ? 'React hook'
    : /^src\/data\//.test(file) ? 'application content/catalogue'
    : /^tests\//.test(file) ? 'test/support tooling'
    : /^prisma\/migrations\//.test(file) ? 'published MySQL migration'
    : /^prisma\//.test(file) ? 'database schema/seed/manifest'
    : /^mini-services\//.test(file) ? 'optional independent sidecar'
    : /^n8n\//.test(file) ? 'n8n workflow/template/documentation'
    : /^public\//.test(file) ? 'publicly served asset'
    : /^docs\//.test(file) || /\.md$/.test(file) ? 'documentation (claims require separate verification)'
    : /^scripts\//.test(file) ? 'operational/development script'
    : /^\.github\//.test(file) ? 'CI/repository configuration'
    : 'configuration/data/supporting artifact'
  const item = {
    path: file, category, bytes: buffer.length, sha256: createHash('sha256').update(buffer).digest('hex'),
    inspection: binary ? 'format/path inventory; visual/content acceptance not executed' : 'entire file read; structural analysis, not proof of semantic correctness',
    lines: binary ? null : text.split(/\r?\n/).length,
    imports: [], exports: [], functions: [], calls: [], environmentNames: [], roles: [],
    databaseCalls: [], securityCalls: [], validationCalls: [], externalCalls: [], ownershipFields: [],
    consumers: [], directTestReferences: [], methods: [], syntaxErrors: [],
    clientComponent: false, frameworkEntry: /^src\/(?:app\/.*\/(?:page|route|layout|loading|error|not-found)|app\/(?:page|layout)|proxy)\.[jt]sx?$/.test(file),
    evidenceLimit: 'Static call/import evidence only. Authentication, authorization, ownership and completeness require route/service review and behavioral tests.',
  }
  if (!binary) {
    item.environmentNames = [...new Set([...text.matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)].map(match => match[1]))].sort()
    item.roles = [...new Set([...text.matchAll(roleLiteralPattern)].map(match => match[1]))].sort()
    item.ownershipFields = [...new Set([...text.matchAll(/\b(clientId|clientRowId|companyId|tenantId|applicationId|projectId|conversationId|sessionToken)\b/g)].map(match => match[1]))].sort()
  }
  if (binary || !sourcePattern.test(file)) return item
  const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
  item.clientComponent = ast.statements.some(node => ts.isExpressionStatement(node) && ts.isStringLiteral(node.expression) && node.expression.text === 'use client')
  const lineOf = node => ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1
  const importEntry = (node, specifier, kind, typeOnly = false) => {
    item.imports.push({ specifier, kind, typeOnly, line: lineOf(node), resolved: resolveImport(specifier, file) })
  }
  const visit = node => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) importEntry(node, node.moduleSpecifier.text, 'static', Boolean(node.importClause?.isTypeOnly))
    if (ts.isExportDeclaration(node)) {
      if (node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) importEntry(node, node.moduleSpecifier.text, 're-export', Boolean(node.isTypeOnly))
      if (node.exportClause && ts.isNamedExports(node.exportClause)) {
        for (const element of node.exportClause.elements) {
          item.exports.push({ name: element.name.text, line: lineOf(element) })
          if (methodNames.has(element.name.text)) item.methods.push(element.name.text)
        }
      }
    }
    if (ts.isCallExpression(node)) {
      const expression = node.expression.getText(ast)
      if ((node.expression.kind === ts.SyntaxKind.ImportKeyword || expression === 'require') && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) importEntry(node, node.arguments[0].text, expression === 'require' ? 'require' : 'dynamic')
      if (expression.length <= 180 && !/[\r\n]/.test(expression)) {
        const call = { expression, line: lineOf(node) }
        item.calls.push(call)
        if (/^(?:db|prisma|tx|trx|transaction)\./.test(expression)) item.databaseCalls.push(call)
        if (/(?:guard|require[A-Z]|authorize|assertCsrf|currentUser|portalGate|portalSession|verifySignature|verifyWebhook|constantTimeEquals|rateLimit|checkPermission|hasRole|hasCapability|isSuperAdmin|tenantOf|sameTenant|resolveVisitorConversation|getConversationForTenant)/i.test(expression)) item.securityCalls.push(call)
        if (/(?:readJson|\.json$|\.formData$|\.parse$|\.safeParse$|sanitize|validate|assert)/i.test(expression)) item.validationCalls.push(call)
        if (/(?:\bfetch$|sendMail|sendCommunication|runAgent|callProvider|sendWhatsApp|\.infer$|\.chat$|\.embeddings$)/i.test(expression)) item.externalCalls.push(call)
      }
    }
    if ((ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) && node.name) item.functions.push({ name: node.name.getText(ast), line: lineOf(node) })
    if (node.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
      const names = ts.isVariableStatement(node) ? node.declarationList.declarations.map(declaration => declaration.name.getText(ast)) : node.name ? [node.name.getText(ast)] : ['default']
      for (const name of names) {
        item.exports.push({ name, line: lineOf(node) })
        if (methodNames.has(name)) item.methods.push(name)
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(ast)
  item.syntaxErrors = ast.parseDiagnostics.map(diagnostic => ({ code: diagnostic.code, line: diagnostic.start === undefined ? null : ast.getLineAndCharacterOfPosition(diagnostic.start).line + 1, message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n') }))
  item.methods = [...new Set(item.methods)]
  item.rawSourceReferences = /^tests\//.test(file) ? [...new Set([...text.matchAll(/(?:\.\.\/)?(src\/[A-Za-z0-9_./\[\]-]+\.(?:ts|tsx|mjs|js))/g)].map(match => match[1]))] : []
  return item
})
const byPath = new Map(files.map(file => [file.path, file]))
for (const file of files) {
  for (const entry of file.imports) {
    const dependency = byPath.get(entry.resolved)
    if (!dependency) continue
    dependency.consumers.push({ path: file.path, line: entry.line, kind: entry.kind, typeOnly: entry.typeOnly })
    if (file.path.startsWith('tests/')) dependency.directTestReferences.push(file.path)
  }
  for (const reference of file.rawSourceReferences ?? []) if (byPath.has(reference)) byPath.get(reference).directTestReferences.push(file.path)
}
for (const file of files) file.directTestReferences = [...new Set(file.directTestReferences)].sort()
const unresolvedLocalImports = files.filter(file => file.path.startsWith('src/')).flatMap(file => file.imports.filter(entry => (entry.specifier.startsWith('.') || entry.specifier.startsWith('@/')) && !entry.resolved).map(entry => ({ file: file.path, ...entry })))
const routeFiles = files.filter(file => /^src\/app\/api\/.*\/route\.[jt]s$/.test(file.path))
const api = routeFiles.map(file => ({ path: file.path, url: '/' + file.path.replace(/^src\/app\//, '').replace(/\/route\.[jt]s$/, ''), methods: file.methods, imports: file.imports, databaseCalls: file.databaseCalls, securityCalls: file.securityCalls, validationCalls: file.validationCalls, externalCalls: file.externalCalls, ownershipFields: file.ownershipFields, roles: file.roles, directTestReferences: file.directTestReferences, behavioralStatus: 'not inferred from static signals; see final audit report and executed tests' }))
const modelText = readFileSync(path.join(root, 'prisma/schema.prisma'), 'utf8')
const summary = {
  repositoryFilesRead: files.length, textFilesRead: files.filter(file => file.lines !== null).length,
  binaryAssetsInventoried: files.filter(file => file.lines === null).length,
  activeSourceFiles: files.filter(file => file.path.startsWith('src/') && sourcePattern.test(file.path)).length,
  apiRouteFiles: routeFiles.length, apiMethodExports: api.reduce((sum, route) => sum + route.methods.length, 0),
  prismaModels: [...modelText.matchAll(/^model\s+\w+\s*\{/gm)].length,
  publishedMigrations: files.filter(file => /^prisma\/migrations\/[^/]+\/migration.sql$/.test(file.path)).length,
  declaredRoles,
  standardTestFiles: files.filter(file => /^tests\/.*\.test\.ts$/.test(file.path)).length,
  nonstandardTestScripts: files.filter(file => /^tests\/.*\.(?:mjs|sh)$/.test(file.path)).map(file => file.path),
  byTopLevelDirectory: Object.fromEntries([...new Set(files.map(file => file.path.split('/')[0]))].sort().map(directory => [directory, files.filter(file => file.path.split('/')[0] === directory).length])),
  unresolvedActiveLocalImports: unresolvedLocalImports,
  activeSyntaxErrors: files.filter(file => file.path.startsWith('src/') && file.syntaxErrors.length).map(file => ({ path: file.path, errors: file.syntaxErrors })),
}
mkdirSync(outputDirectory, { recursive: true })
writeFileSync(output, JSON.stringify({ generatedAt: new Date().toISOString(), branch: git('branch', '--show-current'), head: git('rev-parse', 'HEAD'), methodology: 'Read every tracked/non-ignored working file except this audit output directory; parse all JS/TS with the installed TypeScript parser; report evidence, never infer absence of guards/ownership as proof of a vulnerability or code as unused.', summary, api, files }, null, 2) + '\n')
console.log(JSON.stringify(summary, null, 2))
console.log(`Wrote ${relative(output)}`)

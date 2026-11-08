/** Walk src/ for the static (Node-context) guard specs. */
import fs from 'node:fs'
import path from 'node:path'

export const SRC = path.join(process.cwd(), 'src')

export function sourceFiles(dir: string, exts = ['.ts', '.tsx', '.css']): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(full, exts)
    return exts.includes(path.extname(entry.name)) ? [full] : []
  })
}

export function rel(file: string): string {
  return path.relative(process.cwd(), file)
}

/** Strip block and line comments (keeps code-only scanning honest). */
export function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
}

/** Module specifiers imported by a file (static `import … from '…'`). */
export function importsOf(file: string): string[] {
  const text = fs.readFileSync(file, 'utf8')
  return [...text.matchAll(/^\s*import\s[^'"]*?from\s+['"]([^'"]+)['"]/gm)].map((m) => m[1])
}

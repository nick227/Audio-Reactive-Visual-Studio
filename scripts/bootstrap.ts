import { execSync } from 'child_process'
import { existsSync, copyFileSync } from 'fs'
import { resolve } from 'path'

const root = resolve(__dirname, '..')

function run(cmd: string, label: string) {
  console.log(`\n→ ${label}`)
  execSync(cmd, { stdio: 'inherit', cwd: root })
  console.log(`✓ ${label}`)
}

const envPath = resolve(root, '.env')
const envExample = resolve(root, '.env.example')
if (!existsSync(envPath)) {
  copyFileSync(envExample, envPath)
  console.log('\n⚠  .env created from .env.example')
  console.log('   Fill in DATABASE_URL and GOOGLE_CLIENT_ID before continuing.\n')
  process.exit(0)
}

console.log('🚀 Bootstrapping project...\n')

run('pnpm install', 'Install dependencies')
run('pnpm --filter @avl/db exec prisma generate', 'Generate Prisma client')
run('pnpm db:push', 'Push schema to database')
run('pnpm sdk:generate', 'Generate SDK types from OpenAPI spec')

console.log('\n✅  Bootstrap complete.')
console.log('   Run `pnpm dev` to start the app.')
console.log('   Web:  http://localhost:5173')
console.log('   API:  http://localhost:3001')
console.log('   Docs: http://localhost:3001/docs\n')

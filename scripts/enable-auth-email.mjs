#!/usr/bin/env node
/**
 * Enable Supabase Auth signup/recovery email via Resend + send-email hook.
 * Usage (PowerShell):
 *   $env:RESEND_API_KEY="re_..."; node scripts/enable-auth-email.mjs
 */
import { randomBytes } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const apiKey = (process.argv[2] ?? process.env.RESEND_API_KEY ?? '').trim()
if (!apiKey.startsWith('re_')) {
  console.error('Missing Resend API key. Run:')
  console.error('  $env:RESEND_API_KEY="re_..."; node scripts/enable-auth-email.mjs')
  console.error('  — or —')
  console.error('  node scripts/enable-auth-email.mjs re_...')
  process.exit(1)
}

const hookSecret =
  process.env.SEND_EMAIL_HOOK_SECRET?.trim() ||
  `v1,whsec_${randomBytes(32).toString('base64')}`

const secretsFile = resolve(process.cwd(), '.env.auth-email.secrets')
writeFileSync(
  secretsFile,
  `RESEND_API_KEY=${apiKey}\nSEND_EMAIL_HOOK_SECRET=${hookSecret}\nAUTH_EMAIL_FROM=jobround.ai <support@jobround.ai>\n`,
  'utf8',
)

function run(cmd, args) {
  execFileSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32' })
}

console.log('Setting Supabase secrets…')
run('supabase', ['secrets', 'set', '--env-file', secretsFile])

console.log('Deploying send-email edge function…')
run('supabase', ['functions', 'deploy', 'send-email', '--no-verify-jwt'])

console.log('Pushing auth hook config…')
// config push does not resolve env() for hook secrets; patch the hook secret directly.
const configPath = resolve(process.cwd(), 'supabase', 'config.toml')
let configToml = readFileSync(configPath, 'utf8')
const patched = configToml.replace(
  /secrets = "env\(SEND_EMAIL_HOOK_SECRET\)"/,
  `secrets = "${hookSecret}"`,
)
writeFileSync(configPath, patched, 'utf8')
try {
  run('supabase', ['config', 'push', '--yes'])
} finally {
  writeFileSync(configPath, configToml, 'utf8')
}

console.log('Done. Try email/password signup on jobround.ai.')
console.log(`Hook secret stored in ${secretsFile} (gitignored via .env.*)`)

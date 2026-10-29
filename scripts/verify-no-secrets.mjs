import { execSync } from 'node:child_process';
import fs from 'node:fs';

console.log('🔍 Checking repository for committed secrets & credentials...');

// Concrete secret signatures that must NEVER appear anywhere in git-tracked files
const BLOCKED_LEGACY_TOKEN = Buffer.from('V2Vic3RvcmUlNDBmcmVl', 'base64').toString('utf8');

const FORBIDDEN_SIGNATURES = [
  { name: 'Leaked Supabase DB Password', regex: new RegExp(BLOCKED_LEGACY_TOKEN, 'i') },
  { name: 'Supabase Project Host with Credentials', regex: /zdcfxgqblhrnuikrzswp:[^@\s'"`]+@/i },
  { name: 'Live Resend API Key', regex: /\bre_[A-Za-z0-9]{22,}\b/ },
  { name: 'GitHub Personal Access Token', regex: /\bghp_[A-Za-z0-9]{36}\b/ },
  { name: 'Private Key PEM Block', regex: /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/ },
  { name: 'Hardcoded Production Database URL in src', check: (file, line) => {
      if (!file.startsWith('backend/src/') && !file.startsWith('src/')) return false;
      return /(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/[^:\s'"`]+:[^@\s'"`]+@[^/\s'"`]+/i.test(line);
    }
  }
];

const EXCLUDED_FILES = new Set([
  'scripts/verify-no-secrets.mjs',
  '.env',
  'package-lock.json'
]);

try {
  const trackedFilesOutput = execSync('git ls-files', { encoding: 'utf8' });
  const files = trackedFilesOutput.split(/\r?\n/).filter(Boolean);

  let violations = 0;

  for (const file of files) {
    if (EXCLUDED_FILES.has(file)) continue;
    if (file.startsWith('node_modules/') || file.startsWith('.git/')) continue;
    if (!fs.existsSync(file)) continue;

    const stats = fs.statSync(file);
    if (stats.size > 1024 * 1024) continue; // Skip files > 1MB

    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      for (const sig of FORBIDDEN_SIGNATURES) {
        let isMatch = false;
        if (typeof sig.check === 'function') {
          isMatch = sig.check(file, line);
        } else if (sig.regex && sig.regex.test(line)) {
          isMatch = true;
        }

        if (isMatch) {
          console.error(`❌ SECRET DETECTED in ${file}:${i + 1} - [${sig.name}]`);
          violations++;
        }
      }
    }
  }

  if (violations > 0) {
    console.error(`\n🚨 Failed: Found ${violations} secret violation(s) in tracked files. Remove them immediately!`);
    process.exit(1);
  }

  console.log('✅ No hardcoded secrets or credentials detected in tracked repository files.');
} catch (err) {
  console.error('Error executing secret scan:', err.message);
  process.exit(1);
}

/**
 * Scan the LangChain and Mastra cookbook notebooks for credentials in cell outputs.
 *
 *   npm run check:outputs          # from partners/mastra/
 *
 * Exits non-zero on the first notebook with a finding. Wired into `npm test`, so a
 * committed output that carries a connection string or key fails the suite rather
 * than reaching a public repository.
 *
 * Values currently in the .env are passed in as literals, so anything live
 * is caught even if it does not match one of the shape rules.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { findEnvFile } from '../src/config.js';
import { findSecretsInNotebook, type NotebookLike } from '../src/scrub.js';

const REPO_ROOT = resolve(import.meta.dirname, '../../..');
// The two sets that share the cookbook conventions. The rest of the repository's
// notebooks follow their own, so a finding there should not fail this package's tests.
const NOTEBOOK_DIRECTORIES = [
  'partners/mastra',
  'partners/langchain/advanced-rag',
  'partners/langchain/claude-code-mcp',
];
// Tunables from .env.example. The notebooks print these by design -- the config
// summary names the model -- and they ship filled in, so matching them would fail
// every copy of .env.example. Any other name is treated as a secret.
const NOT_SECRET = new Set([
  'MONGODB_DB',
  'MASTRA_REVIEWS_COLLECTION',
  'LANGCHAIN_AUTO_EMBED_COLLECTION',
  'EMBEDDING_MODEL',
  'EMBEDDING_DIMENSIONS',
  'ANTHROPIC_MODEL',
]);
const SKIP_DIRECTORIES = new Set(['node_modules', '.git', '.ipynb_checkpoints', '.venv']);

function findNotebooks(directory: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(directory)) {
    if (SKIP_DIRECTORIES.has(entry)) continue;
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) found.push(...findNotebooks(path));
    else if (entry.endsWith('.ipynb')) found.push(path);
  }
  return found.sort();
}

/**
 * Read the .env the notebooks use, if present, as name/value pairs to match verbatim.
 * Absent .env is fine -- the shape rules still run, which is what CI relies on.
 */
function readEnvLiterals(): Array<{ name: string; value: string }> {
  const literals: Array<{ name: string; value: string }> = [];
  let contents: string;
  try {
    contents = readFileSync(findEnvFile(resolve(import.meta.dirname, '..')), 'utf8');
  } catch {
    return literals;
  }
  for (const line of contents.split('\n')) {
    const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    const value = match[2]!.trim().replace(/^['"]|['"]$/g, '');
    if (value && !NOT_SECRET.has(match[1]!)) literals.push({ name: match[1]!, value });
  }
  return literals;
}

const literals = readEnvLiterals();
const notebooks = NOTEBOOK_DIRECTORIES.flatMap((directory) =>
  findNotebooks(join(REPO_ROOT, directory)),
);
let failures = 0;

console.log(
  `Scanning ${notebooks.length} notebook(s) for credentials in outputs` +
    (literals.length ? ` (plus ${literals.length} live .env value(s))` : ''),
);

for (const path of notebooks) {
  const relativePath = relative(REPO_ROOT, path);
  let notebook: NotebookLike;
  try {
    notebook = JSON.parse(readFileSync(path, 'utf8')) as NotebookLike;
  } catch (error) {
    console.error(`  ERROR ${relativePath}: not valid JSON (${(error as Error).message})`);
    failures += 1;
    continue;
  }

  const findings = findSecretsInNotebook(notebook, { literals });
  if (findings.length === 0) {
    console.log(`  ok   ${relativePath}`);
    continue;
  }

  failures += 1;
  console.error(`  FAIL ${relativePath}`);
  for (const finding of findings) {
    console.error(
      `         cell ${finding.cellIndex}, output ${finding.outputIndex}: ` +
        `${finding.rule} -- ${finding.excerpt}`,
    );
  }
}

if (failures > 0) {
  console.error(
    `\n${failures} notebook(s) contain credentials in committed output. ` +
      `Clear the offending cell output and re-run before committing.`,
  );
  process.exit(1);
}

console.log('\nNo credentials found in notebook outputs.');

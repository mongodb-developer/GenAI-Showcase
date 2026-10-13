/**
 * The .env loader every notebook opens with.
 *
 * The LangChain set calls `load_dotenv(override=True)` and then reads `os.getenv` with
 * inline defaults. This is the same idea with one deliberate difference, learned the
 * hard way: a variable the .env file omits falls back to the **documented default**,
 * not to whatever the surrounding shell holds.
 *
 * That distinction matters because `load_dotenv` only overlays the variables the file
 * declares. Anything it omits keeps the shell's value -- so a model id left in a shell
 * from unrelated work silently became the model a notebook used, and failed with an
 * error that pointed nowhere near the cause. Required secrets still fall back to the
 * shell (CI has no .env), but the tunables do not.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import { MissingSecretError, REVIEWS_COLLECTION, SAMPLE_MFLIX_DIMENSIONS } from './utils.js';

/** Values a notebook needs, resolved and validated. */
export interface NotebookConfig {
  mongodbUri: string;
  atlasApiKey: string;
  anthropicApiKey: string;
  dbName: string;
  embeddingModel: string;
  embeddingDimensions: number;
  anthropicModel: string;
  /** Set only when routing Claude through an Anthropic-compatible gateway. */
  anthropicBaseUrl: string | undefined;
  /**
   * Name notebook 02 uses for the scratch collection it creates and drops.
   *
   * Overridable because the notebook refuses to touch a collection that already exists,
   * and a reader who happens to have this name in use needs a way out.
   */
  reviewsCollection: string;
  /** A one-line, secret-free confirmation the notebooks print and commit. */
  summary: string;
}

/**
 * Parse .env contents into name/value pairs.
 *
 * A declared-but-empty value is treated as absent: `.env.example` ships
 * `ANTHROPIC_BASE_URL=` to document the variable, and a reader who left it blank has
 * not configured a gateway.
 */
export function parseEnv(contents: string): Record<string, string> {
  const parsed: Record<string, string> = {};
  for (const line of contents.split('\n')) {
    const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    const value = match[2]!.trim().replace(/^["']|["']$/g, '');
    if (value) parsed[match[1]!] = value;
  }
  return parsed;
}

/** Read and parse the .env file, treating an absent file as empty. */
function readEnvFile(path: string): Record<string, string> {
  try {
    return parseEnv(readFileSync(path, 'utf8'));
  } catch {
    return {};
  }
}

/**
 * Find the .env by walking up from the working directory.
 *
 * Deliberately NOT `new URL('../../../.env', import.meta.url)`. tslab -- the notebook
 * kernel -- transpiles to CommonJS while this package is `"type": "module"`, so Node
 * reads the emitted `.js` as ESM. TypeScript passes `import.meta` through unchanged
 * (CommonJS has no equivalent), and the `exports` assignments in the same file then
 * throw `ReferenceError: exports is not defined in ES module scope` the moment a
 * notebook imports it. Walking up from `process.cwd()` needs no module metadata and
 * works under the kernel, vitest, and tsx alike.
 *
 * Returns the deepest `.env` found at or above the start directory, or the start
 * directory's own path when there is none, so the "no .env, use the shell" path still
 * has a sensible name to report. The scripts start from this package's directory,
 * so they read the same file the notebooks do.
 */
export function findEnvFile(startDir: string): string {
  let directory = resolve(startDir);
  for (;;) {
    const candidate = join(directory, '.env');
    if (existsSync(candidate)) return candidate;
    const parent = dirname(directory);
    if (parent === directory) return join(resolve(startDir), '.env');
    directory = parent;
  }
}

/**
 * Resolve everything a notebook needs from the .env.
 *
 * `envPath` defaults to the nearest `.env` at or above the working directory, which is
 * `partners/mastra/.env` when a notebook runs from `partners/mastra/`.
 */
export function loadNotebookConfig(
  opts: { envPath?: string; env?: Record<string, string | undefined> } = {},
): NotebookConfig {
  const envPath = opts.envPath ?? findEnvFile(process.cwd());
  const env = opts.env ?? process.env;
  const file = readEnvFile(envPath);

  /** A required secret: .env first, then the shell (CI has no .env file). */
  const secret = (name: string): string => {
    const value = file[name] ?? env[name];
    if (value && value.trim()) return value;
    throw new MissingSecretError(name);
  };

  /** A tunable: .env or the documented default. The shell is never consulted. */
  const setting = (name: string, fallback: string): string => file[name] ?? fallback;

  const dimensionsRaw = setting('EMBEDDING_DIMENSIONS', String(SAMPLE_MFLIX_DIMENSIONS));
  const embeddingDimensions = Number(dimensionsRaw);
  if (!Number.isInteger(embeddingDimensions) || embeddingDimensions <= 0) {
    throw new Error(
      `EMBEDDING_DIMENSIONS must be a positive integer, got "${dimensionsRaw}". ` +
        `sample_mflix stores ${SAMPLE_MFLIX_DIMENSIONS}-d plot vectors.`,
    );
  }

  const embeddingModel = setting('EMBEDDING_MODEL', 'voyage-3-large');
  const dbName = setting('MONGODB_DB', 'sample_mflix');
  const anthropicModel = setting('ANTHROPIC_MODEL', 'claude-haiku-4-5');
  const anthropicBaseUrl = file['ANTHROPIC_BASE_URL'];
  const reviewsCollection = setting('MASTRA_REVIEWS_COLLECTION', REVIEWS_COLLECTION);

  return {
    mongodbUri: secret('MONGODB_URI'),
    atlasApiKey: secret('MDB_ATLAS_API_KEY'),
    anthropicApiKey: secret('ANTHROPIC_API_KEY'),
    dbName,
    embeddingModel,
    embeddingDimensions,
    anthropicModel,
    anthropicBaseUrl,
    reviewsCollection,
    // Deliberately excludes the connection string and every key: notebooks print this
    // line and commit the output to a public repository.
    summary:
      `db=${dbName} · embeddings=${embeddingModel} (${embeddingDimensions}-d) · ` +
      `llm=${anthropicModel}${anthropicBaseUrl ? ' via gateway' : ''}`,
  };
}

/**
 * Unit tests for src/config.ts -- the .env loader the notebooks open with.
 *
 * Run from partners/mastra/:  npm run test:unit
 *
 * Two behaviours here are not obvious and are the reason this module exists rather
 * than a one-line `dotenv` call:
 *
 * 1. A value the .env file omits must fall back to a documented default, NOT to
 *    whatever the surrounding shell happens to hold. An ANTHROPIC_MODEL left over
 *    in a shell from unrelated work reached the gateway during development and came
 *    back DeploymentNotFound. The notebook's own default is the correct answer.
 * 2. A value the .env file DOES declare must win over the shell, because the .env is
 *    the file the reader just edited.
 */
import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { loadNotebookConfig, parseEnv } from './config.js';
import { REVIEWS_COLLECTION } from './utils.js';

/** Write a .env into a throwaway directory and return the file path. */
function envFile(contents: string): string {
  const path = join(mkdtempSync(join(tmpdir(), 'mastra-config-')), '.env');
  writeFileSync(path, contents);
  return path;
}

describe('parseEnv', () => {
  it('reads name=value pairs', () => {
    expect(parseEnv('A=1\nB=two\n')).toEqual({ A: '1', B: 'two' });
  });

  it('ignores comments and blank lines', () => {
    expect(parseEnv('# a comment\n\nA=1\n   \n')).toEqual({ A: '1' });
  });

  it('strips surrounding quotes', () => {
    expect(parseEnv(`A="quoted"\nB='single'\n`)).toEqual({ A: 'quoted', B: 'single' });
  });

  it('tolerates an export prefix, which people paste from shell profiles', () => {
    expect(parseEnv('export A=1\n')).toEqual({ A: '1' });
  });

  it('keeps = inside a value, because connection strings and URLs contain them', () => {
    expect(parseEnv('MONGODB_URI=mongodb+srv://h/?retryWrites=true&w=majority\n')).toEqual({
      MONGODB_URI: 'mongodb+srv://h/?retryWrites=true&w=majority',
    });
  });

  it('treats a declared-but-empty value as absent', () => {
    // .env.example ships `ANTHROPIC_BASE_URL=` to document the variable. That is a
    // reader who did NOT set a gateway, not a reader who set it to empty string.
    expect(parseEnv('ANTHROPIC_BASE_URL=\n')).toEqual({});
  });
});

// --------------------------------------------------------------------------
// The constraint that makes this module usable from a notebook at all.
// --------------------------------------------------------------------------
describe('tslab compatibility', () => {
  it('uses no import.meta, which breaks the notebook kernel', () => {
    // tslab transpiles to CommonJS, but this package is "type": "module", so Node
    // reads the emitted .js as ESM. TypeScript leaves `import.meta` untouched (it has
    // no CommonJS equivalent), and the CommonJS `exports` in the same file then throws
    // `ReferenceError: exports is not defined in ES module scope` on import. Any
    // module a notebook imports must therefore avoid import.meta entirely.
    //
    // Verified empirically: adding a single `import.meta.url` to an otherwise-working
    // module turned a passing notebook cell into that ReferenceError.
    const source = readFileSync(new URL('./config.ts', import.meta.url), 'utf8');
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(code).not.toMatch(/import\s*\.\s*meta/);
  });
});

describe('loadNotebookConfig', () => {
  const uri = 'mongodb+srv://u:p@cluster.mongodb.net/';

  it('returns the required secrets from the .env file', () => {
    const path = envFile(
      `MONGODB_URI=${uri}\nMDB_ATLAS_API_KEY=atlas-key\nANTHROPIC_API_KEY=claude-key\n`,
    );
    const config = loadNotebookConfig({ envPath: path, env: {} });

    expect(config.mongodbUri).toBe(uri);
    expect(config.atlasApiKey).toBe('atlas-key');
    expect(config.anthropicApiKey).toBe('claude-key');
  });

  it('defaults the tunables to what sample_mflix actually stores', () => {
    const path = envFile(
      `MONGODB_URI=${uri}\nMDB_ATLAS_API_KEY=k\nANTHROPIC_API_KEY=k\n`,
    );
    const config = loadNotebookConfig({ envPath: path, env: {} });

    expect(config.dbName).toBe('sample_mflix');
    expect(config.embeddingModel).toBe('voyage-3-large');
    expect(config.embeddingDimensions).toBe(2048);
    expect(config.anthropicModel).toBe('claude-haiku-4-5');
    expect(config.anthropicBaseUrl).toBeUndefined();
    expect(config.reviewsCollection).toBe(REVIEWS_COLLECTION);
  });

  it('lets the .env rename notebook 02 scratch collection', () => {
    // The escape hatch for a reader who already has a collection by the default name.
    // Notebook 02 refuses to reuse one it did not create, so without this the notebook
    // would be unrunnable for them.
    const path = envFile(
      `MONGODB_URI=${uri}\nMDB_ATLAS_API_KEY=k\nANTHROPIC_API_KEY=k\n` +
        `MASTRA_REVIEWS_COLLECTION=cookbook_scratch_42\n`,
    );
    const config = loadNotebookConfig({ envPath: path, env: {} });

    expect(config.reviewsCollection).toBe('cookbook_scratch_42');
  });

  it('lets the .env override a default', () => {
    const path = envFile(
      `MONGODB_URI=${uri}\nMDB_ATLAS_API_KEY=k\nANTHROPIC_API_KEY=k\n` +
        `MONGODB_DB=my_db\nEMBEDDING_DIMENSIONS=1024\nANTHROPIC_MODEL=claude-sonnet-5\n`,
    );
    const config = loadNotebookConfig({ envPath: path, env: {} });

    expect(config.dbName).toBe('my_db');
    expect(config.embeddingDimensions).toBe(1024);
    expect(config.anthropicModel).toBe('claude-sonnet-5');
  });

  it('does NOT inherit a variable the .env omits from the ambient shell', () => {
    // The bug this prevents: a Bedrock model id left in a shell from other work
    // reaching an Anthropic gateway as DeploymentNotFound. An omitted variable
    // means "use the documented default", not "use whatever the shell has".
    const path = envFile(`MONGODB_URI=${uri}\nMDB_ATLAS_API_KEY=k\nANTHROPIC_API_KEY=k\n`);
    const config = loadNotebookConfig({
      envPath: path,
      env: { ANTHROPIC_MODEL: 'global.anthropic.claude-opus-5', MONGODB_DB: 'someone_elses_db' },
    });

    expect(config.anthropicModel).toBe('claude-haiku-4-5');
    expect(config.dbName).toBe('sample_mflix');
  });

  it('falls back to the shell for a REQUIRED secret when there is no .env at all', () => {
    // CI and `export MONGODB_URI=... jupyter lab` are both legitimate. Only the
    // required secrets work this way; the tunables always come from .env or default.
    const config = loadNotebookConfig({
      envPath: join(tmpdir(), 'definitely-absent-mastra-env'),
      env: { MONGODB_URI: uri, MDB_ATLAS_API_KEY: 'k', ANTHROPIC_API_KEY: 'k' },
    });
    expect(config.mongodbUri).toBe(uri);
  });

  it('throws naming the variable and the file when a secret is missing everywhere', () => {
    const path = envFile(`MDB_ATLAS_API_KEY=k\nANTHROPIC_API_KEY=k\n`);
    expect(() => loadNotebookConfig({ envPath: path, env: {} })).toThrow(/MONGODB_URI/);
  });

  it('exposes a gateway base URL when one is configured', () => {
    const path = envFile(
      `MONGODB_URI=${uri}\nMDB_ATLAS_API_KEY=k\nANTHROPIC_API_KEY=k\n` +
        `ANTHROPIC_BASE_URL=https://gw.example.net/anthropic\n`,
    );
    const config = loadNotebookConfig({ envPath: path, env: {} });
    expect(config.anthropicBaseUrl).toBe('https://gw.example.net/anthropic');
  });

  it('never puts a secret in the summary line notebooks print', () => {
    const path = envFile(
      `MONGODB_URI=${uri}\nMDB_ATLAS_API_KEY=atlas-key-value\nANTHROPIC_API_KEY=claude-key-value\n`,
    );
    const config = loadNotebookConfig({ envPath: path, env: {} });

    // Every notebook prints this to confirm setup, and every notebook commits that
    // output to a public repository.
    expect(config.summary).not.toContain('atlas-key-value');
    expect(config.summary).not.toContain('claude-key-value');
    expect(config.summary).not.toContain('cluster.mongodb.net');
    expect(config.summary).toContain('voyage-3-large');
    expect(config.summary).toContain('sample_mflix');
  });

  it('finds the repository .env from its default location', () => {
    // No envPath: the default must resolve to the repo root .env, which is the whole
    // point of the zero-argument call every notebook makes.
    const config = loadNotebookConfig();
    expect(config.mongodbUri).toMatch(/^mongodb(\+srv)?:\/\//);
    expect(config.dbName).toBeTruthy();
  });

  it('rejects a non-numeric EMBEDDING_DIMENSIONS instead of yielding NaN', () => {
    const path = envFile(
      `MONGODB_URI=${uri}\nMDB_ATLAS_API_KEY=k\nANTHROPIC_API_KEY=k\nEMBEDDING_DIMENSIONS=lots\n`,
    );
    expect(() => loadNotebookConfig({ envPath: path, env: {} })).toThrow(/EMBEDDING_DIMENSIONS/);
  });
});

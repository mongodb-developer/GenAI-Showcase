/**
 * Unit tests for src/scrub.ts.
 *
 * The notebooks in this repo ship with their outputs committed, so a reader can see
 * what the code produces without an Atlas cluster. That is a deliberate trade: it also
 * means a stray credential in a cell output would be committed to a public repository.
 * These tests pin the scanner that stops that.
 */
import { describe, expect, it } from 'vitest';

import { findSecretsInNotebook, redact, type NotebookLike } from './scrub.js';

/** Minimal notebook shaped like the fields the scanner reads. */
function notebook(outputs: unknown[]): NotebookLike {
  return {
    cells: [{ cell_type: 'code', source: ['print(1)'], outputs: outputs as any }],
  } as NotebookLike;
}

// Assembled at runtime so the source never holds a credential-shaped literal: secret
// scanners on the repository would otherwise flag these fakes as live credentials.
const FAKE_CREDENTIAL = ['qx7', 'vk2', 'zm9'].join('');
const REAL_LOOKING_URI = ['mongodb+srv://appuser', FAKE_CREDENTIAL].join(':') + '@m0.abcde.mongodb.net/';
const FAKE_LIVE_VALUE = ['zzq', 'not', 'a', 'pattern', '999'].join('-');

describe('findSecretsInNotebook', () => {
  it('passes a clean notebook', () => {
    const findings = findSecretsInNotebook(
      notebook([{ output_type: 'stream', text: ['Connected to sample_mflix\n'] }]),
    );
    expect(findings).toEqual([]);
  });

  it('flags a connection string with an embedded password in stream output', () => {
    const findings = findSecretsInNotebook(
      notebook([{ output_type: 'stream', text: [`Using ${REAL_LOOKING_URI}\n`] }]),
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]!.rule).toBe('mongodb-uri-with-credentials');
  });

  it('allows a credential-free connection string', () => {
    // Printing the host is useful teaching output; only the userinfo is sensitive.
    const findings = findSecretsInNotebook(
      notebook([{ output_type: 'stream', text: ['host: m0.abcde.mongodb.net\n'] }]),
    );
    expect(findings).toEqual([]);
  });

  it('allows a placeholder connection string of the kind .env.example carries', () => {
    const findings = findSecretsInNotebook(
      notebook([
        { output_type: 'stream', text: ['mongodb+srv://<username>:<password>@cluster.mongodb.net/'] },
      ]),
    );
    expect(findings).toEqual([]);
  });

  it('flags an Anthropic API key', () => {
    const findings = findSecretsInNotebook(
      notebook([
        {
          output_type: 'execute_result',
          data: { 'text/plain': [`key=sk-ant-api03-${'A'.repeat(24)}`] },
        },
      ]),
    );
    expect(findings.map((f) => f.rule)).toContain('anthropic-api-key');
  });

  it('flags a bearer token', () => {
    const findings = findSecretsInNotebook(
      notebook([{ output_type: 'stream', text: ['Authorization: Bearer abcdef0123456789abcdef'] }]),
    );
    expect(findings.map((f) => f.rule)).toContain('bearer-token');
  });

  it('scans error tracebacks, where a URI most often leaks', () => {
    // A failed connection raises with the full URI in the message. This is the leak
    // path that matters most in practice -- nobody prints their password on purpose.
    const findings = findSecretsInNotebook(
      notebook([
        {
          output_type: 'error',
          ename: 'MongoServerSelectionError',
          evalue: `connection to ${REAL_LOOKING_URI} failed`,
          traceback: ['Traceback...'],
        },
      ]),
    );
    expect(findings).toHaveLength(1);
  });

  it('scans HTML and JSON mime bundles, not just text/plain', () => {
    const findings = findSecretsInNotebook(
      notebook([
        { output_type: 'display_data', data: { 'text/html': [`<pre>${REAL_LOOKING_URI}</pre>`] } },
      ]),
    );
    expect(findings).toHaveLength(1);
  });

  it('flags a literal value supplied from the environment', () => {
    // Catches anything the pattern rules miss: if a value is live in .env and appears
    // verbatim in an output, it leaked regardless of what shape it has.
    const findings = findSecretsInNotebook(
      notebook([{ output_type: 'stream', text: [`token: ${FAKE_LIVE_VALUE}`] }]),
      { literals: [{ name: 'MY_VALUE', value: FAKE_LIVE_VALUE }] },
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]!.rule).toBe('env-value:MY_VALUE');
  });

  it('ignores short environment values that would match everywhere', () => {
    // MONGODB_DB=sample_mflix is a legitimate env var and appears in output constantly.
    // Treating every env value as a secret would make the check useless.
    const findings = findSecretsInNotebook(
      notebook([{ output_type: 'stream', text: ['db: sample_mflix\n'] }]),
      { literals: [{ name: 'MONGODB_DB', value: 'sample_mflix' }] },
    );
    expect(findings).toEqual([]);
  });

  it('reports the cell index so the offending cell can be found', () => {
    const nb = {
      cells: [
        { cell_type: 'markdown', source: ['# Title'] },
        { cell_type: 'code', source: [''], outputs: [{ output_type: 'stream', text: ['ok'] }] },
        {
          cell_type: 'code',
          source: [''],
          outputs: [{ output_type: 'stream', text: [REAL_LOOKING_URI] }],
        },
      ],
    } as unknown as NotebookLike;
    expect(findSecretsInNotebook(nb)[0]!.cellIndex).toBe(2);
  });

  it('does not scan cell source, only outputs', () => {
    // Source is reviewed in the diff; outputs are generated and easy to miss. A source
    // finding would also fire on the regexes in this very scanner.
    const nb = {
      cells: [{ cell_type: 'code', source: [`URI = "${REAL_LOOKING_URI}"`], outputs: [] }],
    } as unknown as NotebookLike;
    expect(findSecretsInNotebook(nb)).toEqual([]);
  });

  it('tolerates a notebook with no cells', () => {
    expect(findSecretsInNotebook({ cells: [] } as unknown as NotebookLike)).toEqual([]);
  });
});

describe('redact', () => {
  it('masks the userinfo in a connection string', () => {
    expect(redact(`see ${REAL_LOOKING_URI}`)).not.toContain(FAKE_CREDENTIAL);
  });

  it('keeps enough context to identify where the leak is', () => {
    expect(redact(`see ${REAL_LOOKING_URI}`)).toContain('mongodb+srv://');
  });
});

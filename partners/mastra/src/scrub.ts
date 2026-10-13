/**
 * Credential scanner for committed notebook outputs.
 *
 * The notebooks in this repo commit their outputs so a reader can see real results
 * without a cluster of their own. That means every execution writes generated text
 * into a file that gets pushed to a public repository -- and a failed connection
 * raises with the full connection string in the traceback. This scans outputs for
 * things that must never be committed and fails the build if it finds any.
 *
 * Only outputs are scanned. Cell source is reviewed in the diff, and scanning it
 * would flag the patterns in this file.
 */

export interface NotebookCell {
  cell_type: string;
  source?: string | string[];
  outputs?: NotebookOutput[];
}

export interface NotebookOutput {
  output_type: string;
  text?: string | string[];
  data?: Record<string, string | string[]>;
  evalue?: string;
  ename?: string;
  traceback?: string[];
}

export interface NotebookLike {
  cells: NotebookCell[];
}

export interface Finding {
  cellIndex: number;
  outputIndex: number;
  rule: string;
  /** The matched text with the sensitive part masked, safe to print in CI logs. */
  excerpt: string;
}

interface PatternRule {
  name: string;
  pattern: RegExp;
}

/**
 * A userinfo section that looks like real credentials rather than a placeholder.
 * `<username>:<password>` and `USER:PASS` appear in docs and .env.example, so the
 * character class excludes `<>` and the password must contain a lowercase letter
 * and a digit -- which the ALL-CAPS placeholders do not.
 */
const MONGODB_URI_WITH_CREDENTIALS =
  /mongodb(?:\+srv)?:\/\/[^\s:/<>@]+:(?=[^\s@<>]*[a-z])(?=[^\s@<>]*\d)[^\s@<>]{6,}@/gi;

const PATTERN_RULES: PatternRule[] = [
  { name: 'mongodb-uri-with-credentials', pattern: MONGODB_URI_WITH_CREDENTIALS },
  { name: 'anthropic-api-key', pattern: /sk-ant-[A-Za-z0-9_-]{20,}/g },
  { name: 'bearer-token', pattern: /Bearer\s+[A-Za-z0-9._~+/=-]{20,}/gi },
  { name: 'aws-access-key-id', pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g },
  { name: 'openai-api-key', pattern: /\bsk-[A-Za-z0-9]{32,}\b/g },
  { name: 'private-key-block', pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
];

/**
 * Environment values shorter than this are not treated as secrets.
 *
 * `MONGODB_DB=sample_mflix` and `EMBEDDING_MODEL=voyage-3-large` are legitimately in
 * the environment and legitimately printed. Flagging every env value would make the
 * check noise, and noise gets ignored.
 */
const MIN_LITERAL_LENGTH = 16;

/** Mask a connection string's userinfo, keeping enough context to locate the leak. */
export function redact(text: string): string {
  return text
    .replace(MONGODB_URI_WITH_CREDENTIALS, (match) => {
      const scheme = match.slice(0, match.indexOf('://') + 3);
      return `${scheme}<redacted>@`;
    })
    .replace(/(sk-ant-|sk-|AKIA|ASIA)[A-Za-z0-9_-]{8,}/g, '$1<redacted>')
    .replace(/(Bearer\s+)[A-Za-z0-9._~+/=-]{20,}/gi, '$1<redacted>');
}

/** Flatten a notebook output into the strings worth scanning. */
function outputText(output: NotebookOutput): string[] {
  const parts: string[] = [];
  const push = (value: string | string[] | undefined) => {
    if (typeof value === 'string') parts.push(value);
    else if (Array.isArray(value)) parts.push(value.join(''));
  };

  push(output.text);
  push(output.evalue);
  push(output.traceback);
  for (const value of Object.values(output.data ?? {})) push(value);
  return parts;
}

export function findSecretsInNotebook(
  notebook: NotebookLike,
  opts: { literals?: Array<{ name: string; value: string }> } = {},
): Finding[] {
  const findings: Finding[] = [];
  const literals = (opts.literals ?? []).filter(
    (literal) => literal.value.trim().length >= MIN_LITERAL_LENGTH,
  );

  notebook.cells.forEach((cell, cellIndex) => {
    (cell.outputs ?? []).forEach((output, outputIndex) => {
      for (const text of outputText(output)) {
        for (const rule of PATTERN_RULES) {
          for (const match of text.match(rule.pattern) ?? []) {
            findings.push({
              cellIndex,
              outputIndex,
              rule: rule.name,
              excerpt: redact(match).slice(0, 120),
            });
          }
        }
        for (const literal of literals) {
          if (text.includes(literal.value)) {
            findings.push({
              cellIndex,
              outputIndex,
              rule: `env-value:${literal.name}`,
              excerpt: `value of ${literal.name} appears verbatim in output`,
            });
          }
        }
      }
    });
  });

  return findings;
}

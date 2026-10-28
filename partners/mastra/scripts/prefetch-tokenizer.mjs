/**
 * Download the Voyage tokenizer the notebooks need, at install time.
 *
 *   runs automatically as the `postinstall` script; `node scripts/prefetch-tokenizer.mjs`
 *   to re-run it by hand
 *
 * `voyageEmbedding()` tokenizes its input to batch requests, and the first call
 * downloads the tokenizer into node_modules/@huggingface/transformers/.cache. Inside
 * the tslab kernel that write wakes TypeScript's watch on node_modules, which leaves
 * tslab's rebuild timer pending: the next cell, and every one after it, fails with
 * "Unexpected pending rebuildTimer" until the kernel restarts. Once the files are
 * cached the kernel only reads them, so fetching them here keeps a fresh clone from
 * ever writing there mid-session.
 *
 * This is plain .mjs, not .ts, so it runs under bare node before anything else is
 * set up. It never fails the install: offline, it warns and the notebooks still
 * work after one kernel restart.
 */
import { AutoTokenizer } from '@huggingface/transformers';

// The models the notebooks pass to voyageEmbedding(). voyageContextualizedEmbedding()
// and the direct HTTP embedder in src/utils.ts do not tokenize locally.
const MODELS = ['voyage-3-large'];

for (const model of MODELS) {
  try {
    // The same call voyageai makes, so this fills the exact cache entry it reads.
    await AutoTokenizer.from_pretrained(`voyageai/${model}`);
    console.log(`Cached the ${model} tokenizer.`);
  } catch (error) {
    console.warn(
      `Could not prefetch the ${model} tokenizer (${error.message}). ` +
        'The first notebook cell that embeds will download it instead; if the next cell ' +
        'then fails with "Unexpected pending rebuildTimer", restart the kernel once.',
    );
  }
}

/**
 * Stamp sequential `execution_count` values onto this directory's notebooks.
 *
 *   npx tsx scripts/number-cells.ts          # from partners/mastra/
 *
 * The tslab kernel does not report an execution count, so a notebook executed with
 * `jupyter nbconvert --execute` comes back with `execution_count: null` on every cell
 * and `[ ]` in the margin -- which reads like it was never run. The LangChain notebooks
 * use the IPython kernel and number theirs 1..N, so the two halves of the repository
 * would otherwise look inconsistent.
 *
 * Run this only on a notebook that was just executed end to end. The numbering it writes
 * asserts that the cells ran in file order, which is true after nbconvert and is not
 * true after hand-editing a single cell in Jupyter.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

interface NotebookCell {
  cell_type: string;
  execution_count?: number | null;
  outputs?: Array<{ execution_count?: number | null }>;
}

const directory = import.meta.dirname ? join(import.meta.dirname, '..') : process.cwd();

let changedFiles = 0;
for (const entry of readdirSync(directory).sort()) {
  if (!entry.endsWith('.ipynb')) continue;

  const path = join(directory, entry);
  const notebook = JSON.parse(readFileSync(path, 'utf8')) as { cells: NotebookCell[] };

  let counter = 0;
  let changedCells = 0;
  for (const cell of notebook.cells) {
    if (cell.cell_type !== 'code') continue;
    counter += 1;
    if (cell.execution_count !== counter) {
      cell.execution_count = counter;
      changedCells += 1;
    }
    // `execute_result` outputs carry their own copy of the count; keep them in step.
    for (const output of cell.outputs ?? []) {
      if ('execution_count' in output && output.execution_count !== null) {
        output.execution_count = counter;
      }
    }
  }

  if (changedCells > 0) {
    writeFileSync(path, `${JSON.stringify(notebook, null, 1)}\n`);
    changedFiles += 1;
  }
  console.log(`  ${changedCells > 0 ? 'numbered' : 'unchanged'}  ${entry} (${counter} code cells)`);
}

console.log(changedFiles > 0 ? `\nUpdated ${changedFiles} notebook(s).` : '\nNothing to change.');

#!/usr/bin/env node
/** Turn test-results/results.json into a Markdown table for $GITHUB_STEP_SUMMARY. Titles and status only. */
import { readFileSync, existsSync } from 'node:fs';

const [file = 'test-results/results.json', heading = 'Post-release QA'] = process.argv.slice(2);
if (!existsSync(file)) { console.log(`### ${heading}\n\nNo results file: the suite did not run.`); process.exit(0); }
const report = JSON.parse(readFileSync(file, 'utf8'));
const rows = [];
const walk = (suite) => {
  for (const spec of suite.specs || []) {
    for (const t of spec.tests || []) {
      const last = t.results?.[t.results.length - 1];
      const status = t.status === 'skipped' ? 'SKIPPED' : t.status === 'expected' ? 'PASS' : t.status === 'flaky' ? 'PASS (retried)' : 'FAIL';
      const note = status === 'SKIPPED' ? (t.annotations?.find((a) => a.type === 'skip')?.description || '') : '';
      rows.push(`| ${spec.title} | ${status} | ${last ? Math.round(last.duration / 100) / 10 + 's' : ''} | ${note} |`);
    }
  }
  (suite.suites || []).forEach(walk);
};
(report.suites || []).forEach(walk);
const s = report.stats || {};
console.log(`### ${heading}\n`);
console.log(`Passed ${s.expected ?? 0}, failed ${s.unexpected ?? 0}, flaky ${s.flaky ?? 0}, skipped ${s.skipped ?? 0}.\n`);
console.log('| Check | Result | Time | Note |\n|---|---|---|---|');
console.log(rows.join('\n'));

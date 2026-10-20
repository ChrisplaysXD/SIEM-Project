import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadOffset, saveOffset, readNewLines } from '../src/tailer.js';

function tmpfile() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'tail-')), 'alerts.json');
}

test('offset persists and reloads', () => {
  const p = tmpfile();
  assert.equal(loadOffset(p), 0);
  saveOffset(p, 1234);
  assert.equal(loadOffset(p), 1234);
});

test('reads new json lines and advances position', async () => {
  const p = tmpfile();
  fs.writeFileSync(p, '{"a":1}\n{"a":2}\n');
  const seen = [];
  const s = await readNewLines(p, 0, (o) => seen.push(o));
  assert.equal(seen.length, 2);
  assert.equal(s.valid, 2);
  assert.equal(s.position, fs.statSync(p).size);
});

test('resumes from saved offset (backlog not lost)', async () => {
  const p = tmpfile();
  fs.writeFileSync(p, '{"a":1}\n');
  const first = await readNewLines(p, 0, () => {});
  fs.writeFileSync(p, '{"a":1}\n{"a":2}\n');
  const seen = [];
  await readNewLines(p, first.position, (o) => seen.push(o));
  assert.deepEqual(seen, [{ a: 2 }]);
});

test('counts invalid lines without throwing', async () => {
  const p = tmpfile();
  fs.writeFileSync(p, 'not json\n{"a":1}\n');
  const s = await readNewLines(p, 0, () => {});
  assert.equal(s.valid, 1);
  assert.equal(s.invalid, 1);
});

test('truncated last line is not consumed', async () => {
  const p = tmpfile();
  fs.writeFileSync(p, '{"a":1}\n{"a":2');
  const seen = [];
  const s = await readNewLines(p, 0, (o) => seen.push(o));
  assert.equal(seen.length, 1);
  fs.writeFileSync(p, '{"a":1}\n{"a":2}\n');
  const s2 = await readNewLines(p, s.position, (o) => seen.push(o));
  assert.equal(s2.valid, 1);
  assert.deepEqual(seen, [{ a: 1 }, { a: 2 }]);
});

test('handles file shrink (rotation) by resetting to 0', async () => {
  const p = tmpfile();
  fs.writeFileSync(p, 'x'.repeat(100));
  fs.writeFileSync(p, '{"a":1}\n');
  const seen = [];
  const s = await readNewLines(p, 500, (o) => seen.push(o));
  assert.equal(seen.length, 1);
  assert.equal(s.position, fs.statSync(p).size);
});

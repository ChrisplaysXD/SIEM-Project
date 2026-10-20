import fs from 'node:fs';
import path from 'node:path';

export function loadOffset(offsetPath) {
  try {
    return JSON.parse(fs.readFileSync(offsetPath, 'utf8')).position || 0;
  } catch {
    return 0;
  }
}

export function saveOffset(offsetPath, position) {
  fs.mkdirSync(path.dirname(offsetPath), { recursive: true });
  fs.writeFileSync(offsetPath, JSON.stringify({ position }));
}

export async function readNewLines(filePath, fromPosition, onLine) {
  const state = { position: fromPosition, valid: 0, invalid: 0 };
  let fd;
  try {
    fd = fs.openSync(filePath, 'r');
  } catch {
    return state;
  }
  try {
    const { size } = fs.fstatSync(fd);
    if (size < state.position) {
      state.position = 0;
    }
    if (size === state.position) {
      return state;
    }
    const len = size - state.position;
    const buf = Buffer.alloc(len);
    fs.readSync(fd, buf, 0, len, state.position);
    const lastNl = buf.lastIndexOf(0x0a);
    if (lastNl === -1) {
      return state;
    }
    const chunk = buf.subarray(0, lastNl + 1).toString('utf8');
    state.position += lastNl + 1;
    for (const line of chunk.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        onLine(JSON.parse(trimmed));
        state.valid += 1;
      } catch {
        state.invalid += 1;
      }
    }
  } finally {
    fs.closeSync(fd);
  }
  return state;
}

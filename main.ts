import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
// opcode -> [immediate bytes, pops, pushes]; binary ops 0x10-0x22 (except NEG 0x17, NOT 0x1b, unknown 0x1f) are [0,2,1]
const T: { [k: number]: [number, number, number] } = { 0: [0, 0, 0], 1: [1, 0, 1], 2: [4, 0, 1], 3: [0, 1, 0], 4: [0, 1, 2], 5: [0, 2, 2], 6: [0, 2, 3], 7: [0, 3, 3], 23: [0, 1, 1], 27: [0, 1, 1], 48: [2, 0, 0], 49: [2, 1, 0], 50: [2, 1, 0], 51: [2, 0, 0], 52: [0, 0, 0], 64: [0, 1, 1], 65: [0, 2, 0], 80: [0, 1, 0], 81: [0, 1, 0], 82: [0, 0, 1], 83: [0, 1, 0] };
function run(p: Uint8Array, q: Uint8Array): [Uint8Array, number] {
  const D = new Int32Array(256), C = new Int32Array(64), M = new Int32Array(256), o = new Uint8Array(65536);
  let sp = 0, cp = 0, ol = 0, ip = 0, pc = 0, st = 0;
  const n = p.length, fin = (c: number): [Uint8Array, number] => [o.slice(0, ol), c];
  for (;;) {
    if (st === 1e6) return fin(10);
    if (pc < 0 || pc >= n) return fin(9);
    const op = p[pc];
    let t = T[op];
    if (!t) {
      if (op >= 16 && op <= 34 && op !== 23 && op !== 27 && op !== 31) t = [0, 2, 1];
      else return fin(5);
    }
    if (pc + t[0] >= n) return fin(9);
    st++;
    if (sp < t[1]) return fin(2);
    if (sp - t[1] + t[2] > 256) return fin(3);
    const nx = pc + 1 + t[0]; pc = nx;
    if (op >= 16 && op <= 34 && op !== 23 && op !== 27) {
      const b = D[sp - 1], a = D[sp - 2]; let r = 0;
      if (op === 16) r = a + b | 0;
      else if (op === 17) r = a - b | 0;
      else if (op === 18) r = Math.imul(a, b);
      else if (op === 19) { if (b === 0) return fin(4); r = a === -2147483648 && b === -1 ? a : a / b | 0; }
      else if (op === 20) { if (b === 0) return fin(4); r = b === -1 ? 0 : a % b | 0; }
      else if (op === 21) { if (b === 0) return fin(4); r = Math.floor((a >>> 0) / (b >>> 0)) | 0; }
      else if (op === 22) { if (b === 0) return fin(4); r = (a >>> 0) % (b >>> 0) | 0; }
      else if (op === 24) r = a & b;
      else if (op === 25) r = a | b;
      else if (op === 26) r = a ^ b;
      else if (op === 28) r = a << (b & 31);
      else if (op === 29) r = a >> (b & 31);
      else if (op === 30) r = (a >>> (b & 31)) | 0;
      else if (op === 32) r = a === b ? 1 : 0;
      else if (op === 33) r = a < b ? 1 : 0;
      else r = (a >>> 0) < (b >>> 0) ? 1 : 0;
      sp -= 2; D[sp++] = r; continue;
    }
    switch (op) {
      case 0: return fin(0);
      case 1: D[sp++] = (p[nx - 1] << 24) >> 24; break;
      case 2: D[sp++] = p[nx - 4] | (p[nx - 3] << 8) | (p[nx - 2] << 16) | (p[nx - 1] << 24); break;
      case 3: sp--; break;
      case 4: D[sp] = D[sp - 1]; sp++; break;
      case 5: { const t = D[sp - 1]; D[sp - 1] = D[sp - 2]; D[sp - 2] = t; break; }
      case 6: D[sp] = D[sp - 2]; sp++; break;
      case 7: { const a = D[sp - 3]; D[sp - 3] = D[sp - 2]; D[sp - 2] = D[sp - 1]; D[sp - 1] = a; break; }
      case 23: D[sp - 1] = -D[sp - 1] | 0; break;
      case 27: D[sp - 1] = ~D[sp - 1]; break;
      case 48: case 49: case 50: {
        const rel = ((p[nx - 2] | (p[nx - 1] << 8)) << 16) >> 16;
        let take = true;
        if (op !== 48) { const v = D[--sp]; take = op === 49 ? v === 0 : v !== 0; }
        if (take) pc = nx + rel;
        break;
      }
      case 51: if (cp === 64) return fin(7); C[cp++] = nx; pc = p[nx - 2] | (p[nx - 1] << 8); break;
      case 52: if (cp === 0) return fin(8); pc = C[--cp]; break;
      case 64: { const a = D[sp - 1]; if (a < 0 || a >= 256) return fin(6); D[sp - 1] = M[a]; break; }
      case 65: { const a = D[sp - 1], v = D[sp - 2]; if (a < 0 || a >= 256) return fin(6); sp -= 2; M[a] = v; break; }
      case 80: { const s = String(D[sp - 1]); if (ol + s.length > 65536) return fin(11); sp--; for (let i = 0; i < s.length; i++) o[ol++] = s.charCodeAt(i); break; }
      case 81: if (ol + 1 > 65536) return fin(11); o[ol++] = D[--sp] & 255; break;
      case 82: D[sp++] = ip < q.length ? q[ip++] : -1; break;
      case 83: return fin(D[--sp] & 255);
    }
  }
}
const I = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const O = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
for (let k = 1; k <= 40; k++) {
  const id = 'i' + String(k).padStart(3, '0');
  let r: [Uint8Array, number];
  try { r = run(new Uint8Array(readFileSync(join(I, id, 'program.bin'))), new Uint8Array(readFileSync(join(I, id, 'input.bin')))); }
  catch { r = [new Uint8Array(0), 9]; }
  mkdirSync(join(O, id), { recursive: true });
  writeFileSync(join(O, id, 'stdout.bin'), r[0]);
  writeFileSync(join(O, id, 'exit.txt'), r[1] + '\n');
}

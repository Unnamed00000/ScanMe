import { copyFile, cp, mkdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');
const sourceHtml = resolve(dist, 'index.source.html');
const builtHtml = resolve(dist, 'index.html');

await copyFile(sourceHtml, builtHtml);
await rm(sourceHtml);

await copyFile(builtHtml, resolve(root, 'index.html'));
await copyFile(resolve(dist, 'favicon.svg'), resolve(root, 'favicon.svg'));

await rm(resolve(root, 'assets'), { recursive: true, force: true });
await mkdir(resolve(root, 'assets'), { recursive: true });
await cp(resolve(dist, 'assets'), resolve(root, 'assets'), { recursive: true, force: true });

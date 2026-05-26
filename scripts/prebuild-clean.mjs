#!/usr/bin/env node
import { rmSync, existsSync } from 'node:fs';
import { resolve, relative } from 'node:path';

const projectRoot = resolve(new URL('..', import.meta.url).pathname);
const targets = ['dist'];

for (const target of targets) {
  const absolute = resolve(projectRoot, target);
  const rel = relative(projectRoot, absolute);
  if (!rel || rel.startsWith('..')) {
    throw new Error(`Refusing to remove path outside project: ${absolute}`);
  }
  if (existsSync(absolute)) {
    rmSync(absolute, { recursive: true, force: true });
    console.log(`[prebuild-clean] removed ${rel}`);
  } else {
    console.log(`[prebuild-clean] skip ${rel}, not found`);
  }
}

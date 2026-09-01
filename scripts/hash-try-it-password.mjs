#!/usr/bin/env node
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { hashPassword } from './auth-crypto.mjs';

const rl = createInterface({ input, output });

const password = process.argv[2] || (await rl.question('Demo password: '));
rl.close();

if (!password || password.length < 12) {
  console.error('Use at least 12 characters.');
  process.exit(1);
}

const encoded = await hashPassword(password);
console.log('\nStore this as the Worker secret TRY_IT_PASSWORD_HASH:\n');
console.log(encoded);
console.log('\nSet it with: wrangler secret put TRY_IT_PASSWORD_HASH');

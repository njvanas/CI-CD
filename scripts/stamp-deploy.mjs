#!/usr/bin/env node
import { writeFileSync } from 'node:fs';

const deployedAt = new Date().toISOString();
const source = process.env.DEPLOY_SOURCE || 'push';
const runId = process.env.GITHUB_RUN_ID || '';
const server = process.env.GITHUB_SERVER_URL || 'https://github.com';
const repository = process.env.GITHUB_REPOSITORY || '';
const proxyUrl = String(process.env.TRY_IT_PROXY_URL || '').trim().replace(/\/$/, '');

const deployInfo = {
  deployedAt,
  source,
  runId,
  runUrl: repository && runId ? `${server}/${repository}/actions/runs/${runId}` : ''
};

writeFileSync('deploy-info.json', `${JSON.stringify(deployInfo, null, 2)}\n`);

/** Public-only config — no secrets, tokens, or passwords. */
const config = {
  enabled: Boolean(proxyUrl),
  proxyUrl
};

writeFileSync('try-it-config.js', `window.__TRY_IT_CONFIG__=${JSON.stringify(config)};\n`);
console.log(`Wrote deploy-info.json source=${source} deployedAt=${deployedAt} tryItProxy=${proxyUrl || '(not set)'}`);

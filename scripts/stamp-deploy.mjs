#!/usr/bin/env node
import { writeFileSync } from 'node:fs';

const deployedAt = new Date().toISOString();
const source = process.env.DEPLOY_SOURCE || 'push';
const runId = process.env.GITHUB_RUN_ID || '';
const server = process.env.GITHUB_SERVER_URL || 'https://github.com';
const repository = process.env.GITHUB_REPOSITORY || '';
const token = process.env.TRY_IT_TOKEN || '';
const [owner, name] = repository.split('/');
const ref = process.env.GITHUB_REF_NAME || 'master';

const deployInfo = {
  deployedAt,
  source,
  runId,
  runUrl: repository && runId ? `${server}/${repository}/actions/runs/${runId}` : ''
};

writeFileSync('deploy-info.json', `${JSON.stringify(deployInfo, null, 2)}\n`);

const config = {
  enabled: Boolean(token),
  owner: owner || 'njvanas',
  repo: name || 'CI-CD',
  workflow: 'try-it.yml',
  ref,
  token
};

writeFileSync('try-it-config.js', `window.__TRY_IT_CONFIG__=${JSON.stringify(config)};\n`);
console.log(`Wrote deploy-info.json source=${source} deployedAt=${deployedAt} tryItEnabled=${config.enabled}`);

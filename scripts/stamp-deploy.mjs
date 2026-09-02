#!/usr/bin/env node
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';

const deployedAt = new Date().toISOString();
const source = process.env.DEPLOY_SOURCE || 'push';
const runId = process.env.GITHUB_RUN_ID || '';
const server = process.env.GITHUB_SERVER_URL || 'https://github.com';
const repository = process.env.GITHUB_REPOSITORY || '';
const trigger = String(process.env.SITE_TRIGGER || '').trim().replace(/\/$/, '');

const deployInfo = {
  deployedAt,
  source,
  runId,
  runUrl: repository && runId ? `${server}/${repository}/actions/runs/${runId}` : ''
};

const config = {
  enabled: Boolean(trigger),
  proxyUrl: trigger
};

const distDir = 'dist';
rmSync(distDir, { recursive: true, force: true });
mkdirSync(distDir, { recursive: true });

for (const file of ['index.html', 'script.js', 'styles.css']) {
  cpSync(file, `${distDir}/${file}`);
}
cpSync('icons', `${distDir}/icons`, { recursive: true });

writeFileSync(`${distDir}/pages-deploy.json`, `${JSON.stringify(deployInfo, null, 2)}\n`);
writeFileSync(
  `${distDir}/pages-config.js`,
  `window.__TRY_IT_CONFIG__=${JSON.stringify(config)};\n`
);
writeFileSync(`${distDir}/.nojekyll`, '');

console.log(`Built ${distDir}/ source=${source} deployedAt=${deployedAt}`);

#!/usr/bin/env node
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';

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

/** Public-only config — no secrets, tokens, or passwords. */
const config = {
  enabled: Boolean(proxyUrl),
  proxyUrl
};

const distDir = 'dist';
rmSync(distDir, { recursive: true, force: true });
mkdirSync(distDir, { recursive: true });

for (const file of ['index.html', 'script.js', 'styles.css']) {
  cpSync(file, `${distDir}/${file}`);
}
cpSync('icons', `${distDir}/icons`, { recursive: true });

const deployJson = `${JSON.stringify(deployInfo, null, 2)}\n`;
const configJs = `window.__TRY_IT_CONFIG__=${JSON.stringify(config)};\n`;

writeFileSync(`${distDir}/pages-deploy.json`, deployJson);
writeFileSync(`${distDir}/pages-config.js`, configJs);
writeFileSync(`${distDir}/.nojekyll`, '');

/** Also write at repo root so legacy branch-based Pages serves them. */
writeFileSync('pages-deploy.json', deployJson);
writeFileSync('pages-config.js', configJs);

console.log(
  `Built ${distDir}/ source=${source} deployedAt=${deployedAt} tryItProxy=${proxyUrl || '(not set)'}`
);

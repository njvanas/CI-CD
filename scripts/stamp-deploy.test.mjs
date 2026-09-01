import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, it } from 'node:test';

describe('stamp-deploy', () => {
  it('writes deploy-info.json and a public proxy config without secrets', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'stamp-deploy-'));
    const result = spawnSync(process.execPath, [join(process.cwd(), 'scripts/stamp-deploy.mjs')], {
      cwd,
      env: {
        ...process.env,
        DEPLOY_SOURCE: 'try-it',
        GITHUB_RUN_ID: '99',
        GITHUB_REPOSITORY: 'njvanas/CI-CD',
        TRY_IT_PROXY_URL: 'https://try-it.example.workers.dev'
      },
      encoding: 'utf8'
    });
    assert.equal(result.status, 0, result.stderr);
    const info = JSON.parse(readFileSync(join(cwd, 'deploy-info.json'), 'utf8'));
    assert.equal(info.source, 'try-it');
    assert.equal(info.runId, '99');
    assert.ok(info.deployedAt);
    const configJs = readFileSync(join(cwd, 'try-it-config.js'), 'utf8');
    const config = JSON.parse(configJs.replace(/^window\.__TRY_IT_CONFIG__=/, '').replace(/;\s*$/, ''));
    assert.equal(config.enabled, true);
    assert.equal(config.proxyUrl, 'https://try-it.example.workers.dev');
    assert.equal('token' in config, false);
    assert.equal('password' in config, false);
  });
});

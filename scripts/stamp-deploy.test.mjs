import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, it } from 'node:test';

describe('stamp-deploy', () => {
  it('builds dist/ with public assets and no secrets', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'stamp-deploy-'));
    for (const file of ['index.html', 'script.js', 'styles.css']) {
      writeFileSync(join(cwd, file), `${file}\n`);
    }
    mkdirSync(join(cwd, 'icons'));
    writeFileSync(join(cwd, 'icons', 'github.svg'), '<svg></svg>');

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

    const dist = join(cwd, 'dist');
    assert.ok(existsSync(join(dist, 'index.html')));
    assert.ok(existsSync(join(dist, 'try-it-config.js')));
    assert.ok(existsSync(join(dist, 'deploy-info.json')));
    assert.ok(existsSync(join(dist, '.nojekyll')));
    assert.equal(existsSync(join(dist, 'scripts')), false);

    const config = JSON.parse(
      readFileSync(join(dist, 'try-it-config.js'), 'utf8')
        .replace(/^window\.__TRY_IT_CONFIG__=/, '')
        .replace(/;\s*$/, '')
    );
    assert.equal(config.enabled, true);
    assert.equal(config.proxyUrl, 'https://try-it.example.workers.dev');
    assert.equal('token' in config, false);
  });
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { translate } from '../apps/web/app/lib/translations.mjs';

test('application branding and icon use celimanapp consistently', async () => {
  for (const path of ['apps/web/app/layout.tsx', 'apps/web/app/components/public-shell.tsx', 'apps/web/app/components/navbar.tsx', 'apps/web/app/components/auth-form.tsx']) {
    const source = await readFile(path, 'utf8');
    assert.match(source, /celimanapp/i, path);
    assert.doesNotMatch(source, /celi tools/i, path);
  }
  const brand = await readFile('apps/web/public/brand.svg', 'utf8');
  assert.equal(await readFile('apps/web/app/icon.svg', 'utf8'), brand);
  assert.match(brand, /viewBox=/);
});

test('rebranded reminder and login messages translate to English', () => {
  assert.equal(translate('Pengingat celimanapp', 'en'), 'celimanapp reminder');
  assert.equal(translate('Masuk ke celimanapp', 'en'), 'Sign in to celimanapp');
});

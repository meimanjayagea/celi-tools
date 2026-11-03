import test from 'node:test';
import assert from 'node:assert/strict';
import { translate } from '../apps/web/app/lib/translations.mjs';

test('interface messages switch between Indonesian and English', () => {
  assert.equal(translate('Preferensi', 'en'), 'Preferences');
  assert.equal(translate('Preferensi', 'id'), 'Preferensi');
  assert.equal(translate('Light', 'id'), 'Terang');
  assert.equal(translate('  Tersedia ', 'en'), '  Available ');
});

test('unknown content stays unchanged in either language', () => {
  for (const language of ['id', 'en']) {
    assert.equal(translate('My private note 123', language), 'My private note 123');
    assert.equal(translate('{"hello": true}', language), '{"hello": true}');
  }
});

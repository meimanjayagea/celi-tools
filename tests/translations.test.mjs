import test from 'node:test';
import assert from 'node:assert/strict';
import { translate } from '../apps/web/app/lib/translations.mjs';

test('interface messages switch between Indonesian and English', () => {
  assert.equal(translate('Preferensi', 'en'), 'Preferences');
  assert.equal(translate('Preferensi', 'id'), 'Preferensi');
  assert.equal(translate('Light', 'id'), 'Terang');
  assert.equal(translate('  Tersedia ', 'en'), '  Available ');
  assert.equal(translate('Gratis', 'en'), 'Free');
  assert.equal(translate('Berbayar', 'en'), 'Paid');
  assert.equal(translate('Tarif tidak diketahui', 'en'), 'Price unknown');
  assert.equal(translate('Model tanpa data harga hanya tampil di filter Semua.', 'en'), 'Models without pricing data only appear under All.');
});

test('unknown content stays unchanged in either language', () => {
  for (const language of ['id', 'en']) {
    assert.equal(translate('My private note 123', language), 'My private note 123');
    assert.equal(translate('{"hello": true}', language), '{"hello": true}');
  }
});

// -----------------------------------------------------------------------------
// Consistency checks between `gladys-assistant-integration.json` and the code.
// The manifest is validated by the store indexer, but nothing there can know
// which handlers the code actually registers — these tests keep both in sync.
//
// index.js is never imported here: it calls `gladys.connect()` as a
// top-level side effect, which a unit test must not trigger.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DEFAULT_CONFIG } from '../src/config.js';
import { WOL_PORT } from '../src/wol.js';

const manifest = JSON.parse(
  await readFile(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);

// Kept in sync by hand with the `gladys.onAction(...)` calls in index.js.
const EXPECTED_ACTIONS = ['add_device', 'remove_device', 'wake_device'];

test('manifest declares exactly the actions handled in index.js', () => {
  const keys = (manifest.actions ?? []).map((action) => action.key);
  assert.deepEqual(new Set(keys), new Set(EXPECTED_ACTIONS));
  assert.equal(keys.length, new Set(keys).size, 'no two actions may share a key');
});

test('config_schema defaults stay consistent with DEFAULT_CONFIG', () => {
  for (const field of manifest.config_schema) {
    if (field.default === undefined) {
      continue;
    }
    // `select` option values (and so their default) are always strings
    // (manifest.schema.json), even when DEFAULT_CONFIG stores the typed
    // (e.g. numeric) value the code actually works with.
    const expected = field.type === 'select' ? String(DEFAULT_CONFIG[field.key]) : DEFAULT_CONFIG[field.key];
    assert.equal(expected, field.default, `DEFAULT_CONFIG.${field.key} must match the manifest default`);
  }
});

test('section fields are purely presentational', () => {
  const sections = manifest.config_schema.filter((f) => f.type === 'section');
  assert.ok(
    sections.length > 0,
    'the manifest documents the LAN-broadcast limitation in a section',
  );
  for (const section of sections) {
    assert.equal(section.required, undefined, `section "${section.key}" must not be required`);
    assert.equal(section.default, undefined, `section "${section.key}" must not have a default`);
    assert.ok(section.label?.en, `section "${section.key}" needs an English label`);
    assert.ok(
      !(section.key in DEFAULT_CONFIG),
      `section "${section.key}" stores no value and must not appear in DEFAULT_CONFIG`,
    );
  }
});

test('remove_device and wake_device target a device by a plain string field, not a dynamic select', () => {
  // Gladys core's externalIntegration.validateConfigValue.js validates a
  // `select` field against `field.options` only: it never resolves a dynamic
  // `field.source` (e.g. "devices") into the actual created-devices list, so
  // a `select` + `source: "devices"` action field is unconditionally rejected
  // ("must be one of" with zero valid values). Until that's fixed upstream,
  // these two actions take a plain string (name or MAC) matched in index.js
  // via findEntryByQuery instead.
  for (const key of ['remove_device', 'wake_device']) {
    const action = manifest.actions.find((a) => a.key === key);
    const field = action.fields.find((f) => f.key === 'device');
    assert.equal(field.type, 'string', `${key}.device must be a plain string field`);
    assert.equal(field.source, undefined, `${key}.device must not use a dynamic source`);
  }
});

test('network_discovery declares the Wake-on-LAN broadcast port used by src/wol.js', () => {
  const entry = (manifest.network_discovery ?? []).find((e) => e.type === 'udp-active-broadcast');
  assert.ok(entry, 'a udp-active-broadcast capture must be declared for Wake-on-LAN');
  assert.ok(entry.ports.includes(WOL_PORT), `manifest port list must include ${WOL_PORT}`);
});

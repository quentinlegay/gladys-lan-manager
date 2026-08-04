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
    if (field.default !== undefined) {
      assert.equal(
        DEFAULT_CONFIG[field.key],
        field.default,
        `DEFAULT_CONFIG.${field.key} must match the manifest default`,
      );
    }
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

test('dynamic selects declare a source and no static options', () => {
  const allFields = (manifest.actions ?? []).flatMap((action) => action.fields ?? []);
  const dynamicSelects = allFields.filter((field) => field.source !== undefined);
  assert.ok(
    dynamicSelects.length > 0,
    'remove_device and wake_device both target an existing device',
  );
  for (const field of dynamicSelects) {
    assert.equal(field.source, 'devices', 'the only core-defined source in V1 is "devices"');
    assert.equal(
      field.options,
      undefined,
      `field "${field.key}": source and options are mutually exclusive`,
    );
  }
});

test('network_discovery declares the Wake-on-LAN broadcast port used by src/wol.js', () => {
  const entry = (manifest.network_discovery ?? []).find((e) => e.type === 'udp-active-broadcast');
  assert.ok(entry, 'a udp-active-broadcast capture must be declared for Wake-on-LAN');
  assert.ok(entry.ports.includes(WOL_PORT), `manifest port list must include ${WOL_PORT}`);
});

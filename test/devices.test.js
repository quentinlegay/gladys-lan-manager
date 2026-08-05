import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEVICE_FEATURE_CATEGORIES, DEVICE_FEATURE_TYPES } from '@gladysassistant/integration-sdk';
import {
  buildDevice,
  deviceIds,
  FEATURE,
  onSetValue,
} from '../src/devices/networkDevice.js';
import {
  buildDiscoveredDevices,
  dispatchSetValue,
  findEntryByExternalId,
  findEntryByQuery,
} from '../src/devices/index.js';
import { normalizeConfig } from '../src/config.js';
import { createFakeGladys } from './helpers/fakeGladys.js';

const entry = { name: 'NAS', mac: 'aa:bb:cc:dd:ee:ff' };

test('buildDevice exposes a single writable Wake feature (SWITCH/BINARY)', () => {
  const gladys = createFakeGladys();
  const device = buildDevice(gladys, normalizeConfig(), entry);

  assert.equal(device.features.length, 1);
  const wake = device.features[0];
  assert.equal(wake.category, DEVICE_FEATURE_CATEGORIES.SWITCH);
  assert.equal(wake.type, DEVICE_FEATURE_TYPES.SWITCH.BINARY);
  assert.equal(wake.read_only, false);
  // Gladys core rejects features with a null min/max (t_device_feature columns are NOT NULL).
  assert.equal(wake.min, 0);
  assert.equal(wake.max, 1);
  // No presence polling: poll_frequency must be absent.
  assert.equal(device.poll_frequency, undefined);
});

test('buildDevice includes the IP param only when provided', () => {
  const gladys = createFakeGladys();
  const withIp = buildDevice(gladys, normalizeConfig(), { ...entry, ip: '192.168.1.10' });
  const withoutIp = buildDevice(gladys, normalizeConfig(), entry);

  assert.ok(withIp.params.find((p) => p.name === 'IP_ADDRESS'));
  assert.equal(withoutIp.params.find((p) => p.name === 'IP_ADDRESS'), undefined);
});

test('buildDiscoveredDevices maps one payload per stored entry', () => {
  const gladys = createFakeGladys();
  const devices = buildDiscoveredDevices(gladys, normalizeConfig(), [
    entry,
    { ...entry, mac: 'aa:bb:cc:dd:ee:00', name: 'Other' },
  ]);
  assert.equal(devices.length, 2);
  assert.equal(new Set(devices.map((d) => d.external_id)).size, 2, 'external_ids must be unique');
});

test('findEntryByExternalId routes a device external_id back to its stored entry', () => {
  const gladys = createFakeGladys();
  const ids = deviceIds(gladys, entry);
  assert.equal(findEntryByExternalId(gladys, [entry], ids.device), entry);
  assert.equal(findEntryByExternalId(gladys, [entry], 'does-not-exist'), undefined);
});

test('findEntryByQuery matches by MAC (any case/separator) or by name, case-insensitive', () => {
  const entries = [entry, { ...entry, mac: 'aa:bb:cc:dd:ee:00', name: 'Other' }];

  assert.equal(findEntryByQuery(entries, entry.mac), entry);
  assert.equal(findEntryByQuery(entries, 'AA-BB-CC-DD-EE-FF'), entry, 'MAC match must be case/separator-insensitive');
  assert.equal(findEntryByQuery(entries, 'nas'), entry, 'name match must be case-insensitive');
  assert.equal(findEntryByQuery(entries, 'does-not-exist'), undefined);
  assert.equal(findEntryByQuery(entries, ''), undefined);
});

test('onSetValue on the Wake feature sends a Wake-on-LAN packet', async () => {
  const gladys = createFakeGladys();
  const ids = deviceIds(gladys, entry);
  await onSetValue(gladys, normalizeConfig(), entry, { external_id: ids.feature(FEATURE.WAKE) }, 1);
  assert.equal(gladys.scans.length, 1);
  assert.equal(gladys.scans[0].type, 'udp-active-broadcast');
});

test('onSetValue rejects a command on an unknown feature', async () => {
  const gladys = createFakeGladys();
  await assert.rejects(
    onSetValue(gladys, normalizeConfig(), entry, { external_id: 'unknown-feature' }, 1),
  );
  assert.equal(gladys.scans.length, 0, 'no Wake-on-LAN packet must be sent');
});

test('dispatchSetValue throws for an unknown device', async () => {
  const gladys = createFakeGladys();
  await assert.rejects(
    dispatchSetValue(gladys, normalizeConfig(), [], { external_id: 'unknown' }, {}, 1),
  );
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { DEVICE_FEATURE_CATEGORIES, DEVICE_FEATURE_TYPES } from '@gladysassistant/integration-sdk';
import {
  buildDevice,
  deviceIds,
  FEATURE,
  onPoll,
  onSetValue,
} from '../src/devices/networkDevice.js';
import {
  buildDiscoveredDevices,
  dispatchPoll,
  dispatchSetValue,
  findEntryByExternalId,
} from '../src/devices/index.js';
import { normalizeConfig } from '../src/config.js';
import { createFakeGladys } from './helpers/fakeGladys.js';

const entry = { name: 'NAS', mac: 'aa:bb:cc:dd:ee:ff', ip: '127.0.0.1' };

test('buildDevice always exposes a Wake button feature', () => {
  const gladys = createFakeGladys();
  const device = buildDevice(gladys, normalizeConfig({ presence_check: false }), entry);

  assert.equal(device.features.length, 1);
  const wake = device.features[0];
  assert.equal(wake.category, DEVICE_FEATURE_CATEGORIES.BUTTON);
  assert.equal(wake.type, DEVICE_FEATURE_TYPES.BUTTON.CLICK);
  assert.equal(wake.read_only, false);
  assert.equal(device.poll_frequency, undefined);
});

test('buildDevice adds a read-only Presence feature when presence_check is enabled', () => {
  const gladys = createFakeGladys();
  const config = normalizeConfig({ presence_check: true });
  const device = buildDevice(gladys, config, entry);

  const presence = device.features.find(
    (f) => f.category === DEVICE_FEATURE_CATEGORIES.PRESENCE_SENSOR,
  );
  assert.ok(presence, 'the presence feature must be present');
  assert.equal(presence.type, DEVICE_FEATURE_TYPES.SENSOR.BINARY);
  assert.equal(presence.read_only, true);
  assert.equal(device.poll_frequency, config.poll_frequency);
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

test('onSetValue rejects a command on the read-only Presence feature', async () => {
  const gladys = createFakeGladys();
  const ids = deviceIds(gladys, entry);
  await assert.rejects(
    onSetValue(gladys, normalizeConfig(), entry, { external_id: ids.feature(FEATURE.PRESENCE) }, 1),
  );
  assert.equal(gladys.scans.length, 0, 'no Wake-on-LAN packet must be sent');
});

test('onSetValue on the Wake feature sends a Wake-on-LAN packet', async () => {
  const gladys = createFakeGladys();
  const ids = deviceIds(gladys, entry);
  await onSetValue(gladys, normalizeConfig(), entry, { external_id: ids.feature(FEATURE.WAKE) }, 1);
  assert.equal(gladys.scans.length, 1);
  assert.equal(gladys.scans[0].type, 'udp-active-broadcast');
});

test('dispatchSetValue throws for an unknown device', async () => {
  const gladys = createFakeGladys();
  await assert.rejects(
    dispatchSetValue(gladys, normalizeConfig(), [], { external_id: 'unknown' }, {}, 1),
  );
});

test('onPoll publishes the presence state read from the device IP', async () => {
  const server = net.createServer((socket) => socket.end());
  const port = await new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () => resolve(server.address().port)),
  );
  try {
    const gladys = createFakeGladys();
    const localEntry = { ...entry, ip: '127.0.0.1', port };
    await onPoll(gladys, normalizeConfig({ presence_check: true }), localEntry);

    const ids = deviceIds(gladys, localEntry);
    assert.deepEqual(gladys.published, [
      { featureExternalId: ids.feature(FEATURE.PRESENCE), state: 1 },
    ]);
  } finally {
    server.close();
  }
});

test('onPoll does nothing when presence_check is disabled', async () => {
  const gladys = createFakeGladys();
  await onPoll(gladys, normalizeConfig({ presence_check: false }), entry);
  assert.deepEqual(gladys.published, []);
});

test('dispatchPoll ignores an unknown device instead of throwing', async () => {
  const gladys = createFakeGladys();
  await dispatchPoll(gladys, normalizeConfig(), [], { external_id: 'unknown' });
  assert.deepEqual(gladys.published, []);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addManagedDevice,
  getManagedDevices,
  isValidIp,
  isValidMac,
  normalizeMac,
  parseManagedDevices,
  removeManagedDevice,
} from '../src/store.js';
import { createFakeGladys } from './helpers/fakeGladys.js';

test('isValidMac accepts colon- and dash-separated addresses, rejects garbage', () => {
  assert.ok(isValidMac('AA:BB:CC:DD:EE:FF'));
  assert.ok(isValidMac('aa-bb-cc-dd-ee-ff'));
  assert.equal(isValidMac('not-a-mac'), false);
  assert.equal(isValidMac(''), false);
});

test('isValidIp accepts a plain IPv4 address only', () => {
  assert.ok(isValidIp('192.168.1.42'));
  assert.equal(isValidIp('256.0.0.1'), false);
  assert.equal(isValidIp('not-an-ip'), false);
});

test('normalizeMac lowercases and uses colons', () => {
  assert.equal(normalizeMac('AA-BB-CC-DD-EE-FF'), 'aa:bb:cc:dd:ee:ff');
});

test('parseManagedDevices tolerates missing or corrupted storage', () => {
  assert.deepEqual(parseManagedDevices(undefined), []);
  assert.deepEqual(parseManagedDevices('not json'), []);
  assert.deepEqual(parseManagedDevices('{"not":"an array"}'), []);
});

test('addManagedDevice validates the MAC before storing anything', async () => {
  const gladys = createFakeGladys();
  await assert.rejects(addManagedDevice(gladys, { name: 'x', mac: 'nope' }));
  assert.deepEqual(getManagedDevices(gladys), []);
});

test('addManagedDevice validates the IP when provided', async () => {
  const gladys = createFakeGladys();
  await assert.rejects(
    addManagedDevice(gladys, { name: 'x', mac: 'aa:bb:cc:dd:ee:ff', ip: 'nope' }),
  );
  assert.deepEqual(getManagedDevices(gladys), []);
});

test('addManagedDevice stores a normalized entry and replaces an existing one with the same MAC', async () => {
  const gladys = createFakeGladys();
  await addManagedDevice(gladys, { name: 'NAS', mac: 'AA-BB-CC-DD-EE-FF' });
  await addManagedDevice(gladys, { name: 'NAS (renamed)', mac: 'aa:bb:cc:dd:ee:ff', ip: '192.168.1.11' });

  const devices = getManagedDevices(gladys);
  assert.equal(devices.length, 1);
  assert.equal(devices[0].name, 'NAS (renamed)');
  assert.equal(devices[0].ip, '192.168.1.11');
  assert.equal(devices[0].mac, 'aa:bb:cc:dd:ee:ff');
});

test('removeManagedDevice removes the matching device and reports whether it existed', async () => {
  const gladys = createFakeGladys();
  const device = await addManagedDevice(gladys, { name: 'PC', mac: 'aa:bb:cc:dd:ee:ff' });
  const ids = gladys.externalIds('network-device', device.mac);

  assert.equal(await removeManagedDevice(gladys, ids.device), true);
  assert.deepEqual(getManagedDevices(gladys), []);
  assert.equal(await removeManagedDevice(gladys, ids.device), false);
});

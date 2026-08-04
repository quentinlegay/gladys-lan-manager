// -----------------------------------------------------------------------------
// Managed device storage.
//
// The manifest `config_schema` only has flat, scalar fields — no repeatable
// "list of devices" widget. So the device list is instead free internal
// storage: a JSON array kept under a config key OUTSIDE `config_schema`
// (`gladys.setConfig({ managed_devices: '...' })`), the same trick the SDK
// uses for OAuth2 tokens. It never renders as a form field; it is grown and
// shrunk exclusively through the `add_device` / `remove_device` manifest
// actions (see index.js).
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { deviceIds } from './devices/networkDevice.js';

const logger = createLogger({ name: 'store' });

export const CONFIG_KEY = 'managed_devices';

const MAC_RE = /^([0-9a-f]{2}:){5}[0-9a-f]{2}$/;
const IPV4_RE = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

/**
 * @description Normalize a MAC address to lowercase, colon-separated form.
 * @param {string} mac - MAC address, colon or dash separated.
 * @returns {string} Normalized MAC address.
 * @example
 * normalizeMac('AA-BB-CC-DD-EE-FF'); // 'aa:bb:cc:dd:ee:ff'
 */
export function normalizeMac(mac) {
  return String(mac).trim().replace(/-/g, ':').toLowerCase();
}

/**
 * @description Check that a string is a well-formed MAC address.
 * @param {string} mac - Value to check.
 * @returns {boolean} True when valid.
 * @example
 * isValidMac('aa:bb:cc:dd:ee:ff'); // true
 */
export function isValidMac(mac) {
  return typeof mac === 'string' && mac.trim().length > 0 && MAC_RE.test(normalizeMac(mac));
}

/**
 * @description Check that a string is a well-formed IPv4 address.
 * @param {string} ip - Value to check.
 * @returns {boolean} True when valid.
 * @example
 * isValidIp('192.168.1.42'); // true
 */
export function isValidIp(ip) {
  return typeof ip === 'string' && IPV4_RE.test(ip.trim());
}

/**
 * @description Parse the stored device list, tolerating missing or
 * corrupted storage instead of crashing the integration.
 * @param {string|undefined} raw - Raw `managed_devices` config value.
 * @returns {object[]} The stored devices, or an empty list.
 * @example
 * const devices = parseManagedDevices(gladys.config.managed_devices);
 */
export function parseManagedDevices(raw) {
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    logger.error('Failed to parse the stored device list, ignoring it', err);
    return [];
  }
}

/**
 * @description Get the current list of managed devices.
 * @param {object} gladys - The connected GladysIntegration instance.
 * @returns {object[]} The stored devices.
 * @example
 * const devices = getManagedDevices(gladys);
 */
export function getManagedDevices(gladys) {
  return parseManagedDevices(gladys.config?.[CONFIG_KEY]);
}

/**
 * @description Persist the device list, and reflect it in `gladys.config`
 * right away (`setConfig` only PATCHes the host; it does not refresh the
 * local cache by itself).
 * @param {object} gladys - The connected GladysIntegration instance.
 * @param {object[]} devices - The full device list to store.
 * @returns {Promise<object[]>} The stored devices.
 * @example
 * await saveManagedDevices(gladys, devices);
 */
export async function saveManagedDevices(gladys, devices) {
  const raw = JSON.stringify(devices);
  await gladys.setConfig({ [CONFIG_KEY]: raw });
  gladys.config = { ...gladys.config, [CONFIG_KEY]: raw };
  return devices;
}

/**
 * @description Add (or replace, if the MAC already exists) a managed device.
 * @param {object} gladys - The connected GladysIntegration instance.
 * @param {{ name: string, mac: string, ip: string, port?: number|string }} fields - Values from the `add_device` action form.
 * @returns {Promise<object>} The stored device.
 * @example
 * await addManagedDevice(gladys, { name: 'NAS', mac: 'aa:bb:cc:dd:ee:ff', ip: '192.168.1.10' });
 */
export async function addManagedDevice(gladys, { name, mac, ip, port } = {}) {
  if (!isValidMac(mac)) {
    throw new Error(`Invalid MAC address: "${mac}"`);
  }
  if (!isValidIp(ip)) {
    throw new Error(`Invalid IPv4 address: "${ip}"`);
  }

  const normalizedMac = normalizeMac(mac);
  const device = {
    name: String(name ?? '').trim() || normalizedMac,
    mac: normalizedMac,
    ip: String(ip).trim(),
  };

  if (port !== undefined && port !== null && `${port}`.trim().length > 0) {
    const portNumber = Number(port);
    if (!Number.isInteger(portNumber) || portNumber < 1 || portNumber > 65535) {
      throw new Error(`Invalid presence-check port: "${port}"`);
    }
    device.port = portNumber;
  }

  // Adding an already-known MAC replaces the previous entry (e.g. the user
  // fixes a typo in the IP) instead of duplicating the device.
  const devices = getManagedDevices(gladys).filter((existing) => existing.mac !== normalizedMac);
  devices.push(device);
  await saveManagedDevices(gladys, devices);
  return device;
}

/**
 * @description Remove a managed device.
 * @param {object} gladys - The connected GladysIntegration instance.
 * @param {string} externalId - external_id of the device to remove (the
 * value of the `device` field of the `remove_device` action).
 * @returns {Promise<boolean>} True when a device was actually removed.
 * @example
 * const removed = await removeManagedDevice(gladys, fields.device);
 */
export async function removeManagedDevice(gladys, externalId) {
  const devices = getManagedDevices(gladys);
  const remaining = devices.filter((entry) => deviceIds(gladys, entry).device !== externalId);
  const removed = remaining.length !== devices.length;
  if (removed) {
    await saveManagedDevices(gladys, remaining);
  }
  return removed;
}

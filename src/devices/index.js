// -----------------------------------------------------------------------------
// Registry adapter.
//
// Maps the dynamic list of managed LAN devices (src/store.js) onto the
// networkDevice blueprint (./networkDevice.js) — "one blueprint, many
// instances", instead of the template's one-blueprint-per-file catalog.
// index.js only calls into these functions; it never touches networkDevice.js
// directly (except for `triggerWake`, reused as-is by the `wake_device`
// action).
// -----------------------------------------------------------------------------

import {
  buildDevice,
  deviceIds,
  onPoll as networkDeviceOnPoll,
  onSetValue as networkDeviceOnSetValue,
} from './networkDevice.js';

/**
 * @description Build the discovery payload for every stored device.
 * @param {object} gladys - The connected GladysIntegration instance.
 * @param {object} config - Normalized integration config.
 * @param {object[]} entries - Stored devices, from `getManagedDevices`.
 * @returns {object[]} One discovery payload per entry.
 * @example
 * await gladys.publishDiscoveredDevices(buildDiscoveredDevices(gladys, config, entries));
 */
export function buildDiscoveredDevices(gladys, config, entries) {
  return entries.map((entry) => buildDevice(gladys, config, entry));
}

/**
 * @description Find the stored entry that owns a given device external_id.
 * @param {object} gladys - The connected GladysIntegration instance.
 * @param {object[]} entries - Stored devices, from `getManagedDevices`.
 * @param {string} externalId - The device external_id to look up.
 * @returns {object|undefined} The matching entry, if any.
 * @example
 * const entry = findEntryByExternalId(gladys, entries, device.external_id);
 */
export function findEntryByExternalId(gladys, entries, externalId) {
  return entries.find((entry) => deviceIds(gladys, entry).device === externalId);
}

/**
 * @description Route a `gladys.onSetValue` command to its owning entry.
 * @param {object} gladys - The connected GladysIntegration instance.
 * @param {object} config - Normalized integration config.
 * @param {object[]} entries - Stored devices, from `getManagedDevices`.
 * @param {object} device - The device targeted by the command.
 * @param {object} feature - The feature targeted by the command.
 * @param {number} value - The requested value.
 * @returns {Promise<void>} Resolves once the command was handled.
 * @example
 * await dispatchSetValue(gladys, config, entries, device, feature, value);
 */
export async function dispatchSetValue(gladys, config, entries, device, feature, value) {
  const entry = findEntryByExternalId(gladys, entries, device.external_id);
  if (!entry) {
    throw new Error(`Unknown device: ${device.external_id}`);
  }
  await networkDeviceOnSetValue(gladys, config, entry, feature, value);
}

/**
 * @description Route a `gladys.onPoll` refresh to its owning entry. Unlike
 * `dispatchSetValue`, an unknown device is not an error: it can legitimately
 * happen right after a `remove_device` action, while Gladys still schedules
 * the last poll for the device it just stopped offering.
 * @param {object} gladys - The connected GladysIntegration instance.
 * @param {object} config - Normalized integration config.
 * @param {object[]} entries - Stored devices, from `getManagedDevices`.
 * @param {object} device - The device to refresh.
 * @returns {Promise<void>} Resolves once the state was published (or skipped).
 * @example
 * await dispatchPoll(gladys, config, entries, device);
 */
export async function dispatchPoll(gladys, config, entries, device) {
  const entry = findEntryByExternalId(gladys, entries, device.external_id);
  if (!entry) {
    return;
  }
  await networkDeviceOnPoll(gladys, config, entry);
}

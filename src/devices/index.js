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
  onSetValue as networkDeviceOnSetValue,
} from './networkDevice.js';
import { normalizeMac } from '../store.js';

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
 * @description Find a stored entry by name or MAC address, case-insensitive.
 * Used by the `wake_device` / `remove_device` manifest actions: their `device`
 * field is a plain string, not a `select`/`source: "devices"` (Gladys core's
 * validateConfigValue only checks a field's static `options`, never resolving
 * a dynamic `source` - such a field is unconditionally rejected as
 * "must be one of" with no valid values, see externalIntegration.
 * validateConfigValue.js). Tries an exact MAC match first, then an exact
 * (case-insensitive) name match.
 * @param {object[]} entries - Stored devices, from `getManagedDevices`.
 * @param {string} query - The user-provided name or MAC.
 * @returns {object|undefined} The matching entry, if any.
 * @example
 * const entry = findEntryByQuery(entries, 'aa:bb:cc:dd:ee:ff');
 */
export function findEntryByQuery(entries, query) {
  const trimmed = String(query ?? '').trim();
  if (!trimmed) {
    return undefined;
  }
  const normalizedMac = normalizeMac(trimmed);
  return (
    entries.find((entry) => entry.mac === normalizedMac) ||
    entries.find((entry) => entry.name.toLowerCase() === trimmed.toLowerCase())
  );
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

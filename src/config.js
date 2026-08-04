// -----------------------------------------------------------------------------
// Integration configuration.
//
// Filled in by the user in Gladys, from the `config_schema` declared in
// `gladys-assistant-integration.json`. The SDK fetches it for you
// (`gladys.getConfig()`) and notifies every change through
// `gladys.onConfigUpdated()`.
//
// The list of managed LAN devices is NOT part of this config: it is free
// internal storage (see src/store.js), never rendered as a form field.
// -----------------------------------------------------------------------------

// Defaults: they MUST stay consistent with the `default` values declared in
// the `config_schema` of the manifest.
export const DEFAULT_CONFIG = {
  presence_check: true, // periodically probe each device's IP
  presence_check_port: 80, // TCP port used when a device has no port of its own
  poll_frequency: 60, // seconds, how often presence is refreshed
};

// Gladys core only accepts a device poll_frequency in this exact set of
// milliseconds (DEVICE_POLL_FREQUENCIES in server/utils/constants.js); any
// other value is refused with a 400. The manifest's `poll_frequency` select
// exposes these same values in seconds.
const ALLOWED_POLL_FREQUENCY_SECONDS = [1, 2, 10, 15, 30, 60];

/**
 * Merge the user config with the defaults.
 * @param {Record<string, unknown>} raw config returned by the SDK
 */
export function normalizeConfig(raw = {}) {
  const pollFrequency = Number(raw.poll_frequency ?? DEFAULT_CONFIG.poll_frequency);

  return {
    ...DEFAULT_CONFIG,
    ...raw,
    // The toggle is a boolean; anything but an explicit false means true.
    presence_check:
      raw.presence_check === undefined
        ? DEFAULT_CONFIG.presence_check
        : raw.presence_check !== false,
    // Force the types: config may arrive as strings from a form.
    presence_check_port: Number(raw.presence_check_port ?? DEFAULT_CONFIG.presence_check_port),
    poll_frequency: ALLOWED_POLL_FREQUENCY_SECONDS.includes(pollFrequency)
      ? pollFrequency
      : DEFAULT_CONFIG.poll_frequency,
  };
}

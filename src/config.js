// -----------------------------------------------------------------------------
// Integration configuration.
//
// The Wake on LAN integration has no user-configurable settings beyond the
// purely-presentational `intro` section. This module is kept as a thin shim
// so the rest of the codebase can import a consistent `normalizeConfig`
// helper if settings are added in the future.
// -----------------------------------------------------------------------------

export const DEFAULT_CONFIG = {};

/**
 * Normalize the raw config returned by the SDK (currently no-op).
 * @param {Record<string, unknown>} [raw] - Config returned by gladys.getConfig().
 * @returns {object} Normalized config.
 */
export function normalizeConfig(raw = {}) {
  return { ...DEFAULT_CONFIG, ...raw };
}

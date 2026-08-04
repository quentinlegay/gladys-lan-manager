// -----------------------------------------------------------------------------
// Minimal in-memory stand-in for the Gladys SDK object, for unit tests.
//
// It reproduces the only surface the integration code relies on:
//   - externalIds(type, platformId) -> { device, feature(key) }
//   - publishState / publishDiscoveredDevices -> record calls so tests can assert them
//   - scanNetwork                   -> records the mediated-broadcast calls
//   - config / setConfig            -> in-memory config store, PATCH semantics
// This lets us test the pure "wiring" logic (discovery payloads, dispatch,
// storage) without a running Gladys server or a real WebSocket.
// -----------------------------------------------------------------------------

export function createFakeGladys(initialConfig = {}) {
  const published = [];
  const scans = [];
  const configPatches = [];

  return {
    config: { ...initialConfig },
    published,
    scans,
    configPatches,
    discovered: [],

    externalIds(type, platformId) {
      const device = `${type}:${platformId}`;
      return {
        device,
        feature: (key) => `${device}:${key}`,
      };
    },

    async publishState(featureExternalId, state) {
      published.push({ featureExternalId, state });
    },

    async publishDiscoveredDevices(devices) {
      this.discovered = devices;
    },

    async scanNetwork(type, options) {
      scans.push({ type, options });
      return [];
    },

    async setConfig(partial) {
      configPatches.push(partial);
      this.config = { ...this.config, ...partial };
    },

    async setConnectionStatus(connected, message) {
      this.connectionStatus = { connected, message };
    },
  };
}

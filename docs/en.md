# Wake on LAN

This is the user documentation for the integration. Gladys re-hosts this
file and shows a permanent **Documentation** link in the Configuration
screen — it is when configuring that you need it most.

## What you get

Wake on LAN lets you register network devices — a desktop PC, a NAS, a
media server — and send them a **magic packet** to power them on remotely
with a single button press inside Gladys.

Because these devices are powered off by definition, they cannot be
discovered by a network scan. You register each one by hand (name, MAC
address) with the **Add a device** action, then create it from the
**Discovery** tab like any other Gladys device.

## Prerequisites

- **Wake-on-LAN must be enabled on the target device**: in its BIOS/UEFI
  ("Power On by PCI-E/PCIE", "Wake on LAN"…) and in its network adapter's
  driver settings (Windows: adapter Properties → Power Management / Advanced).
- The device should stay **connected by Ethernet cable**. Wi-Fi WoL support
  is inconsistent across adapters and is often disabled when the machine is
  fully powered off.
- The device and the Gladys server must be on the **same local network** (or
  a network your router bridges broadcast traffic across) — the magic packet
  is a LAN broadcast, it is not routed over the Internet.

## Configuration

1. Use the **Add a device** action to register a device (name, MAC address,
   and optionally its IP address for your own reference).
2. Open the **Discovery** tab and create the device that just appeared.
3. The device now has a **Wake** switch in your Gladys dashboard. Activate it
   to send the magic packet and power the machine on.

## Actions

- **Add a device** — registers a device (or updates it if you add the same
  MAC address again).
- **Remove a device** — stops offering a registered device (existing device
  history in Gladys is kept, like any other integration).
- **Send Wake-on-LAN now** — a quick way to test a wake-up without leaving
  the Configuration screen; the device's **Wake** switch does the same thing.

## How the magic packet actually gets sent

The integration container runs sandboxed on its own network: a broadcast
packet it tried to send directly would never reach your LAN. Instead, Wake
on LAN asks the Gladys core itself (which runs on your LAN) to broadcast the
magic packet on its behalf — a *mediated* broadcast declared in the
manifest. Because of that, only **one** wake request is accepted every
10 seconds; if you click "Wake" again immediately, wait a few seconds and
retry.

## Troubleshooting

- **Nothing happens when I click Wake**: double-check Wake-on-LAN is enabled
  in the BIOS/UEFI and the network adapter, and that the device is on
  Ethernet. Some switches/routers with strict client isolation or IGMP
  snooping can also block LAN broadcasts.
- The integration logs everything it does: check the integration logs from
  the Gladys UI (or `docker logs` on the host) with `LOG_LEVEL=debug` for
  the full detail.

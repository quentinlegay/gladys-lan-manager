# LAN Manager

This is the user documentation of the integration. Gladys re-hosts this file
and shows a permanent **Documentation** link to it in the Configuration
screen (in the user's language, with English as the fallback) — it is when
configuring that the user needs it most.

## What you get

LAN Manager lets you register plain devices of your local network — a
desktop PC, a NAS, a media server — that have no cloud API and no local
protocol of their own, so Gladys can:

- send them a **Wake-on-LAN** magic packet to power them on remotely;
- optionally **monitor whether they are online**, refreshed on a timer.

Because these devices are usually powered off, they cannot be discovered by
any network scan: you register each one by hand (name, MAC address, IP
address) with the **Add a device** action, then create it from the
**Discovery** tab like any other device.

## Prerequisites

- **Wake-on-LAN must be enabled on the target device**: in its BIOS/UEFI
  ("Power On by PCI-E/PCIE", "Wake on LAN"...) and in its network adapter's
  driver settings (Windows: adapter Properties → Power Management / Advanced).
- The device should stay **connected by Ethernet cable**. Wi-Fi Wake-on-LAN
  support is inconsistent across adapters and is often disabled while the
  computer is fully powered off.
- The device you registered and the Gladys server should be on the **same
  local network** (or a network your router bridges broadcast traffic across)
  — the magic packet is a LAN broadcast, it is not routed over the Internet.

## Configuration

1. Open the **Configuration** tab of the integration and read the "How it
   works" section.
2. Optionally adjust **presence detection**: enable/disable it, set the
   default TCP port probed to decide if a device is online, and the refresh
   interval.
3. Use the **Add a device** action to register a device (name, MAC address,
   IP address, and an optional port override for its presence check).
4. Open the **Discovery** tab and create the device that just appeared.

## Actions

- **Add a device** — registers a device (or updates it, if you add the same
  MAC address again).
- **Remove a device** — pick one of your registered devices and stop
  offering it (existing history is kept, like any other integration).
- **Send Wake-on-LAN now** — a quick way to test wake-up without leaving the
  Configuration screen; the device's own "Wake" button does the same thing.

## How Wake-on-LAN actually gets sent

The integration container runs sandboxed on its own network: a broadcast
packet it tried to send directly would never reach your LAN. Instead, LAN
Manager asks the Gladys core itself (which does run on your LAN) to
broadcast the magic packet on its behalf — a "mediated" broadcast, declared
in the integration manifest. Because of that, only **one** wake request is
accepted every 10 seconds; if you click "Wake" again immediately, wait a few
seconds and retry.

## Troubleshooting

- **Nothing happens when I click Wake**: double-check Wake-on-LAN is enabled
  in the BIOS/UEFI and the network adapter, and that the device is on Ethernet.
  Some managed switches/routers with strict client isolation or IGMP
  snooping can also block LAN broadcasts.
- **Presence is always offline for a device I know is on**: try a different
  presence-check port — a strict firewall on the device may be dropping the
  default port. Any TCP port that the device's firewall lets through works.
- The integration logs everything it does: check the integration logs from
  the Gladys UI (or `docker logs` on the host) with `LOG_LEVEL=debug` for the
  full detail.

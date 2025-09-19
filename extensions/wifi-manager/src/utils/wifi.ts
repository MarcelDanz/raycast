import { exec, execSync } from "child_process";
import { WifiNetwork } from "../types";

let wifiInterface: string | null = null;

function getWifiInterface(): string {
  if (wifiInterface) {
    return wifiInterface;
  }
  try {
    const result = execSync("/usr/sbin/networksetup -listallhardwareports").toString();
    const lines = result.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes("Hardware Port: Wi-Fi")) {
        const deviceLine = lines[i + 1];
        const match = deviceLine.match(/Device: (en\d+)/);
        if (match) {
          wifiInterface = match[1];
          return wifiInterface;
        }
      }
    }
    throw new Error("Could not find Wi-Fi interface.");
  } catch (error) {
    console.error(error);
    throw new Error("Could not find Wi-Fi interface.");
  }
}

export function isWifiEnabled(): boolean {
  try {
    const interfaceName = getWifiInterface();
    const result = execSync(`/usr/sbin/networksetup -getairportpower ${interfaceName}`).toString();
    return result.includes("On");
  } catch (error) {
    return false;
  }
}

export function toggleWifi(enabled: boolean): Promise<void> {
  return new Promise((resolve, reject) => {
    const state = enabled ? "on" : "off";
    const interfaceName = getWifiInterface();
    exec(`/usr/sbin/networksetup -setairportpower ${interfaceName} ${state}`, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

function rssiToStrength(rssi: number): number {
  // -50 dBm: Excellent
  // -100 dBm: Unusable
  // Clamp RSSI to the [-100, -50] range
  const clampedRssi = Math.max(-100, Math.min(rssi, -50));
  // Convert to a 0-100 scale
  return Math.round(2 * (clampedRssi + 100));
}

function fetchConnectedNetworkName(): Promise<string | null> {
  return new Promise((resolve) => {
    if (!isWifiEnabled()) {
      return resolve(null);
    }
    const command = `/usr/sbin/system_profiler SPAirPortDataType -json`;
    exec(command, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout) => {
      if (error) {
        return resolve(null);
      }
      try {
        const json = JSON.parse(stdout);
        const info =
          json.SPAirPortDataType?.[0]?.spairport_airport_interfaces?.[0]?.spairport_current_network_information;

        if (info) {
          const currentNetwork = Array.isArray(info) ? info[0] : info;
          resolve(currentNetwork?._name || null);
        } else {
          resolve(null);
        }
      } catch (parseError) {
        resolve(null);
      }
    });
  });
}

interface RawWifiNetwork {
  SSID?: string;
  _name?: string;
  RSSI?: string;
  spairport_signal_noise?: string;
  SECURITY?: string;
  SECURITY_TYPE?: string;
  spairport_security_mode?: string;
}

export function scanForWifiNetworks(): Promise<WifiNetwork[]> {
  return new Promise((resolve, reject) => {
    if (!isWifiEnabled()) {
      return resolve([]);
    }
    const command = `/usr/sbin/system_profiler SPAirPortDataType -json`;
    exec(command, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout) => {
      if (error) {
        console.error(`Error executing wifi scan: ${error}`);
        return reject(error);
      }

      try {
        const json = JSON.parse(stdout);
        const interfaceData = json.SPAirPortDataType?.[0]?.spairport_airport_interfaces?.[0];

        if (!interfaceData) {
          return resolve([]);
        }

        const networks: { name: string; rssi: number; strength: number; security: string; isConnected: boolean }[] = [];

        const parseAndAdd = (net: RawWifiNetwork, isConnected: boolean) => {
          const name = net.SSID || net._name;
          if (!name) return;

          let rssi = NaN;
          if (net.RSSI) {
            rssi = parseInt(net.RSSI, 10);
          } else if (net.spairport_signal_noise) {
            const rssiMatch = net.spairport_signal_noise.match(/(-?\d+)/);
            if (rssiMatch) rssi = parseInt(rssiMatch[1], 10);
          }

          if (isNaN(rssi)) return;

          networks.push({
            name,
            rssi,
            strength: rssiToStrength(rssi),
            security: net.SECURITY || net.SECURITY_TYPE || net.spairport_security_mode || "None",
            isConnected,
          });
        };

        if (interfaceData.spairport_current_network_information) {
          const currentNetwork = Array.isArray(interfaceData.spairport_current_network_information)
            ? interfaceData.spairport_current_network_information[0]
            : interfaceData.spairport_current_network_information;
          if (currentNetwork) parseAndAdd(currentNetwork, true);
        }

        if (interfaceData.spairport_airport_other_local_wireless_networks) {
          interfaceData.spairport_airport_other_local_wireless_networks.forEach((net: RawWifiNetwork) =>
            parseAndAdd(net, false),
          );
        }

        const uniqueNetworks = new Map<
          string,
          { name: string; rssi: number; strength: number; security: string; isConnected: boolean }
        >();
        for (const network of networks) {
          const existing = uniqueNetworks.get(network.name);
          if (
            !existing ||
            (network.isConnected && !existing.isConnected) ||
            (network.isConnected === existing.isConnected && network.rssi > existing.rssi)
          ) {
            uniqueNetworks.set(network.name, network);
          }
        }

        const result: WifiNetwork[] = Array.from(uniqueNetworks.values()).map((net) => ({
          name: net.name,
          strength: net.strength,
          security: net.security,
          isConnected: net.isConnected,
        }));

        resolve(result);
      } catch (parseError) {
        console.error("Error parsing wifi scan output:", parseError);
        reject(new Error("Could not parse wifi scan results."));
      }
    });
  });
}

export function connectToWifi(name: string, password?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const interfaceName = getWifiInterface();
    const command = password
      ? `/usr/sbin/networksetup -setairportnetwork ${interfaceName} "${name}" "${password}"`
      : `/usr/sbin/networksetup -setairportnetwork ${interfaceName} "${name}"`;

    exec(command, (error, stdout) => {
      if (error) {
        return reject(new Error(`Failed to connect to ${name}.`));
      }

      // If a password was provided and it failed, it's a genuine error.
      if (password && stdout.includes("Failed to join network")) {
        return reject(new Error(`Failed to join network ${name}. Incorrect password?`));
      }

      // In all other cases (including a potential false negative when using Keychain),
      // we proceed to poll to verify the connection status.
      const pollInterval = 500; // ms
      const timeout = 20000; // 20 seconds
      let elapsedTime = 0;

      const poll = async () => {
        const currentNetwork = await fetchConnectedNetworkName();
        if (currentNetwork === name) {
          return resolve();
        }

        elapsedTime += pollInterval;
        if (elapsedTime >= timeout) {
          return reject(new Error(`Connection to ${name} timed out.`));
        }
        setTimeout(poll, pollInterval);
      };

      poll();
    });
  });
}

export function trustSecurityForWifiNetwork(name: string, password: string): Promise<void> {
  return new Promise((resolve) => {
    const command = `security add-generic-password -U -a "${name}" -s "${name}" -w "${password}" -T /usr/bin/security`;
    exec(command, () => {
      // We resolve regardless of outcome, as this is a best-effort operation
      // to prevent future prompts. The main goal is to proceed with connection.
      resolve();
    });
  });
}

export function getPasswordFromKeychain(name: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // Wi-Fi passwords are "AirPort network passwords" and the account (-a) is the SSID
    // The -w flag outputs just the password
    const command = `security find-generic-password -wa "${name}"`;
    exec(command, (error, stdout, stderr) => {
      if (error || stderr) {
        // This fails if password is not found, or user denies access via prompt
        return reject(new Error("Password not found in Keychain or access denied."));
      }
      const password = stdout.trim();
      if (password) {
        resolve(password);
      } else {
        // Should be covered by error/stderr case, but as a fallback
        reject(new Error("Password not found in Keychain."));
      }
    });
  });
}

export function getIpAddress(): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const interfaceName = getWifiInterface();
      exec(`/usr/sbin/ipconfig getifaddr ${interfaceName}`, (error, stdout) => {
        if (error || !stdout.trim()) {
          resolve(null);
        } else {
          resolve(stdout.trim());
        }
      });
    } catch (error) {
      resolve(null);
    }
  });
}

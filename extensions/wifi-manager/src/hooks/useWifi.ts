import { useCachedPromise } from "@raycast/utils";
import { scanForWifiNetworks, getIpAddress, isWifiEnabled } from "../utils/wifi";
import { getNetworkUsageCounts } from "../utils/localStorage";
import { showToast, Toast } from "@raycast/api";
import { MergedWifiNetwork } from "../types";

async function fetchNetworks(): Promise<MergedWifiNetwork[]> {
  if (!isWifiEnabled()) {
    await showToast({ style: Toast.Style.Failure, title: "Wifi is turned off" });
    return [];
  }

  const scanningToast = await showToast({ style: Toast.Style.Animated, title: "Scanning for networks..." });

  try {
    const [scannedNetworks, usageCounts, ipAddress] = await Promise.all([
      scanForWifiNetworks(),
      getNetworkUsageCounts(),
      getIpAddress(),
    ]);

    if (scannedNetworks.length > 0) {
      scanningToast.style = Toast.Style.Success;
      scanningToast.title = `Found ${scannedNetworks.length} networks`;
    } else {
      scanningToast.style = Toast.Style.Success;
      scanningToast.title = "No networks found";
    }

    const mergedNetworks: MergedWifiNetwork[] = scannedNetworks.map((net) => ({
      ...net,
      usageCount: usageCounts[net.name] || 0,
      ipAddress: net.isConnected ? ipAddress : null,
    }));

    mergedNetworks.sort((a, b) => {
      if (a.isConnected) return -1;
      if (b.isConnected) return 1;
      return b.usageCount - a.usageCount;
    });

    return mergedNetworks;
  } catch (error) {
    scanningToast.style = Toast.Style.Failure;
    scanningToast.title = "Failed to scan for networks";
    if (error instanceof Error) {
      scanningToast.message = error.message;
    }
    return [];
  }
}

export function useWifi() {
  const { isLoading, data, error, revalidate } = useCachedPromise(fetchNetworks, [], {
    keepPreviousData: false,
  });

  return {
    isLoading,
    networks: data,
    error,
    revalidate,
  };
}

import { LocalStorage } from "@raycast/api";

export async function getNetworkUsageCounts(): Promise<Record<string, number>> {
  const storedCounts = await LocalStorage.getItem<string>("networkUsageCounts");
  return storedCounts ? JSON.parse(storedCounts) : {};
}

export async function incrementConnectionCount(name: string): Promise<void> {
  const counts = await getNetworkUsageCounts();
  counts[name] = (counts[name] || 0) + 1;
  await LocalStorage.setItem("networkUsageCounts", JSON.stringify(counts));
}

const TRUSTED_NETWORKS_KEY = "trustedNetworksAttempted";

export async function getTrustedNetworksAttempted(): Promise<Set<string>> {
  const stored = await LocalStorage.getItem<string>(TRUSTED_NETWORKS_KEY);
  return stored ? new Set(JSON.parse(stored)) : new Set();
}

export async function addTrustedNetworkAttempt(name: string): Promise<void> {
  const trusted = await getTrustedNetworksAttempted();
  trusted.add(name);
  await LocalStorage.setItem(TRUSTED_NETWORKS_KEY, JSON.stringify(Array.from(trusted)));
}

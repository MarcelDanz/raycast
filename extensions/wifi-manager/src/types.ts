export interface WifiNetwork {
  name: string;
  strength: number;
  security: string;
  isConnected: boolean;
}

export interface MergedWifiNetwork extends WifiNetwork {
  usageCount: number;
  ipAddress?: string | null;
}

export interface BluetoothDevice {
  name: string;
  address: string;
  connected: boolean;
  minorType: string;
}

export interface DiscoveredBluetoothDevice {
  name: string;
  address: string;
}

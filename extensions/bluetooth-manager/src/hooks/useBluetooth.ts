import { exec } from "child_process";
import { useState, useEffect, useCallback } from "react";
import { BluetoothDevice } from "../types";

interface SystemProfilerOutput {
  SPBluetoothDataType: {
    device_connected?: Record<string, DeviceInfo>[];
    device_not_connected?: Record<string, DeviceInfo>[];
  }[];
}

interface DeviceInfo {
  device_name?: string;
  device_minorType: string;
  device_isconnected?: "Yes" | "No";
  device_address: string;
}

const parseOutput = (jsonOutput: string): BluetoothDevice[] => {
  try {
    const data = JSON.parse(jsonOutput) as SystemProfilerOutput;
    const bluetoothInfo = data.SPBluetoothDataType[0];
    if (!bluetoothInfo) return [];

    const deviceMap = new Map<string, BluetoothDevice>();

    const processDeviceList = (list: Record<string, DeviceInfo>[] | undefined, connected: boolean) => {
      if (!list) return;
      list
        .flatMap((deviceObject) => Object.entries(deviceObject))
        .forEach(([nameFromKey, info]) => {
          if (info.device_address && !deviceMap.has(info.device_address)) {
            deviceMap.set(info.device_address, {
              name: info.device_name || nameFromKey,
              address: info.device_address,
              connected: connected,
              minorType: info.device_minorType,
            });
          }
        });
    };

    processDeviceList(bluetoothInfo.device_connected, true);
    processDeviceList(bluetoothInfo.device_not_connected, false);

    const devices = Array.from(deviceMap.values());

    return devices;
  } catch (error) {
    // The error is caught and displayed in the UI, so no need to log here.
    throw new Error("Could not parse JSON from system_profiler");
  }
};

export function useBluetooth() {
  const [devices, setDevices] = useState<BluetoothDevice[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDevices = useCallback(() => {
    setIsLoading(true);
    setError(null);

    exec("/usr/sbin/system_profiler SPBluetoothDataType -json", (err, stdout) => {
      try {
        if (err) {
          throw err;
        }

        const parsedDevices = parseOutput(stdout);
        setDevices(parsedDevices);
      } catch (e) {
        setError(e as Error);
        setDevices([]);
      } finally {
        setIsLoading(false);
      }
    });
  }, []);

  useEffect(() => {
    fetchDevices();
  }, []);

  return { devices, error, isLoading, revalidate: fetchDevices, setDevices };
}

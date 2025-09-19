import { useState, useEffect, useCallback } from "react";
import { exec } from "child_process";
import { DiscoveredBluetoothDevice } from "../types";
import { findBlueutilPath } from "../utils";

export function useBluetoothDiscovery() {
  const [devices, setDevices] = useState<DiscoveredBluetoothDevice[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [blueutilPath, setBlueutilPath] = useState<string | null>(null);

  useEffect(() => {
    findBlueutilPath().then(setBlueutilPath);
  }, []);

  const discoverDevices = useCallback(() => {
    if (!blueutilPath) {
      if (isLoading) setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    // blueutil --inquiry runs for 10-20 seconds by default.
    exec(`"${blueutilPath}" --inquiry`, (err, stdout, stderr) => {
      setIsLoading(false);
      if (err || stderr) {
        setError(new Error(stderr || err?.message));
        return;
      }

      const discovered: DiscoveredBluetoothDevice[] = [];
      const lines = stdout.trim().split("\n");
      lines.forEach((line) => {
        const addressMatch = line.match(/address: ([\w-]+)/);
        const nameMatch = line.match(/name: "([^"]+)"/);

        if (addressMatch && nameMatch) {
          discovered.push({
            address: addressMatch[1],
            name: nameMatch[1],
          });
        }
      });
      setDevices(discovered);
    });
  }, [blueutilPath]);

  useEffect(() => {
    discoverDevices();
  }, [discoverDevices]);

  return { devices, error, isLoading, blueutilPath, revalidate: discoverDevices };
}

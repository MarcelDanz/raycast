import { Action, ActionPanel, Alert, Color, Icon, List, showToast, Toast, confirmAlert } from "@raycast/api";
import { exec } from "child_process";
import { useEffect, useState } from "react";
import { useBluetooth } from "./hooks/useBluetooth";
import { findBlueutilPath } from "./utils";

const getDeviceIcon = (minorType: string): Icon => {
  switch (minorType.toLowerCase()) {
    case "keyboard":
      return Icon.Keyboard;
    case "mouse":
      return Icon.Mouse;
    case "headset":
    case "headphones":
    case "earbuds":
      return Icon.Headphones;
    case "gamepad":
      return Icon.GameController;
    default:
      return Icon.Bluetooth;
  }
};

export default function Command() {
  const [blueutilPath, setBlueutilPath] = useState<string | null>(null);
  const [isPathLoading, setIsPathLoading] = useState(true);

  useEffect(() => {
    findBlueutilPath().then((path) => {
      setBlueutilPath(path);
      setIsPathLoading(false);
    });
  }, []);

  const { devices, error, isLoading, revalidate, setDevices } = useBluetooth();
  const [isForgetting, setIsForgetting] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (devices.length > 0 && !selectedId) {
      setSelectedId(devices[0].address);
    }
  }, [devices]);

  const selectNextItem = () => {
    if (!selectedId) return;
    const currentIndex = devices.findIndex((d) => d.address === selectedId);
    if (currentIndex < devices.length - 1) {
      setSelectedId(devices[currentIndex + 1].address);
    }
  };

  const selectPreviousItem = () => {
    if (!selectedId) return;
    const currentIndex = devices.findIndex((d) => d.address === selectedId);
    if (currentIndex > 0) {
      setSelectedId(devices[currentIndex - 1].address);
    }
  };

  async function handleToggleConnection(address: string, isConnected: boolean) {
    if (!blueutilPath) {
      showToast({
        style: Toast.Style.Failure,
        title: "blueutil not found",
        message: "Please ensure blueutil is installed and in your PATH.",
      });
      return;
    }

    // Optimistically update the UI
    setDevices((prevDevices) =>
      prevDevices.map((d) => (d.address === address ? { ...d, connected: !isConnected } : d)),
    );

    const actionVerb = isConnected ? "Disconnecting" : "Connecting";

    const toast = await showToast({
      style: Toast.Style.Animated,
      title: `${actionVerb}...`,
    });

    try {
      const action = isConnected ? "disconnect" : "connect";
      exec(`"${blueutilPath}" --${action} ${address}`, (error, stdout, stderr) => {
        if (error || stderr) {
          toast.style = Toast.Style.Failure;
          toast.title = `Failed to ${action}`;
          toast.message = stderr || error?.message;
          revalidate(); // Revert optimistic update on failure
          return;
        }

        toast.style = Toast.Style.Success;
        toast.title = `${actionVerb.replace("ing", "ed")}`;

        // Re-fetch from source of truth to ensure consistency
        setTimeout(() => {
          revalidate();
        }, 1000);
      });
    } catch (err) {
      toast.style = Toast.Style.Failure;
      toast.title = "Error";
      toast.message = err instanceof Error ? err.message : "Unknown error";
      revalidate(); // Revert optimistic update on failure
    }
  }

  async function handleForgetDevice(address: string, name: string) {
    if (
      await confirmAlert({
        title: `Forget ${name}?`,
        message: "This device will be unpaired. You may need to pair it again to reconnect.",
        icon: Icon.Trash,
        primaryAction: { title: "Forget Device", style: Alert.ActionStyle.Destructive },
      })
    ) {
      if (!blueutilPath) {
        showToast({
          style: Toast.Style.Failure,
          title: "blueutil not found",
          message: "Please ensure blueutil is installed and in your PATH.",
        });
        return;
      }

      const toast = await showToast({
        style: Toast.Style.Animated,
        title: `Forgetting ${name}...`,
      });

      setIsForgetting(true);
      try {
        exec(`"${blueutilPath}" --unpair ${address}`, (error, stdout, stderr) => {
          setIsForgetting(false);
          if (error || stderr) {
            toast.style = Toast.Style.Failure;
            toast.title = `Failed to forget ${name}`;
            toast.message = stderr || error?.message;
            revalidate();
            return;
          }

          toast.style = Toast.Style.Success;
          toast.title = `Forgot ${name}`;
          setTimeout(() => revalidate(), 1000);
        });
      } catch (err) {
        setIsForgetting(false);
        toast.style = Toast.Style.Failure;
        toast.title = "Error";
        toast.message = err instanceof Error ? err.message : "Unknown error";
        revalidate();
      }
    }
  }

  if (isPathLoading) {
    return <List isLoading={true} />;
  }

  if (!blueutilPath) {
    return (
      <List>
        <List.EmptyView
          title="blueutil Not Found"
          description="Please install it with Homebrew (brew install blueutil) and ensure it's in your PATH."
          icon={Icon.Warning}
        />
      </List>
    );
  }

  return (
    <List
      isLoading={isLoading || isForgetting}
      selectedItemId={selectedId || undefined}
      onSelectionChange={(id) => {
        id && setSelectedId(id);
      }}
    >
      <List.EmptyView
        title={error ? "Could not fetch devices" : "No devices found"}
        description={error ? error.message : "Press ⌘+R to refresh."}
        icon={error ? Icon.XMarkCircle : Icon.Bluetooth}
      />
      {devices.map((device) => (
        <List.Item
          key={device.address}
          id={device.address}
          title={device.name}
          icon={{
            source: getDeviceIcon(device.minorType),
            tintColor: !device.connected ? Color.SecondaryText : undefined,
          }}
          actions={
            <ActionPanel>
              <Action
                title={device.connected ? "Disconnect" : "Connect"}
                onAction={() => handleToggleConnection(device.address, device.connected)}
              />
              <ActionPanel.Section>
                <Action
                  title="Forget Device"
                  style={Action.Style.Destructive}
                  icon={Icon.Trash}
                  onAction={() => handleForgetDevice(device.address, device.name)}
                  shortcut={{ modifiers: [], key: "x" }}
                />
              </ActionPanel.Section>
              <Action title="Refresh" onAction={revalidate} shortcut={{ modifiers: ["cmd"], key: "r" }} />
              <Action
                title="Select Previous Item"
                icon={Icon.ChevronUp}
                onAction={selectPreviousItem}
                shortcut={{ modifiers: ["cmd", "ctrl"], key: "k" }}
              />
              <Action
                title="Select Next Item"
                icon={Icon.ChevronDown}
                onAction={selectNextItem}
                shortcut={{ modifiers: ["cmd", "ctrl"], key: "j" }}
              />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}

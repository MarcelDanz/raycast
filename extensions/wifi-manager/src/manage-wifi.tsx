import { Action, ActionPanel, Color, Form, Icon, List, showToast, Toast, useNavigation } from "@raycast/api";
import { useEffect, useState } from "react";
import {
  connectToWifi,
  getPasswordFromKeychain,
  isWifiEnabled,
  toggleWifi,
  trustSecurityForWifiNetwork,
} from "./utils/wifi";
import { addTrustedNetworkAttempt, getTrustedNetworksAttempted, incrementConnectionCount } from "./utils/localStorage";
import { MergedWifiNetwork } from "./types";
import { useWifi } from "./hooks/useWifi";

export default function Command() {
  const { networks, error, isLoading, revalidate } = useWifi();
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  useEffect(() => {
    if (networks && networks.length > 0) {
      if (selectedItemId === null || !networks.some((n) => n.name === selectedItemId)) {
        const connectedNetwork = networks.find((n) => n.isConnected);
        setSelectedItemId(connectedNetwork ? connectedNetwork.name : networks[0].name);
      }
    } else if (networks) {
      setSelectedItemId(null);
    }
  }, [networks]);

  const handleSelectNext = () => {
    if (!networks || !selectedItemId) return;
    const currentIndex = networks.findIndex((n) => n.name === selectedItemId);
    if (currentIndex < networks.length - 1) {
      setSelectedItemId(networks[currentIndex + 1].name);
    }
  };

  const handleSelectPrevious = () => {
    if (!networks || !selectedItemId) return;
    const currentIndex = networks.findIndex((n) => n.name === selectedItemId);
    if (currentIndex > 0) {
      setSelectedItemId(networks[currentIndex - 1].name);
    }
  };

  return (
    <List
      isLoading={isLoading}
      searchBarPlaceholder="Search Wifi networks..."
      selectedItemId={selectedItemId ?? undefined}
      onSelectionChange={(id) => setSelectedItemId(id)}
    >
      <List.EmptyView
        title={error ? "Could not fetch connections" : "No Wifi networks found"}
        description={error ? error.message : "Press R to refresh."}
        icon={error ? Icon.XMarkCircle : Icon.Wifi}
        actions={
          <ActionPanel>
            <Action
              title="Toggle Wifi"
              shortcut={{ modifiers: ["cmd"], key: "t" }}
              onAction={async () => {
                await showToast({ style: Toast.Style.Animated, title: "Toggling Wifi..." });
                try {
                  const enabled = isWifiEnabled();
                  await toggleWifi(!enabled);
                  if (!enabled) {
                    await new Promise((resolve) => setTimeout(resolve, 1000));
                  }
                  await showToast({
                    style: Toast.Style.Success,
                    title: enabled ? "Wifi Turned Off" : "Wifi Turned On",
                  });
                  revalidate();
                } catch (error) {
                  await showToast({
                    style: Toast.Style.Failure,
                    title: "Failed to Toggle Wifi",
                    message: error instanceof Error ? error.message : String(error),
                  });
                }
              }}
            />
            <Action title="Refresh" onAction={revalidate} shortcut={{ modifiers: ["cmd"], key: "r" }} />
          </ActionPanel>
        }
      />
      {networks?.map((network) => (
        <WifiListItem
          key={network.name}
          network={network}
          onConnect={revalidate}
          onSelectNext={handleSelectNext}
          onSelectPrevious={handleSelectPrevious}
        />
      ))}
    </List>
  );
}

function getStrengthIcon(strength: number): Icon {
  if (strength > 75) {
    return Icon.StackedBars4;
  } else if (strength > 50) {
    return Icon.StackedBars3;
  } else if (strength > 25) {
    return Icon.StackedBars2;
  } else {
    return Icon.StackedBars1;
  }
}

function PasswordForm({ network, onConnect }: { network: MergedWifiNetwork; onConnect: () => void }) {
  const { pop } = useNavigation();

  async function handleConnect(values: { password?: string }) {
    await showToast({ style: Toast.Style.Animated, title: `Connecting to ${network.name}...` });
    try {
      if (values.password) {
        const trustedNetworks = await getTrustedNetworksAttempted();
        if (!trustedNetworks.has(network.name)) {
          await trustSecurityForWifiNetwork(network.name, values.password);
          await addTrustedNetworkAttempt(network.name);
        }
      }
      await connectToWifi(network.name, values.password);
      await incrementConnectionCount(network.name);
      await showToast({ style: Toast.Style.Success, title: `Connected to ${network.name}` });
      pop();
      onConnect();
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: `Failed to connect to ${network.name}`,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Connect" onSubmit={handleConnect} />
        </ActionPanel>
      }
    >
      <Form.PasswordField id="password" title="Password" placeholder={`Password for ${network.name}`} />
    </Form>
  );
}

function WifiListItem({
  network,
  onConnect,
  onSelectNext,
  onSelectPrevious,
}: {
  network: MergedWifiNetwork;
  onConnect: () => void;
  onSelectNext: () => void;
  onSelectPrevious: () => void;
}) {
  const { push } = useNavigation();

  async function handleConnect() {
    const isPasswordRequired = !network.security.toLowerCase().includes("none");

    if (!isPasswordRequired) {
      await showToast({ style: Toast.Style.Animated, title: `Connecting to ${network.name}...` });
      try {
        await connectToWifi(network.name);
        await incrementConnectionCount(network.name);
        await showToast({ style: Toast.Style.Success, title: `Connected to ${network.name}` });
        onConnect();
      } catch (error) {
        await showToast({
          style: Toast.Style.Failure,
          title: `Failed to connect to ${network.name}`,
          message: error instanceof Error ? error.message : String(error),
        });
      }
      return;
    }

    // For protected networks, try keychain then fallback to form
    try {
      await showToast({ style: Toast.Style.Animated, title: `Getting password from Keychain...` });
      const password = await getPasswordFromKeychain(network.name);
      const trustedNetworks = await getTrustedNetworksAttempted();
      if (!trustedNetworks.has(network.name)) {
        await trustSecurityForWifiNetwork(network.name, password);
        await addTrustedNetworkAttempt(network.name);
      }
      await showToast({ style: Toast.Style.Animated, title: `Connecting to ${network.name}...` });
      await connectToWifi(network.name, password);
      await incrementConnectionCount(network.name);
      await showToast({ style: Toast.Style.Success, title: `Connected to ${network.name}` });
      onConnect();
    } catch (keychainError) {
      // Fallback to form
      push(<PasswordForm network={network} onConnect={onConnect} />);
    }
  }

  return (
    <List.Item
      id={network.name}
      title={network.name}
      icon={{
        source: Icon.Wifi,
        tintColor: network.isConnected ? Color.PrimaryText : Color.SecondaryText,
      }}
      accessories={
        network.isConnected
          ? [{ text: `IP: ${network.ipAddress || "..."}` }, { icon: getStrengthIcon(network.strength) }]
          : [{ icon: getStrengthIcon(network.strength) }]
      }
      actions={
        <ActionPanel>
          <ActionPanel.Section>
            {!network.isConnected && <Action title="Connect" onAction={handleConnect} />}
            <Action
              title="Toggle Wifi"
              shortcut={{ modifiers: ["cmd"], key: "t" }}
              onAction={async () => {
                await showToast({ style: Toast.Style.Animated, title: "Toggling Wifi..." });
                try {
                  const enabled = isWifiEnabled();
                  await toggleWifi(!enabled);
                  if (!enabled) {
                    await new Promise((resolve) => setTimeout(resolve, 1000));
                  }
                  await showToast({
                    style: Toast.Style.Success,
                    title: enabled ? "Wifi Turned Off" : "Wifi Turned On",
                  });
                  onConnect();
                } catch (error) {
                  await showToast({
                    style: Toast.Style.Failure,
                    title: "Failed to Toggle Wifi",
                    message: error instanceof Error ? error.message : String(error),
                  });
                }
              }}
            />
          </ActionPanel.Section>
          <ActionPanel.Section>
            <Action
              title="Next Network"
              shortcut={{ modifiers: ["cmd", "ctrl"], key: "j" }}
              onAction={onSelectNext}
              icon={Icon.ArrowDown}
            />
            <Action
              title="Previous Network"
              shortcut={{ modifiers: ["cmd", "ctrl"], key: "k" }}
              onAction={onSelectPrevious}
              icon={Icon.ArrowUp}
            />
          </ActionPanel.Section>
          <Action title="Refresh" onAction={onConnect} shortcut={{ modifiers: ["cmd"], key: "r" }} />
        </ActionPanel>
      }
    />
  );
}

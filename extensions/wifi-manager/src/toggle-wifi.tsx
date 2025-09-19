import { showToast, Toast } from "@raycast/api";
import { isWifiEnabled, toggleWifi } from "./utils/wifi";

export default async function Command() {
  try {
    const enabled = isWifiEnabled();
    await toggleWifi(!enabled);
    await showToast({
      style: Toast.Style.Success,
      title: enabled ? "Wifi Turned Off" : "Wifi Turned On",
    });
  } catch (error) {
    await showToast({
      style: Toast.Style.Failure,
      title: "Failed to Toggle Wifi",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

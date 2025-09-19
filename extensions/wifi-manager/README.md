# Wifi Manager for Raycast

A Raycast extension to quickly connect to and manage your WiFi networks directly from the Raycast command bar.

## Features

- **List Networks**: View all available WiFi networks at a glance.
- **Connection Status**: Instantly see which network you are connected to, along with its IP address and signal strength.
- **Toggle Connection**: Connect to any network with a single action (`↵`).
- **Keychain Integration**: For known networks, automatically and securely retrieves your saved password from the macOS Keychain (requires one-time approval).
- **Toggle Wifi**: Turn your Mac's WiFi on or off.
- **Smart Ranking**: The currently connected network is always at the top, followed by networks sorted by how often you use them.
- **Keyboard Navigation**: Use `Cmd`+`Ctrl`+`J` and `Cmd`+`Ctrl`+`K` to navigate the list.

## Requirements

This extension uses macOS system tools and does not require any external dependencies or installations.

### First-Time Permissions

When connecting to a password-protected network for the first time, the extension will attempt to retrieve the password from your macOS Keychain. This may trigger two one-time system prompts:

1.  **A prompt to access the network password from your Keychain.**
2.  **A prompt to update the Keychain item's settings.**

Approving both prompts will allow the extension to connect to this network in the future without asking for a password. If you deny these requests, you can still connect by manually entering the password.

## Attributions

The application icon was created by [Moon.de - Flaticon](https://www.flaticon.com/free-icons/wifi)


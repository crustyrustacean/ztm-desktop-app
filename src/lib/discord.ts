import { openUrl } from "@tauri-apps/plugin-opener";

const DISCORD_CHANNEL_PATH = "channels/423464391791476747/423464391791476750";
const DISCORD_APP_URL = `discord://-/${DISCORD_CHANNEL_PATH}`;
const DISCORD_WEB_URL = `https://discord.com/${DISCORD_CHANNEL_PATH}`;

// Fall back to the browser when no app is registered for discord://
export async function openDiscord() {
  try {
    await openUrl(DISCORD_APP_URL);
  } catch {
    await openUrl(DISCORD_WEB_URL);
  }
}

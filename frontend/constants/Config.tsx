import Constants from "expo-constants";
import { Platform } from "react-native";

const getLocalBackendIP = (): string => {
  // If we are running in the browser (Expo Web), get the hostname dynamically
  if (Platform.OS === "web" && typeof window !== "undefined" && window.location) {
    return window.location.hostname;
  }

  // If we are running on native device/emulator, retrieve the Metro Bundler host IP
  const hostUri = Constants.expoConfig?.hostUri || Constants.manifest?.debuggerHost;
  if (hostUri) {
    // hostUri usually looks like "192.168.0.237:8081"
    const host = hostUri.split(":")[0];
    if (host) return host;
  }

  return "localhost";
};

const localIP = getLocalBackendIP();

export const API_URL = __DEV__
  ? `http://${localIP}:3000`
  : (process.env.EXPO_PUBLIC_API_URL || "https://demo2026pondy-production.up.railway.app");

console.log(
  `🌐 [Config] API_URL: ${API_URL} | Platform: ${Platform.OS} | Env: ${process.env.NODE_ENV}`,
);

export const API_URL = __DEV__
  ? "http://192.168.0.136:3000"
  : (process.env.EXPO_PUBLIC_API_URL || "https://demo2026pondy-production.up.railway.app");

console.log(
  `🌐 [Config] API_URL: ${API_URL} | Platform: ${require("react-native").Platform.OS} | Env: ${process.env.NODE_ENV}`,
);

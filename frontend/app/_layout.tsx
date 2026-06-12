import "react-native-get-random-values";
import "react-native-reanimated";
import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  Inter_900Black,
  useFonts,
} from "@expo-google-fonts/inter";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { useWindowDimensions } from "react-native";
import * as ScreenOrientation from "expo-screen-orientation";
import { ToastProvider } from "../components/Toast";

import { useColorScheme } from "@/hooks/use-color-scheme";

import { useAuthStore } from "@/stores/authStore";
import { useRouter, useSegments, Slot } from "expo-router";
import * as SystemUI from "expo-system-ui";
import { Theme } from "@/constants/theme";

// Set root background immediately to match theme
SystemUI.setBackgroundColorAsync(Theme.bgMain);

// Keep the splash screen visible while fonts load
SplashScreen.preventAutoHideAsync();

import { useGlobalSocketSync } from "@/hooks/useGlobalSocketSync";
import { API_URL } from "@/constants/Config";

// 🌐 GLOBAL FETCH RETRY & IDEMPOTENCY ENGINE
const originalFetch = global.fetch;
const getUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

global.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === 'string' ? input : (input instanceof URL ? input.href : (input as any).url);

  if (url && url.includes(API_URL)) {
    const maxRetries = 2;
    let delay = 500;
    let lastError: any = null;

    const options: RequestInit = init ? { ...init } : {};
    const headers: Record<string, string> = {};

    if (options.headers) {
      if (options.headers instanceof Headers) {
        options.headers.forEach((value, key) => {
          headers[key] = value;
        });
      } else if (Array.isArray(options.headers)) {
        options.headers.forEach(([key, value]) => {
          headers[key] = value;
        });
      } else {
        Object.assign(headers, options.headers);
      }
    }

    const requestId = headers['x-request-id'] || headers['X-Request-ID'] || getUUID();
    headers['x-request-id'] = requestId;
    options.headers = headers;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await originalFetch(input, options);
        if (response.status !== 503 && response.status !== 504) {
          return response;
        }
        lastError = new Error(`Server returned status ${response.status}`);
      } catch (err: any) {
        lastError = err;
        console.warn(`⚠️ [Global Fetch] [Attempt ${attempt}/${maxRetries}] failed: ${err.message || err}`);
      }

      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 1.5;
      }
    }
    throw lastError;
  }

  return originalFetch(input, init);
};

export default function RootLayout() {
  useGlobalSocketSync();
  const colorScheme = useColorScheme();
  const router = useRouter();
  const segments = useSegments();
  const user = useAuthStore((s) => s.user);

  // 🌐 SILENT API WAKE-UP & CONNECTION PRE-WARM
  useEffect(() => {
    const warmupAPI = async () => {
      console.log(`🌐 [App Startup] Warming up connection to ${API_URL}...`);
      try {
        const start = Date.now();
        // Trigger DNS lookup, TCP/SSL handshake, and backend container spin-up
        const res = await fetch(`${API_URL}/health`);
        const duration = Date.now() - start;
        console.log(`🌐 [App Startup] API warmed up successfully in ${duration}ms. Status: ${res.status}`);
      } catch (err: any) {
        console.warn(`🌐 [App Startup] API warmup ping failed (expected if backend container is booting up):`, err.message || err);
      }
    };
    warmupAPI();
  }, []);

  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    Inter_900Black,
  });

  // ✅ AUTH GUARD: Redirect based on auth state and role
  useEffect(() => {
    if (!fontsLoaded) return;

    const rootSegment = segments[0];
    const isInsideApp = !!rootSegment && rootSegment !== "login";
    
    if (!user && isInsideApp) {
      // 1. Not logged in -> Go to Login
      router.replace("/login");
    } else if (user && (!rootSegment || rootSegment === "login")) {
      // 2. Already logged in -> Go to Role-Specific Dashboard
      const role = user.role;
      const userName = (user.userName || "").trim().toUpperCase();

      if (userName === "KDS") {
        router.replace("/kds" as any);
      } else if (role === "WAITER") {
        router.replace("/(tabs)/category"); // Waiter starts at Ordering
      } else {
        router.replace("/(tabs)/category"); // Others start at POS
      }
    }
  }, [user, segments, fontsLoaded]);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <ToastProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="login" options={{ gestureEnabled: false }} />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="menu" />
          <Stack.Screen name="sales-report" />
          <Stack.Screen name="ai-chat" />
          <Stack.Screen name="day-end" />
          <Stack.Screen name="company-settings" />
          <Stack.Screen name="waiters" />
          <Stack.Screen name="members" />
          <Stack.Screen name="receivables" />
          <Stack.Screen name="waiter-history" />
          <Stack.Screen name="locked-tables" />
          <Stack.Screen name="kitchen-status" />
          <Stack.Screen name="heldOrders" />
          <Stack.Screen name="summary" />
          <Stack.Screen name="payment" />
          <Stack.Screen name="payment_success" />
          <Stack.Screen name="cart" />
          <Stack.Screen name="TimeEntry" />
        </Stack>
        <StatusBar style="light" />
      </ToastProvider>
    </ThemeProvider>
  );
}
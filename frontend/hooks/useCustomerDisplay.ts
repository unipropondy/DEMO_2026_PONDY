import { useExternalDisplay } from "react-native-external-display";

/**
 * DisplayInfo — metadata about a connected secondary display.
 */
export interface DisplayInfo {
  /** The display ID string as reported by Android's DisplayManager. */
  id: string;
  width: number;
  height: number;
}

/**
 * useCustomerDisplay
 *
 * Wraps react-native-external-display to provide a clean, typed API for
 * detecting the Sunmi D3 secondary (customer-facing) display.
 *
 * Returns the list of connected secondary displays and a boolean convenience
 * flag. On the Sunmi D3, `displays[0]` is always the customer screen.
 *
 * Hot-reconnect is handled automatically: the underlying hook re-renders
 * whenever Android's DisplayManager fires a display-added or display-removed
 * event, so this hook updates in real time with no app restart required.
 */
export function useCustomerDisplay(): {
  displays: DisplayInfo[];
  isConnected: boolean;
} {
  const screens = useExternalDisplay();

  const displays: DisplayInfo[] = Object.entries(screens).map(
    ([id, info]: [string, any]) => ({
      id,
      width: info?.width ?? 0,
      height: info?.height ?? 0,
    })
  );

  return {
    displays,
    isConnected: displays.length > 0,
  };
}

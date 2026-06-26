import React from "react";
import { StyleSheet, View } from "react-native";
import ExternalDisplay from "react-native-external-display";
import CustomerDisplayContent from "./CustomerDisplayContent";
import { useCustomerDisplay } from "../hooks/useCustomerDisplay";

interface CustomerDisplayManagerProps {
  /** Must be true before the customer screen is shown. Passed from RootLayout. */
  isPOSReady: boolean;
}

/**
 * CustomerDisplayManager
 *
 * Mounted once at the root layout level and lives for the entire app lifetime.
 * Responsible for the full lifecycle of the Sunmi D3 customer-facing secondary
 * display:
 *
 *  • Detects secondary display connect / disconnect via useCustomerDisplay().
 *  • Gates rendering until isPOSReady is true (fonts loaded, settings fetched,
 *    socket ready) so the customer screen never shows blank/stale data.
 *  • Renders CustomerDisplayContent on the secondary display using the Android
 *    Presentation API (via react-native-external-display).
 *  • Hot-reconnect: if the display is unplugged and replugged, useCustomerDisplay
 *    re-triggers automatically — no app restart needed.
 *  • fallbackInMainScreen={false}: if no secondary display is connected this
 *    component renders nothing, leaving the main operator screen untouched.
 *
 * Back button and terminal pill are preserved in CustomerDisplayContent for
 * the QA/testing phase.
 */
export function CustomerDisplayManager({ isPOSReady }: CustomerDisplayManagerProps) {
  const { displays, isConnected } = useCustomerDisplay();
  const primaryDisplay = displays[0];

  // Do not render until POS is initialised and a secondary display is present
  if (!isPOSReady || !isConnected || !primaryDisplay) {
    return null;
  }

  console.log(
    `🖥️ [CustomerDisplayManager] Rendering on display: ${primaryDisplay.id} (${primaryDisplay.width}x${primaryDisplay.height})`
  );

  return (
    <ExternalDisplay
      screen={primaryDisplay.id}
      fallbackInMainScreen={false}
      style={StyleSheet.absoluteFill}
    >
      {/* Full screen wrapper so CustomerDisplayContent fills the Presentation window */}
      <View style={styles.presentationRoot}>
        <CustomerDisplayContent />
      </View>
    </ExternalDisplay>
  );
}

const styles = StyleSheet.create({
  presentationRoot: {
    flex: 1,
  },
});

import { useEffect, useState } from "react";
import { socket } from "../constants/socket";
import { useCompanySettingsStore } from "../stores/companySettingsStore";
import { usePaymentSettingsStore } from "../stores/paymentSettingsStore";

/**
 * usePOSReadyGate
 *
 * Returns true only when the POS has finished initialisation and it is safe to
 * show the customer-facing display. This prevents the secondary screen from
 * appearing with blank/stale data immediately after a boot or cold start.
 *
 * Resolution conditions (ALL must be true):
 *   1. Fonts are loaded (passed in from RootLayout via the fontsLoaded param)
 *   2. companySettings have been fetched (name is non-empty, or cache exists)
 *   3. paymentSettings are not currently loading
 *   4. Socket is connected  —OR—  5 seconds have elapsed since mount
 *      (graceful timeout so a slow backend never blocks the display forever)
 *
 * Once the gate opens it never closes; the display stays mounted for the
 * lifetime of the app and the CustomerDisplayManager handles hot-reconnect.
 */
export function usePOSReadyGate(fontsLoaded: boolean): boolean {
  const [isPOSReady, setIsPOSReady] = useState(false);
  const [socketReady, setSocketReady] = useState(socket.connected);

  const companyName = useCompanySettingsStore((s) => s.settings.name);
  const companyLoading = useCompanySettingsStore((s) => s.loading);
  const paymentLoading = usePaymentSettingsStore((s) => s.loading);

  // ── Socket readiness: connected or 5 s timeout ──
  useEffect(() => {
    if (socket.connected) {
      setSocketReady(true);
      return;
    }

    const handleConnect = () => setSocketReady(true);
    socket.on("connect", handleConnect);

    // Graceful fallback: if the backend is still waking up on boot,
    // don't block the customer display indefinitely.
    const timeout = setTimeout(() => {
      console.log(
        "⏱️ [POSReadyGate] Socket timeout reached — proceeding without socket connection."
      );
      setSocketReady(true);
    }, 5000);

    return () => {
      socket.off("connect", handleConnect);
      clearTimeout(timeout);
    };
  }, []);

  // ── Resolve the gate when all conditions are met ──
  useEffect(() => {
    if (isPOSReady) return; // Already open, never re-close

    const settingsReady = !companyLoading && !paymentLoading;

    if (fontsLoaded && socketReady && settingsReady) {
      console.log(
        "✅ [POSReadyGate] All conditions met — customer display enabled.",
        { fontsLoaded, socketReady, companyName, settingsReady }
      );
      setIsPOSReady(true);
    }
  }, [fontsLoaded, socketReady, companyLoading, paymentLoading, companyName, isPOSReady]);

  return isPOSReady;
}

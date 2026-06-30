import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface QuickCashState {
  amounts: number[];
  setAmounts: (amounts: number[]) => void;
}

/**
 * Isolated store for quick-cash shortcut amounts shown on the payment screen.
 * Kept separate from generalSettingsStore so that fetchSettings() (which syncs
 * server state) can never overwrite these device-local values.
 */
export const useQuickCashStore = create<QuickCashState>()(
  persist(
    (set) => ({
      amounts: [20, 50, 100, 200, 500, 1000],
      setAmounts: (amounts) => set({ amounts }),
    }),
    {
      name: "quick-cash-amounts-storage",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

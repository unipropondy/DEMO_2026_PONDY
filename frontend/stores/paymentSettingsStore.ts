import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL } from "../constants/Config";

interface PaymentSettings {
  upiId: string | null;
  payNowQrUrl: string | null;
  shopName: string;
  customerSideDisplay: boolean;
}

// Full shape returned by the merged /api/sales/payment-methods endpoint
export interface CachedPaymentMethod {
  payMode: string;
  description: string;
  position: number;
  active: any;
  commission: number;
  serviceCharge: number;
  isEntertainment: boolean;
  isVoucher: boolean;
  yeahPayEnabled: boolean;
  deviceSn: string | null;
  deviceSalt: string | null;
}

interface PaymentSettingsState {
  settings: PaymentSettings;
  loading: boolean;
  // 🚀 CACHED: Payment methods fetched once at startup, reused on every payment screen open
  paymentMethods: CachedPaymentMethod[];
  hasLoadedMethods: boolean;
  fetchSettings: () => Promise<void>;
  fetchPaymentMethods: () => Promise<void>;
  updateSettings: (newSettings: Partial<PaymentSettings>) => void;
}

export const usePaymentSettingsStore = create<PaymentSettingsState>()(
  persist(
    (set, get) => ({
      settings: {
        upiId: null,
        payNowQrUrl: null,
        shopName: "My Restaurant",
        customerSideDisplay: true,
      },
      loading: false,
      paymentMethods: [],
      hasLoadedMethods: false,

      fetchSettings: async () => {
        set({ loading: true });
        try {
          const response = await fetch(`${API_URL}/api/settings`);
          const data = await response.json();
          if (data) {
            set({
              settings: {
                upiId: data.UPI_ID || null,
                payNowQrUrl: data.PayNow_QR_Url || null,
                shopName: data.ShopName || "My Restaurant",
                customerSideDisplay:
                  data.CustomerSideDisplay !== undefined
                    ? Boolean(data.CustomerSideDisplay)
                    : true,
              },
            });
          }
        } catch (error) {
          if (__DEV__) console.error("❌ [PaymentSettingsStore] Fetch Error:", error);
        } finally {
          set({ loading: false });
        }
      },

      // 🚀 CACHED: Fetch all payment methods with full details in one call.
      // Called once at startup (in _layout.tsx). Payment screen reads from cache.
      fetchPaymentMethods: async () => {
        try {
          const res = await fetch(`${API_URL}/api/sales/payment-methods`);
          if (!res.ok) return;
          const data: any[] = await res.json();
          const mapped: CachedPaymentMethod[] = data.map((d) => ({
            payMode: d.payMode || "",
            description: d.description || d.payMode || "",
            position: d.Position || 0,
            active: d.active,
            commission: parseFloat(d.commission) || 0,
            serviceCharge: parseFloat(d.serviceCharge) || 0,
            isEntertainment: d.isEntertainment === 1 || d.isEntertainment === true,
            isVoucher: d.isVoucher === 1 || d.isVoucher === true,
            yeahPayEnabled: d.YeahPayEnabled === 1 || d.YeahPayEnabled === true,
            deviceSn: d.DeviceSN || null,
            deviceSalt: d.DeviceSalt || null,
          }));
          set({ paymentMethods: mapped, hasLoadedMethods: true });
        } catch (error) {
          if (__DEV__) console.error("❌ [PaymentSettingsStore] fetchPaymentMethods Error:", error);
        }
      },

      updateSettings: (newSettings) => {
        set((state) => ({
          settings: { ...state.settings, ...newSettings },
        }));
      },
    }),
    {
      name: "payment-settings-storage",
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist the settings and cached methods — not the loading flag
      partialize: (state) => ({
        settings: state.settings,
        paymentMethods: state.paymentMethods,
        hasLoadedMethods: state.hasLoadedMethods,
      }),
    }
  )
);

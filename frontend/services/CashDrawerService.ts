import ThermalPrinter from 'react-native-thermal-printer';
import { API_URL } from '../constants/Config';
import { useAuthStore } from '../stores/authStore';

export type DrawerActionType =
  | 'SALE' | 'CASH_IN' | 'CASH_OUT'
  | 'OPENING_FLOAT' | 'DRAWER_CHECK'
  | 'OTHER';

export interface CashDrawerLogPayload {
  outletId: number;
  terminalCode: string;
  actionType: DrawerActionType;
  amount?: number;
  tenderedAmount?: number;
  changeAmount?: number;
  orderId?: string | null;
  reason?: string | null;
  remark?: string | null;
  openedByUserId: string;
  approvedByUserId?: string | null;
  openSource: 'SALE' | 'MANUAL';
}

export default class CashDrawerService {
  static async getCashierPrinterIp(): Promise<string> {
    try {
      const res = await fetch(`${API_URL}/api/settings/kitchen-printers`);
      const printers = await res.json();
      if (Array.isArray(printers)) {
        const cashier = printers.find((p: any) => p.PrinterType === 1);
        return cashier?.PrinterPath?.trim() || '';
      }
    } catch (e) {
      console.warn('[CashDrawer] Failed to fetch printer IP:', e);
    }
    return '';
  }

  static async openCashDrawer(printerIp: string): Promise<boolean> {
    if (!printerIp || printerIp.trim() === '') {
      console.warn('[CashDrawer] No printer IP configured');
      return false;
    }
    try {
      // RJ11 command via TCP
      await ThermalPrinter.printTcp({
        ip: printerIp.trim(),
        port: 9100,
        payload: '\x1B\x70\x00\x19\x19',
        openCashbox: true,
        mmFeedPaper: 0,
        autoCut: false,
      });
      console.log(`✅ [CashDrawer] Open command successfully pulsed to ${printerIp}`);
      return true;
    } catch (e) {
      console.error('[CashDrawer] Open command pulse failed:', e);
      return false;
    }
  }

  static async saveLog(payload: CashDrawerLogPayload, isSuccess: boolean): Promise<void> {
    try {
      const token = useAuthStore.getState().token;
      await fetch(`${API_URL}/api/cash-drawer/log`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ...payload, isSuccess }),
      });
    } catch (e) {
      console.warn('[CashDrawer] Failed to store activity log:', e);
    }
  }

  static async openAndLog(
    payload: CashDrawerLogPayload,
    printerIpOverride?: string
  ): Promise<boolean> {
    const ip = printerIpOverride || await this.getCashierPrinterIp();
    const success = await this.openCashDrawer(ip);
    await this.saveLog(payload, success);
    return success;
  }
}

export interface BridgeConfig {
  storeId: string;
  bridgeToken: string;
  apiUrl: string;
  pollIntervalMs: number;
  port: number;
}

export interface PrintJob {
  JobId: string;
  StoreId: string;
  PrinterName?: string;
  PrinterIp: string;
  PrinterPort: number;
  Content: string; // Plain ESC/POS or base64
  Status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  Attempts: number;
}

export interface HealthStatus {
  connected: boolean;
  lastPoll?: string;
  jobsProcessed: number;
}

import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { BridgeConfig } from './types';
import { logger } from './logger';

const CONFIG_FILENAME = 'config.json';

const execDir = path.dirname(process.execPath);
const execConfigPath = path.join(execDir, CONFIG_FILENAME);
const localConfigPath = path.join(process.cwd(), CONFIG_FILENAME);

let appPath = '';
try {
  if (app) {
    appPath = app.getAppPath();
  }
} catch (e) {
  // app might not be initialized or available in dev/testing contexts
}

const packageConfigPath = appPath ? path.join(appPath, CONFIG_FILENAME) : '';
let finalConfigPath = '';

if (fs.existsSync(execConfigPath)) {
  finalConfigPath = execConfigPath;
} else if (fs.existsSync(localConfigPath)) {
  finalConfigPath = localConfigPath;
} else if (packageConfigPath && fs.existsSync(packageConfigPath)) {
  finalConfigPath = packageConfigPath;
} else {
  finalConfigPath = localConfigPath;
}

const defaultConfig: BridgeConfig = {
  storeId: 'STORE_001',
  bridgeToken: 'unipro-pos-bridge-token-2026',
  pollIntervalMs: 2000,
  port: 3050,
  backends: [
    {
      name: 'Default',
      url: 'https://demo2026pondy-production.up.railway.app',
      enabled: true
    }
  ]
};

function loadConfig(): BridgeConfig {
  if (!fs.existsSync(finalConfigPath)) {
    logger.warn(`Could not find config.json in any path. Using built-in defaults.`);
    return defaultConfig;
  }

  try {
    const raw = fs.readFileSync(finalConfigPath, 'utf8');
    const parsed = JSON.parse(raw) as BridgeConfig;

    // Backward compatibility conversion:
    if (!parsed.backends || !Array.isArray(parsed.backends)) {
      const url = parsed.apiUrl || parsed.backendUrl || 'https://demo2026pondy-production.up.railway.app';
      parsed.backends = [
        {
          name: 'Default',
          url: url,
          enabled: true
        }
      ];
      logger.info(`Conversions: Mapped legacy URL configuration into multi-backends.`);
    }

    logger.info(`Loaded configurations successfully from: ${finalConfigPath}`);
    return parsed;
  } catch (err: any) {
    logger.error(`Error reading config.json: ${err.message}. Using built-in defaults.`);
    return defaultConfig;
  }
}

export function saveConfig(newConfig: BridgeConfig): boolean {
  try {
    // Ensure all backends are correctly formatted
    const cleanBackends = (newConfig.backends || []).map(b => ({
      name: b.name || 'Unnamed',
      url: b.url || '',
      enabled: b.enabled !== false
    }));

    const toSave: BridgeConfig = {
      storeId: newConfig.storeId,
      bridgeToken: newConfig.bridgeToken,
      pollIntervalMs: newConfig.pollIntervalMs || 2000,
      port: newConfig.port || 3050,
      backends: cleanBackends,
      customerDisplay: newConfig.customerDisplay
    };

    fs.writeFileSync(finalConfigPath, JSON.stringify(toSave, null, 2), 'utf8');
    logger.info(`Saved config.json successfully to: ${finalConfigPath}`);
    
    // Dynamically update the exported configuration object fields in memory
    Object.assign(config, toSave);
    return true;
  } catch (err: any) {
    logger.error(`Error saving config.json: ${err.message}`);
    return false;
  }
}

export const config = loadConfig();

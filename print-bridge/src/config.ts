import * as fs from 'fs';
import * as path from 'path';
import { BridgeConfig } from './types';
import { logger } from './logger';

const CONFIG_FILENAME = 'config.json';

function loadConfig(): BridgeConfig {
  // Check the executable folder (for pkg binary package) and fallback to project root
  const execDir = path.dirname(process.execPath);
  const execConfigPath = path.join(execDir, CONFIG_FILENAME);
  const localConfigPath = path.join(process.cwd(), CONFIG_FILENAME);

  let finalConfigPath = localConfigPath;

  if (fs.existsSync(execConfigPath)) {
    finalConfigPath = execConfigPath;
  } else if (!fs.existsSync(localConfigPath)) {
    logger.warn(`Could not find config.json. Generating a default one at ${localConfigPath}`);
    const defaultConfig: BridgeConfig = {
      storeId: 'STORE_001',
      bridgeToken: 'unipro-pos-bridge-token-2026',
      apiUrl: 'https://demo2026pondy-production.up.railway.app',
      pollIntervalMs: 2000,
      port: 3050
    };
    fs.writeFileSync(localConfigPath, JSON.stringify(defaultConfig, null, 2));
  }

  try {
    const raw = fs.readFileSync(finalConfigPath, 'utf8');
    const parsed = JSON.parse(raw) as BridgeConfig;
    logger.info(`Loaded configurations successfully from: ${finalConfigPath}`);
    return parsed;
  } catch (err: any) {
    logger.error(`Error reading config.json: ${err.message}. Using built-in defaults.`);
    return {
      storeId: 'STORE_001',
      bridgeToken: 'unipro-pos-bridge-token-2026',
      apiUrl: 'https://demo2026pondy-production.up.railway.app',
      pollIntervalMs: 2000,
      port: 3050
    };
  }
}

export const config = loadConfig();

import * as fs from 'fs';
import * as path from 'path';

const logDir = path.join(process.cwd(), 'logs');
const logFile = path.join(logDir, 'app.log');

if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

export const logger = {
  info(message: string) {
    const log = `[INFO] [${new Date().toISOString()}] ${message}`;
    console.log(log);
    fs.appendFileSync(logFile, log + '\n');
  },
  error(message: string, error?: any) {
    const errorMsg = error ? ` - Error: ${error.message || error}` : '';
    const log = `[ERROR] [${new Date().toISOString()}] ${message}${errorMsg}`;
    console.error(log);
    fs.appendFileSync(logFile, log + '\n');
  },
  warn(message: string) {
    const log = `[WARN] [${new Date().toISOString()}] ${message}`;
    console.log(log);
    fs.appendFileSync(logFile, log + '\n');
  }
};

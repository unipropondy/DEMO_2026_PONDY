import * as net from 'net';
import { logger } from './logger';

/**
 * Sends a raw data payload to a LAN/Wi-Fi thermal printer using a TCP socket connection.
 * Supports both base64 binary encoding and standard UTF-8 string encoding.
 */
export function sendToPrinter(ip: string, port: number, content: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const client = new net.Socket();
    client.setTimeout(8000); // 8 seconds timeout

    let payload: Buffer;
    
    // Quick heuristic to check if content is base64 encoded binary
    const isBase64 = /^[A-Za-z0-9+/]+={0,2}$/.test(content.trim()) && (content.trim().length % 4 === 0);

    if (isBase64) {
      payload = Buffer.from(content.trim(), 'base64');
    } else {
      payload = Buffer.from(content, 'utf-8');
    }

    client.connect(port, ip, () => {
      logger.info(`Connected to printer ${ip}:${port}. Streaming ${payload.length} bytes...`);
      client.write(payload, () => {
        client.end();
        logger.info(`Data successfully sent to printer at ${ip}:${port}.`);
        resolve();
      });
    });

    client.on('error', (err: any) => {
      client.destroy();
      logger.error(`TCP Socket error on printer ${ip}:${port}`, err);
      reject(err);
    });

    client.on('timeout', () => {
      client.destroy();
      logger.error(`TCP Socket timeout connection to printer ${ip}:${port}`);
      reject(new Error('Connection to printer timed out'));
    });
  });
}

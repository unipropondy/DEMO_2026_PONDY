import express, { Request, Response } from 'express';
import { config } from './config';
import { startPoller, pollerStats } from './poller';
import { sendToPrinter } from './printer';
import { logger } from './logger';

const app = express();
app.use(express.json());

// 1. GET /health - Local health check of the print bridge
app.get('/health', (req: Request, res: Response) => {
  res.json(pollerStats.getHealth());
});

// 2. POST /test-print - Directly test a kitchen printer from the bridge machine
app.post('/test-print', async (req: Request, res: Response) => {
  const { ip, port } = req.body;
  const targetPort = parseInt(port as string) || 9100;

  if (!ip) {
    return res.status(400).json({ success: false, error: 'Missing printer IP address' });
  }

  // Basic ESC/POS sequence to test printing
  const testContent = 
    '\x1B\x40' +                      // Initialize printer
    '\x1B\x61\x01' +                  // Center alignment
    'UniPro Print Bridge Test\n' +
    '------------------------\n' +
    `Time: ${new Date().toLocaleString()}\n` +
    `Printer IP: ${ip}\n` +
    `Port: ${targetPort}\n\n\n\n` +
    '\x1D\x56\x41\x00';                // Paper cut command

  try {
    logger.info(`Manual test print initiated for printer: ${ip}:${targetPort}`);
    await sendToPrinter(ip, targetPort, testContent);
    res.json({ success: true, message: `Test receipt sent to printer at ${ip}:${targetPort}` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Printing failed' });
  }
});

// 3. POST /direct-test-print - Test simple text payload without formatting
app.post('/direct-test-print', async (req: Request, res: Response) => {
  const { ip, port } = req.body;
  const targetPort = parseInt(port as string) || 9100;

  if (!ip) {
    return res.status(400).json({ success: false, error: 'Missing printer IP address' });
  }

  const testContent = 'HELLO FROM PRINT BRIDGE\n\n\n';

  try {
    logger.info(`Direct simple test print initiated for printer: ${ip}:${targetPort}`);
    await sendToPrinter(ip, targetPort, testContent);
    res.json({ success: true, message: `Direct text sent to printer at ${ip}:${targetPort}` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Printing failed' });
  }
});

// Start express server and launch the print poller
app.listen(config.port, () => {
  logger.info(`UniPro Print Bridge server listening locally on port ${config.port}`);
  
  // Begin polling Railway for print jobs
  startPoller();
});

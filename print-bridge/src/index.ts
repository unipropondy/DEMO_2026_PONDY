import { app as electronApp } from 'electron';
import express, { Request, Response } from 'express';
import cors from 'cors';
import * as path from 'path';
import { config } from './config';
import { startPoller, pollerStats } from './poller';
import { sendToPrinter } from './printer';
import { logger } from './logger';
import {
  startMonitorWatcher,
  monitorEvents,
  getSecondaryDisplay,
} from './customerDisplay/MonitorService';
import {
  launchCustomerDisplay,
  closeCustomerDisplay,
  pushStateToDisplay,
} from './customerDisplay/CustomerDisplayManager';
import { loadPersistedState, getCurrentState } from './customerDisplay/DisplayStateStore';
import displayRouter from './customerDisplay/displayRoutes';

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Enable CORS globally with support for credentials (which doesn't allow '*')
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like curl, postman, or mobile apps)
    if (!origin) return callback(null, true);
    
    // Dynamically allow any HTTP/HTTPS origin (localhost, local IP, or Cloudflare Workers POS domain)
    callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
}));

// Handle preflight OPTIONS requests globally before routes
app.options('*', cors());

// Request single-instance lock
const gotTheLock = electronApp.requestSingleInstanceLock();
if (!gotTheLock) {
  logger.warn('[Electron] Another instance of UniPro Print Bridge is already running. Exiting...');
  electronApp.quit();
  process.exit(0);
}

// 1. GET /health - Local health check of the print bridge
app.get('/health', (req: Request, res: Response) => {
  res.json(pollerStats.getHealth());
});

// 1.1 GET /api/config - Retrieve current print bridge configuration
app.get('/api/config', (req: Request, res: Response) => {
  res.json(config);
});

// 1.2 POST /api/config - Save configuration to config.json
app.post('/api/config', (req: Request, res: Response) => {
  const { saveConfig } = require('./config');
  const success = saveConfig(req.body);
  if (success) {
    res.json({ success: true, message: 'Configuration saved successfully' });
  } else {
    res.status(500).json({ success: false, error: 'Failed to write configuration file' });
  }
});

// 1.3 GET /settings - Configuration interface for backends
app.get('/settings', (req: Request, res: Response) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>UniPro Print Bridge Settings</title>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-color: #0B0F19;
      --card-bg: #151C2C;
      --text-primary: #F3F4F6;
      --text-secondary: #9CA3AF;
      --border-color: #1F2937;
      --primary: #F97316;
      --primary-hover: #EA580C;
      --success: #10B981;
      --danger: #EF4444;
      --warning: #F59E0B;
    }
    body {
      font-family: 'Outfit', sans-serif;
      background-color: var(--bg-color);
      color: var(--text-primary);
      margin: 0;
      padding: 0;
    }
    header {
      background-color: var(--card-bg);
      border-bottom: 1px solid var(--border-color);
      padding: 20px 40px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 700;
      color: var(--primary);
    }
    .container {
      max-width: 1000px;
      margin: 40px auto;
      padding: 0 20px;
    }
    .card {
      background-color: var(--card-bg);
      border: 1px solid var(--border-color);
      border-radius: 16px;
      padding: 30px;
      margin-bottom: 30px;
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06);
    }
    .card h2 {
      margin-top: 0;
      margin-bottom: 20px;
      font-size: 20px;
      font-weight: 600;
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 10px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .backend-list {
      display: grid;
      grid-template-columns: 1fr;
      gap: 20px;
    }
    .backend-item {
      background: rgba(255,255,255,0.02);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      transition: all 0.2s ease;
    }
    .backend-item:hover {
      border-color: var(--primary);
      box-shadow: 0 0 10px rgba(249, 115, 22, 0.1);
    }
    .backend-info {
      display: flex;
      flex-direction: column;
      gap: 6px;
      flex: 1;
    }
    .backend-name-row {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .backend-name {
      font-size: 18px;
      font-weight: 600;
    }
    .backend-url {
      color: var(--text-secondary);
      font-size: 14px;
      word-break: break-all;
    }
    .backend-status-row {
      display: flex;
      flex-wrap: wrap;
      gap: 15px;
      margin-top: 8px;
      font-size: 13px;
    }
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 2px 8px;
      border-radius: 6px;
      font-weight: 500;
    }
    .status-badge.online {
      background: rgba(16, 185, 129, 0.1);
      color: var(--success);
    }
    .status-badge.offline {
      background: rgba(239, 68, 68, 0.1);
      color: var(--danger);
    }
    .status-badge.disabled {
      background: rgba(156, 163, 175, 0.1);
      color: var(--text-secondary);
    }
    .actions {
      display: flex;
      gap: 10px;
    }
    button {
      font-family: inherit;
      font-size: 14px;
      font-weight: 500;
      padding: 8px 16px;
      border-radius: 8px;
      cursor: pointer;
      border: none;
      transition: all 0.2s ease;
    }
    .btn-primary {
      background-color: var(--primary);
      color: white;
    }
    .btn-primary:hover {
      background-color: var(--primary-hover);
    }
    .btn-secondary {
      background-color: transparent;
      border: 1px solid var(--border-color);
      color: var(--text-primary);
    }
    .btn-secondary:hover {
      background-color: rgba(255,255,255,0.05);
    }
    .btn-danger {
      background-color: rgba(239, 68, 68, 0.1);
      color: var(--danger);
      border: 1px solid rgba(239, 68, 68, 0.2);
    }
    .btn-danger:hover {
      background-color: var(--danger);
      color: white;
    }
    .form-group {
      margin-bottom: 20px;
    }
    .form-group label {
      display: block;
      margin-bottom: 8px;
      font-weight: 500;
      color: var(--text-secondary);
    }
    input[type="text"], input[type="number"], select {
      width: 100%;
      box-sizing: border-box;
      padding: 12px;
      border-radius: 8px;
      border: 1px solid var(--border-color);
      background-color: rgba(0,0,0,0.2);
      color: white;
      font-family: inherit;
      font-size: 14px;
    }
    input[type="text"]:focus, input[type="number"]:focus, select:focus {
      outline: none;
      border-color: var(--primary);
    }
    .modal {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0,0,0,0.6);
      justify-content: center;
      align-items: center;
      z-index: 1000;
    }
    .modal-content {
      background-color: var(--card-bg);
      border: 1px solid var(--border-color);
      border-radius: 16px;
      padding: 30px;
      width: 100%;
      max-width: 500px;
      box-shadow: 0 10px 25px -5px rgba(0,0,0,0.3);
    }
    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 10px;
    }
    .modal-header h3 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
    }
    .modal-header .close-btn {
      background: none;
      border: none;
      color: var(--text-secondary);
      font-size: 20px;
      cursor: pointer;
    }
    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      margin-top: 20px;
    }
    .checkbox-group {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .checkbox-group input {
      width: 18px;
      height: 18px;
      accent-color: var(--primary);
    }
  </style>
</head>
<body>
  <header>
    <h1>UniPro Print Bridge</h1>
    <div style="font-size: 14px; color: var(--text-secondary);">Local Server Running</div>
  </header>

  <div class="container">
    <div class="card">
      <h2>
        <span>Configure Railway Backends</span>
        <button class="btn-primary" onclick="openAddModal()">+ Add Backend</button>
      </h2>
      <div id="backendsList" class="backend-list">
        <!-- Rendered dynamically -->
      </div>
    </div>

    <div class="card">
      <h2>General Configurations</h2>
      <form id="generalConfigForm" onsubmit="saveGeneralConfig(event)">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
          <div class="form-group">
            <label for="storeId">Store ID</label>
            <input type="text" id="storeId" required>
          </div>
          <div class="form-group">
            <label for="bridgeToken">Bridge Token</label>
            <input type="text" id="bridgeToken" required>
          </div>
          <div class="form-group">
            <label for="pollIntervalMs">Polling Interval (ms)</label>
            <input type="number" id="pollIntervalMs" min="500" max="60000" required>
          </div>
          <div class="form-group">
            <label for="port">Local Server Port</label>
            <input type="number" id="port" min="1024" max="65535" required>
          </div>
        </div>
        <button type="submit" class="btn-primary">Save Settings</button>
      </form>
    </div>
  </div>

  <!-- Backend Edit/Add Modal -->
  <div id="backendModal" class="modal">
    <div class="modal-content">
      <div class="modal-header">
        <h3 id="modalTitle">Add Backend</h3>
        <button class="close-btn" onclick="closeModal()">&times;</button>
      </div>
      <form id="backendForm" onsubmit="handleBackendSubmit(event)">
        <input type="hidden" id="editIndex">
        <div class="form-group">
          <label for="backendName">Backend Name</label>
          <input type="text" id="backendName" placeholder="e.g. RN POS" required>
        </div>
        <div class="form-group">
          <label for="backendUrl">Backend Server URL</label>
          <input type="text" id="backendUrl" placeholder="https://....up.railway.app" required>
        </div>
        <div class="form-group checkbox-group">
          <input type="checkbox" id="backendEnabled" checked>
          <label for="backendEnabled">Enable this backend</label>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn-secondary" onclick="closeModal()">Cancel</button>
          <button type="submit" class="btn-primary">Save</button>
        </div>
      </form>
    </div>
  </div>

  <script>
    let currentConfig = null;
    let healthData = null;

    async function loadData() {
      try {
        const [configRes, healthRes] = await Promise.all([
          fetch('/api/config'),
          fetch('/health')
        ]);
        
        currentConfig = await configRes.json();
        healthData = await healthRes.json();
        
        renderBackends();
        populateGeneralForm();
      } catch (err) {
        console.error('Error fetching data:', err);
      }
    }

    function populateGeneralForm() {
      document.getElementById('storeId').value = currentConfig.storeId;
      document.getElementById('bridgeToken').value = currentConfig.bridgeToken;
      document.getElementById('pollIntervalMs').value = currentConfig.pollIntervalMs;
      document.getElementById('port').value = currentConfig.port;
    }

    function renderBackends() {
      const listDiv = document.getElementById('backendsList');
      listDiv.innerHTML = '';
      
      const backends = currentConfig.backends || [];
      const healthBackends = healthData.backends || [];

      if (backends.length === 0) {
        listDiv.innerHTML = '<div style="color: var(--text-secondary); text-align: center; padding: 20px;">No backend servers configured. Click "+ Add Backend" to configure.</div>';
        return;
      }

      backends.forEach((backend, index) => {
        const health = healthBackends.find(h => h.url === backend.url) || {};
        const isEnabled = backend.enabled !== false;
        
        let statusText = 'Disabled';
        let statusClass = 'disabled';
        
        if (isEnabled) {
          if (health.connected) {
            statusText = 'Online';
            statusClass = 'online';
          } else {
            statusText = 'Offline';
            statusClass = 'offline';
          }
        }

        const heartbeatTime = health.lastHeartbeat ? new Date(health.lastHeartbeat).toLocaleTimeString() : 'N/A';
        const jobs = health.jobsProcessed || 0;

        const itemDiv = document.createElement('div');
        itemDiv.className = 'backend-item';
        itemDiv.innerHTML = \`
          <div class="backend-info">
            <div class="backend-name-row">
              <span class="backend-name">\${backend.name}</span>
              <span class="status-badge \${statusClass}">\${statusText}</span>
            </div>
            <div class="backend-url">\${backend.url}</div>
            <div class="backend-status-row">
              <span><strong>Auth Status:</strong> \${health.authenticated ? 'Authenticated' : 'Not Authenticated'}</span>
              <span><strong>Last Heartbeat:</strong> \${heartbeatTime}</span>
              <span><strong>Jobs Processed:</strong> \${jobs}</span>
            </div>
          </div>
          <div class="actions">
            <button class="btn-secondary" onclick="openEditModal(\${index})">Edit</button>
            <button class="btn-danger" onclick="deleteBackend(\${index})">Delete</button>
          </div>
        \`;
        listDiv.appendChild(itemDiv);
      });
    }

    function openAddModal() {
      document.getElementById('modalTitle').innerText = 'Add Backend';
      document.getElementById('editIndex').value = '';
      document.getElementById('backendName').value = '';
      document.getElementById('backendUrl').value = '';
      document.getElementById('backendEnabled').checked = true;
      document.getElementById('backendModal').style.display = 'flex';
    }

    function openEditModal(index) {
      const backend = currentConfig.backends[index];
      document.getElementById('modalTitle').innerText = 'Edit Backend';
      document.getElementById('editIndex').value = index;
      document.getElementById('backendName').value = backend.name;
      document.getElementById('backendUrl').value = backend.url;
      document.getElementById('backendEnabled').checked = backend.enabled !== false;
      document.getElementById('backendModal').style.display = 'flex';
    }

    function closeModal() {
      document.getElementById('backendModal').style.display = 'none';
    }

    async function handleBackendSubmit(e) {
      e.preventDefault();
      const indexStr = document.getElementById('editIndex').value;
      const name = document.getElementById('backendName').value;
      const url = document.getElementById('backendUrl').value;
      const enabled = document.getElementById('backendEnabled').checked;

      const backendData = { name, url, enabled };
      
      if (!currentConfig.backends) currentConfig.backends = [];
      
      if (indexStr === '') {
        currentConfig.backends.push(backendData);
      } else {
        const index = parseInt(indexStr);
        currentConfig.backends[index] = backendData;
      }

      await saveConfig();
      closeModal();
    }

    async function deleteBackend(index) {
      if (confirm('Are you sure you want to delete this backend server?')) {
        currentConfig.backends.splice(index, 1);
        await saveConfig();
      }
    }

    async function saveGeneralConfig(e) {
      e.preventDefault();
      currentConfig.storeId = document.getElementById('storeId').value;
      currentConfig.bridgeToken = document.getElementById('bridgeToken').value;
      currentConfig.pollIntervalMs = parseInt(document.getElementById('pollIntervalMs').value);
      currentConfig.port = parseInt(document.getElementById('port').value);
      
      await saveConfig();
      alert('General settings saved. You might need to restart the application if you modified the Local Server Port.');
    }

    async function saveConfig() {
      try {
        const res = await fetch('/api/config', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(currentConfig)
        });
        
        const result = await res.json();
        if (result.success) {
          await loadData();
        } else {
          alert('Error saving configuration: ' + result.error);
        }
      } catch (err) {
        alert('Failed to connect to Print Bridge server');
      }
    }

    // Initial load and periodic status polling
    loadData();
    setInterval(async () => {
      try {
        const healthRes = await fetch('/health');
        healthData = await healthRes.json();
        renderBackends();
      } catch (e) {}
    }, 3000);
  </script>
</body>
</html>
  `);
});

// 2. POST /test-print - Directly test a kitchen printer from the bridge machine
app.post('/test-print', async (req: Request, res: Response) => {
  const { ip, port } = req.body;
  const targetPort = parseInt(port as string) || 9100;

  if (!ip) {
    return res.status(400).json({ success: false, error: 'Missing printer IP address' });
  }

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
    await sendToPrinter(ip, targetPort, testContent, 'TEST-JOB');
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
    await sendToPrinter(ip, targetPort, testContent, 'TEST-JOB');
    res.json({ success: true, message: `Direct text sent to printer at ${ip}:${targetPort}` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Printing failed' });
  }
});

// Serve the static customer display files with extension-less HTML fallback
app.use(express.static(path.join(electronApp.getAppPath(), 'customer-display-web'), { extensions: ['html'] }));

// Mount new customer display endpoints
app.use('/customer-display', displayRouter);

// Initialize Electron Lifecycle
electronApp.whenReady().then(() => {
  logger.info('[Electron] Platform ready. Starting services...');

  // Launch the Express listener + poller first
  app.listen(config.port, () => {
    logger.info(`UniPro Print Bridge server listening locally on port ${config.port}`);
    startPoller();

    loadPersistedState();
    startMonitorWatcher();

    // If a secondary display is already plugged in on start, launch display
    if (getSecondaryDisplay()) {
      launchCustomerDisplay();
    }

    // Handle display changes (added/removed/metrics changes)
    monitorEvents.on('display-changed', () => {
      if (getSecondaryDisplay()) {
        launchCustomerDisplay();
        // Re-push the current state so the display isn't blank/stale after connecting
        setTimeout(() => {
          pushStateToDisplay(getCurrentState());
        }, 2000);
      } else {
        closeCustomerDisplay();
      }
    });
  });

  // Windows Startup Registry Configuration
  electronApp.setLoginItemSettings({
    openAtLogin: true,
    name: 'UniPro Print Bridge',
  });
});

// Avoid app shutdown when window closes (our tray/express server remains running)
electronApp.on('window-all-closed', (e: Event) => {
  e.preventDefault();
});

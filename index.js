const express = require('express');
const os = require('os');
const { Client, GatewayIntentBits, ActivityType } = require('discord.js');
const { keywords } = require('./message');

const app = express();
const PORT = process.env.PORT || 3000;
const TOKEN = process.env.DISCORD_TOKEN;

app.use(express.json());

// Botの状態管理
let client = null;
let isBotRunning = false;
let currentStatusText = 'から揚げを揚げています🍗';
let currentStatusType = 'Playing'; // Playing, Watching, Listening, Competing

// CPU使用率計算用（1秒ごとの差分取得）
let prevCpuInfo = os.cpus();
let currentCpuUsage = 0;

setInterval(() => {
  const currentCpuInfo = os.cpus();
  let idleDiff = 0;
  let totalDiff = 0;

  for (let i = 0; i < currentCpuInfo.length; i++) {
    const prevTimes = prevCpuInfo[i].times;
    const currTimes = currentCpuInfo[i].times;

    const prevTotal = Object.values(prevTimes).reduce((a, b) => a + b, 0);
    const currTotal = Object.values(currTimes).reduce((a, b) => a + b, 0);

    idleDiff += currTimes.idle - prevTimes.idle;
    totalDiff += currTotal - prevTotal;
  }

  prevCpuInfo = currentCpuInfo;
  if (totalDiff > 0) {
    currentCpuUsage = ((1 - idleDiff / totalDiff) * 100).toFixed(1);
  }
}, 1000);

// Botの起動関数
async function startBot() {
  if (isBotRunning || !TOKEN) return;

  client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent
    ]
  });

  client.once('ready', () => {
    console.log(`✅ ${client.user.tag} としてログインしました！`);
    isBotRunning = true;
    applyBotPresence();
  });

  client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const isMentioned = message.mentions.has(client.user);
    const hasTriggerWord = /からあげ|fromあげ|から揚げ|カラアゲ/.test(message.content);

    if (isMentioned || hasTriggerWord) {
      const randomReply = keywords[Math.floor(Math.random() * keywords.length)];
      await message.reply(randomReply);
    }
  });

  try {
    await client.login(TOKEN);
  } catch (err) {
    console.error('❌ Botのログインに失敗しました:', err);
    isBotRunning = false;
  }
}

// Botの停止関数
async function stopBot() {
  if (!isBotRunning || !client) return;
  await client.destroy();
  client = null;
  isBotRunning = false;
  console.log('🛑 Botを停止しました。');
}

// ステータス適用関数
function applyBotPresence() {
  if (!isBotRunning || !client || !client.user) return;

  const typeMap = {
    Playing: ActivityType.Playing,
    Watching: ActivityType.Watching,
    Listening: ActivityType.Listening,
    Competing: ActivityType.Competing
  };

  client.user.setActivity(currentStatusText, {
    type: typeMap[currentStatusType] || ActivityType.Playing
  });
}

// --- Web API & ルーティング ---

// Renderスリープ防止用の /ping エンドポイント
app.get('/ping', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'Pong! AIからあげくんは元気に稼働中です🍗',
    botRunning: isBotRunning,
    timestamp: new Date().toISOString()
  });
});

// 1秒更新用システム・Botステータス取得API
app.get('/api/stats', (req, res) => {
  const memUsage = process.memoryUsage();
  const rssMB = (memUsage.rss / 1024 / 1024).toFixed(1);
  const totalMemMB = (os.totalmem() / 1024 / 1024).toFixed(0);
  const ping = isBotRunning && client ? client.ws.ping : -1;

  res.json({
    isBotRunning,
    botTag: isBotRunning && client?.user ? client.user.tag : '停止中',
    cpu: currentCpuUsage,
    ramUsedMB: rssMB,
    ramTotalMB: totalMemMB,
    ping: ping >= 0 ? ping : 'N/A',
    uptime: Math.floor(process.uptime()),
    statusText: currentStatusText,
    statusType: currentStatusType
  });
});

// Botの開始・停止コントロールAPI
app.post('/api/control', async (req, res) => {
  const { action } = req.body;
  if (action === 'start') {
    await startBot();
    return res.json({ success: true, isBotRunning });
  } else if (action === 'stop') {
    await stopBot();
    return res.json({ success: true, isBotRunning });
  }
  res.status(400).json({ success: false, message: 'Invalid action' });
});

// ステータス更新API
app.post('/api/status', (req, res) => {
  const { text, type } = req.body;
  if (typeof text === 'string') currentStatusText = text;
  if (type) currentStatusType = type;

  applyBotPresence();
  res.json({ success: true, statusText: currentStatusText, statusType: currentStatusType });
});

// 管理パネルのHTMLを返すルート ("/")
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AIからあげくん 管理パネル</title>
  <style>
    :root {
      --bg: #12141a;
      --card: #1e212b;
      --accent: #f59e0b;
      --accent-hover: #d97706;
      --green: #10b981;
      --red: #ef4444;
      --text: #f3f4f6;
      --sub: #9ca3af;
    }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background-color: var(--bg);
      color: var(--text);
      margin: 0;
      padding: 20px;
      display: flex;
      justify-content: center;
    }
    .container {
      max-width: 700px;
      width: 100%;
    }
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      border-bottom: 1px solid #2d3240;
      padding-bottom: 15px;
    }
    h1 {
      margin: 0;
      font-size: 1.5rem;
      color: var(--accent);
    }
    .badge {
      padding: 6px 14px;
      border-radius: 999px;
      font-weight: bold;
      font-size: 0.85rem;
    }
    .badge.online { background: rgba(16, 185, 129, 0.2); color: var(--green); border: 1px solid var(--green); }
    .badge.offline { background: rgba(239, 68, 68, 0.2); color: var(--red); border: 1px solid var(--red); }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 15px;
      margin-bottom: 20px;
    }
    .stat-card {
      background: var(--card);
      padding: 18px;
      border-radius: 12px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.2);
    }
    .stat-label {
      font-size: 0.85rem;
      color: var(--sub);
      margin-bottom: 8px;
    }
    .stat-value {
      font-size: 1.6rem;
      font-weight: bold;
    }
    .panel {
      background: var(--card);
      padding: 20px;
      border-radius: 12px;
      margin-bottom: 20px;
    }
    .panel h2 {
      margin-top: 0;
      font-size: 1.1rem;
      margin-bottom: 15px;
      color: var(--text);
    }
    .btn-group {
      display: flex;
      gap: 12px;
    }
    button {
      padding: 10px 20px;
      border: none;
      border-radius: 8px;
      font-weight: bold;
      cursor: pointer;
      font-size: 0.95rem;
      transition: 0.2s;
    }
    .btn-start { background: var(--green); color: #fff; }
    .btn-start:hover { opacity: 0.85; }
    .btn-stop { background: var(--red); color: #fff; }
    .btn-stop:hover { opacity: 0.85; }
    .btn-update { background: var(--accent); color: #111; }
    .btn-update:hover { background: var(--accent-hover); }
    button:disabled { opacity: 0.4; cursor: not-allowed; }

    .form-row {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }
    select, input {
      background: #12141a;
      border: 1px solid #374151;
      color: var(--text);
      padding: 10px 12px;
      border-radius: 8px;
      font-size: 0.95rem;
    }
    input { flex: 1; min-width: 200px; }
    .footer-note {
      text-align: center;
      font-size: 0.8rem;
      color: var(--sub);
    }
    a { color: var(--accent); text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>🍗 AIからあげくん 管理パネル</h1>
      <span id="bot-badge" class="badge offline">読み込み中...</span>
    </header>

    <div class="grid">
      <div class="stat-card">
        <div class="stat-label">CPU 使用率</div>
        <div class="stat-value" id="cpu-val">-- %</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">RAM 使用量</div>
        <div class="stat-value" id="ram-val">-- MB</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Discord Ping</div>
        <div class="stat-value" id="ping-val">-- ms</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">サーバー稼働時間</div>
        <div class="stat-value" id="uptime-val">-- 秒</div>
      </div>
    </div>

    <div class="panel">
      <h2>⚡ Bot 電源コントロール (<span id="bot-tag">停止中</span>)</h2>
      <div class="btn-group">
        <button id="btn-start" class="btn-start" onclick="controlBot('start')">▶ Botを開始</button>
        <button id="btn-stop" class="btn-stop" onclick="controlBot('stop')">⏹ Botを停止</button>
      </div>
    </div>

    <div class="panel">
      <h2>🎮 アクティビティステータス更新</h2>
      <div class="form-row">
        <select id="status-type">
          <option value="Playing">プレイ中 (Playing)</option>
          <option value="Watching">視聴中 (Watching)</option>
          <option value="Listening">再生中 (Listening)</option>
          <option value="Competing">参戦中 (Competing)</option>
        </select>
        <input type="text" id="status-text" placeholder="例: カリカリに揚がってます🍗" />
        <button class="btn-update" onclick="updateStatus()">更新する</button>
      </div>
    </div>

    <div class="footer-note">
      1秒ごとに自動更新中 ｜ 死活監視エンドポイント: <a href="/ping" target="_blank">/ping</a>
    </div>
  </div>

  <script>
    let initializedForm = false;

    async function fetchStats() {
      try {
        const res = await fetch('/api/stats');
        const data = await res.json();

        document.getElementById('cpu-val').textContent = \`\${data.cpu} %\`;
        document.getElementById('ram-val').textContent = \`\${data.ramUsedMB} MB\`;
        document.getElementById('ping-val').textContent = data.ping === 'N/A' ? '停止中' : \`\${data.ping} ms\`;
        document.getElementById('uptime-val').textContent = \`\${data.uptime} 秒\`;
        document.getElementById('bot-tag').textContent = data.botTag;

        const badge = document.getElementById('bot-badge');
        const btnStart = document.getElementById('btn-start');
        const btnStop = document.getElementById('btn-stop');

        if (data.isBotRunning) {
          badge.textContent = '● 稼働中 (ONLINE)';
          badge.className = 'badge online';
          btnStart.disabled = true;
          btnStop.disabled = false;
        } else {
          badge.textContent = '● 停止中 (OFFLINE)';
          badge.className = 'badge offline';
          btnStart.disabled = false;
          btnStop.disabled = true;
        }

        if (!initializedForm) {
          document.getElementById('status-text').value = data.statusText;
          document.getElementById('status-type').value = data.statusType;
          initializedForm = true;
        }
      } catch (e) {
        console.error('ステータス取得エラー:', e);
      }
    }

    async function controlBot(action) {
      document.getElementById('btn-start').disabled = true;
      document.getElementById('btn-stop').disabled = true;
      await fetch('/api/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      setTimeout(fetchStats, 500);
    }

    async function updateStatus() {
      const text = document.getElementById('status-text').value;
      const type = document.getElementById('status-type').value;
      await fetch('/api/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, type })
      });
      alert('ステータスを更新しました！🍗');
    }

    fetchStats();
    setInterval(fetchStats, 1000);
  </script>
</body>
</html>`);
});

// サーバー起動 & 初回Bot起動
app.listen(PORT, () => {
  console.log(`🌐 管理パネル起動完了: http://localhost:${PORT}`);
  if (TOKEN) {
    startBot();
  } else {
    console.warn('⚠️ 環境変数 DISCORD_TOKEN が設定されていません。');
  }
});

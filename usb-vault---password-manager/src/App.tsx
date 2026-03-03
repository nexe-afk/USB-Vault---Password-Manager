import React from 'react';
import { Shield, Key, Terminal, FileCode, HardDrive, Lock, Unlock, Plus, Trash2, Copy, Check, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { encryptData, decryptData } from './lib/crypto';

interface VaultItem {
  id: number;
  site: string;
  username: string;
  encrypted_data: string;
}

export default function App() {
  const [isUsbConnected, setIsUsbConnected] = React.useState(true);
  const [masterPassword, setMasterPassword] = React.useState('');
  const [isUnlocked, setIsUnlocked] = React.useState(false);
  const [vault, setVault] = React.useState<VaultItem[]>([]);
  const [activeTab, setActiveTab] = React.useState<'vault' | 'code' | 'logs'>('vault');
  const [newEntry, setNewEntry] = React.useState({ site: '', username: '', password: '' });
  const [decryptedPasswords, setDecryptedPasswords] = React.useState<Record<number, string>>({});
  const [copiedId, setCopiedId] = React.useState<number | null>(null);
  const [systemLogs, setSystemLogs] = React.useState<{time: string, msg: string, type: 'info' | 'success' | 'error'}[]>([
    { time: '07:43:20', msg: '系统初始化：硬件抽象层已加载。', type: 'info' },
    { time: '07:43:21', msg: 'USB 轮询：在 /dev/usb0 检测到设备', type: 'info' },
    { time: '07:43:21', msg: '保险箱挂载：成功挂载 vault.db (AES-256-GCM)', type: 'success' },
  ]);

  const addLog = (msg: string, type: 'info' | 'success' | 'error' = 'info') => {
    const now = new Date();
    const time = now.toTimeString().split(' ')[0];
    setSystemLogs(prev => [...prev, { time, msg, type }].slice(-50));
  };

  const handleLock = React.useCallback(() => {
    setIsUnlocked(false);
    setMasterPassword('');
    setDecryptedPasswords({});
    addLog('会话已关闭：内存段已擦除，密钥已销毁。', 'info');
  }, []);

  // USB Simulation Logic
  React.useEffect(() => {
    if (!isUsbConnected && isUnlocked) {
      addLog('警告：检测到 USB 物理断开！启动紧急锁定程序...', 'error');
      handleLock();
    }
  }, [isUsbConnected, isUnlocked, handleLock]);

  React.useEffect(() => {
    fetchVault();
  }, []);

  const fetchVault = async () => {
    try {
      const res = await fetch('/api/vault');
      const data = await res.json();
      setVault(data);
    } catch (err) {
      console.error('Failed to fetch vault', err);
    }
  };

  const handleUnlock = () => {
    if (masterPassword.length >= 8) {
      setIsUnlocked(true);
      addLog('身份验证成功：主密钥已派生。', 'success');
    } else {
      addLog('身份验证失败：密码长度不足。', 'error');
    }
  };

  const handleAddEntry = async () => {
    if (!newEntry.site || !newEntry.username || !newEntry.password) return;

    try {
      const encrypted = await encryptData(newEntry.password, masterPassword);
      const res = await fetch('/api/vault', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          site: newEntry.site,
          username: newEntry.username,
          encrypted_data: encrypted
        })
      });
      if (res.ok) {
        setNewEntry({ site: '', username: '', password: '' });
        addLog(`记录已添加：${newEntry.site}`, 'success');
        fetchVault();
      }
    } catch (err) {
      addLog('加密失败：无法写入存储。', 'error');
      alert('加密失败');
    }
  };

  const handleDelete = async (id: number) => {
    await fetch(`/api/vault/${id}`, { method: 'DELETE' });
    fetchVault();
  };

  const handleReveal = async (item: VaultItem) => {
    if (decryptedPasswords[item.id]) {
      const newDecrypted = { ...decryptedPasswords };
      delete newDecrypted[item.id];
      setDecryptedPasswords(newDecrypted);
      addLog(`记录已隐藏：${item.site}`, 'info');
      return;
    }

    try {
      const pass = await decryptData(item.encrypted_data, masterPassword);
      setDecryptedPasswords({ ...decryptedPasswords, [item.id]: pass });
      addLog(`记录已解密：${item.site}`, 'success');
    } catch (err) {
      addLog(`解密失败：${item.site} (密钥不匹配)`, 'error');
      alert('解密失败，请检查主密码是否正确');
    }
  };

  const copyToClipboard = (text: string, id: number) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col items-center">
      {/* Header / Status Bar */}
      <header className="w-full max-w-5xl flex justify-between items-center mb-8 px-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/10 rounded-lg">
            <Shield className="w-6 h-6 text-emerald-500" />
          </div>
          <div>
            <h1 className="text-xl font-mono font-bold tracking-tighter uppercase">USB 密码保险箱 v1.0</h1>
            <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">基于硬件的安全层</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className={`status-dot ${isUsbConnected ? 'status-dot-active' : 'status-dot-inactive'}`} />
            <span className="text-[10px] font-mono uppercase text-zinc-400">USB 加密狗: {isUsbConnected ? '已检测' : '未检测'}</span>
          </div>
          <div className="h-4 w-[1px] bg-zinc-800" />
          <div className="flex items-center gap-2">
            <div className={`status-dot ${isUnlocked ? 'status-dot-active' : 'status-dot-inactive'}`} />
            <span className="text-[10px] font-mono uppercase text-zinc-400">保险箱: {isUnlocked ? '已解锁' : '已锁定'}</span>
          </div>
        </div>
      </header>

      <main className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Sidebar / Controls */}
        <div className="lg:col-span-4 space-y-6">
          {/* Master Lock Card */}
          <section className="hardware-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <Key className="w-4 h-4 text-zinc-400" />
              <h2 className="text-xs font-mono uppercase tracking-wider text-zinc-400">主身份验证</h2>
            </div>
            
            {!isUnlocked ? (
              <div className="space-y-4">
                <input
                  type="password"
                  placeholder="输入主密码"
                  className="w-full tech-input"
                  value={masterPassword}
                  onChange={(e) => setMasterPassword(e.target.value)}
                />
                <button 
                  onClick={handleUnlock}
                  className="w-full tech-button tech-button-primary flex items-center justify-center gap-2"
                >
                  <Lock className="w-3 h-3" />
                  初始化解密
                </button>
                <p className="text-[9px] text-zinc-500 font-mono leading-relaxed">
                  * PBKDF2 密钥派生 (10 万次迭代)<br />
                  * AES-256-GCM 硬件加速
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded flex items-center gap-3">
                  <Unlock className="w-4 h-4 text-emerald-500" />
                  <span className="text-xs font-mono text-emerald-500 uppercase">会话已激活</span>
                </div>
                <button 
                  onClick={handleLock}
                  className="w-full tech-button"
                >
                  清除内存并锁定
                </button>
              </div>
            )}
          </section>

          {/* Hardware Simulation Card */}
          <section className="hardware-card p-6 border-zinc-800/50">
            <div className="flex items-center gap-2 mb-4">
              <HardDrive className="w-4 h-4 text-zinc-400" />
              <h2 className="text-xs font-mono uppercase tracking-wider text-zinc-400">硬件模拟控制</h2>
            </div>
            <div className="space-y-3">
              <p className="text-[9px] text-zinc-500 font-mono leading-relaxed uppercase">
                用于测试物理断开时的安全响应逻辑
              </p>
              <button 
                onClick={() => {
                  const newState = !isUsbConnected;
                  setIsUsbConnected(newState);
                  addLog(newState ? '硬件模拟：USB 已插入' : '硬件模拟：USB 已拔出', newState ? 'success' : 'error');
                }}
                className={`w-full tech-button ${isUsbConnected ? 'hover:bg-red-500/10 hover:text-red-500' : 'tech-button-primary'}`}
              >
                {isUsbConnected ? '模拟拔出 USB' : '模拟插入 USB'}
              </button>
            </div>
          </section>

          {/* Navigation */}
          <nav className="hardware-card">
            <button 
              onClick={() => setActiveTab('vault')}
              className={`w-full flex items-center gap-3 p-4 text-xs font-mono uppercase tracking-widest border-b border-zinc-800 hover:bg-white/5 transition-colors ${activeTab === 'vault' ? 'bg-white/5 text-emerald-500' : 'text-zinc-400'}`}
            >
              <HardDrive className="w-4 h-4" />
              保险箱管理器
            </button>
            <button 
              onClick={() => setActiveTab('code')}
              className={`w-full flex items-center gap-3 p-4 text-xs font-mono uppercase tracking-widest border-b border-zinc-800 hover:bg-white/5 transition-colors ${activeTab === 'code' ? 'bg-white/5 text-emerald-500' : 'text-zinc-400'}`}
            >
              <FileCode className="w-4 h-4" />
              扩展工具包
            </button>
            <button 
              onClick={() => setActiveTab('logs')}
              className={`w-full flex items-center gap-3 p-4 text-xs font-mono uppercase tracking-widest hover:bg-white/5 transition-colors ${activeTab === 'logs' ? 'bg-white/5 text-emerald-500' : 'text-zinc-400'}`}
            >
              <Terminal className="w-4 h-4" />
              系统日志
            </button>
          </nav>
        </div>

        {/* Content Area */}
        <div className="lg:col-span-8">
          <AnimatePresence mode="wait">
            {activeTab === 'vault' && (
              <motion.div
                key="vault"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {/* Add Entry Card */}
                {isUnlocked && (
                  <section className="hardware-card p-6 border-emerald-500/20">
                    <div className="flex items-center gap-2 mb-4">
                      <Plus className="w-4 h-4 text-emerald-500" />
                      <h2 className="text-xs font-mono uppercase tracking-wider text-emerald-500">添加新的安全记录</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <input 
                        placeholder="网站 / 服务" 
                        className="tech-input" 
                        value={newEntry.site}
                        onChange={e => setNewEntry({...newEntry, site: e.target.value})}
                      />
                      <input 
                        placeholder="用户名" 
                        className="tech-input" 
                        value={newEntry.username}
                        onChange={e => setNewEntry({...newEntry, username: e.target.value})}
                      />
                      <input 
                        type="password" 
                        placeholder="密码" 
                        className="tech-input" 
                        value={newEntry.password}
                        onChange={e => setNewEntry({...newEntry, password: e.target.value})}
                      />
                    </div>
                    <button 
                      onClick={handleAddEntry}
                      className="mt-4 tech-button tech-button-primary w-full md:w-auto"
                    >
                      保存至 USB 保险箱
                    </button>
                  </section>
                )}

                {/* Vault List */}
                <div className="hardware-card">
                  <div className="p-4 border-b border-zinc-800 bg-black/20 flex justify-between items-center">
                    <span className="text-[10px] font-mono uppercase text-zinc-500">加密存储索引</span>
                    <span className="text-[10px] font-mono uppercase text-zinc-500">{vault.length} 条记录</span>
                  </div>
                  
                  <div className="divide-y divide-zinc-800">
                    {vault.length === 0 ? (
                      <div className="p-12 text-center">
                        <Lock className="w-8 h-8 text-zinc-800 mx-auto mb-4" />
                        <p className="text-xs font-mono text-zinc-600 uppercase">当前挂载点无记录</p>
                      </div>
                    ) : (
                      vault.map((item) => (
                        <div key={item.id} className="p-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors group">
                          <div className="flex items-center gap-4">
                            <div className="w-8 h-8 rounded bg-zinc-900 flex items-center justify-center border border-zinc-800">
                              <span className="text-xs font-mono text-zinc-500">{item.site[0].toUpperCase()}</span>
                            </div>
                            <div>
                              <h3 className="text-sm font-mono font-bold text-zinc-200">{item.site}</h3>
                              <p className="text-[10px] font-mono text-zinc-500">{item.username}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {isUnlocked ? (
                              <>
                                {decryptedPasswords[item.id] ? (
                                  <div className="flex items-center gap-2 bg-black/40 px-2 py-1 rounded border border-zinc-800">
                                    <span className="text-xs font-mono text-emerald-500">{decryptedPasswords[item.id]}</span>
                                    <button 
                                      onClick={() => copyToClipboard(decryptedPasswords[item.id], item.id)}
                                      className="p-1 hover:text-emerald-400 text-zinc-500"
                                    >
                                      {copiedId === item.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-[10px] font-mono text-zinc-600 italic">••••••••</span>
                                )}
                                <button 
                                  onClick={() => {
                                    addLog(`自动填充模拟：正在寻找 ${item.site} 的表单字段...`, 'info');
                                    setTimeout(() => addLog(`自动填充成功：已填充用户 ${item.username}`, 'success'), 1000);
                                  }}
                                  className="p-2 text-zinc-600 hover:text-emerald-500 transition-colors"
                                  title="模拟自动填充"
                                >
                                  <ExternalLink className="w-4 h-4" />
                                </button>
                                <button 
                                  onClick={() => handleReveal(item)}
                                  className="tech-button py-1 px-2"
                                >
                                  {decryptedPasswords[item.id] ? '隐藏' : '解密'}
                                </button>
                                <button 
                                  onClick={() => handleDelete(item.id)}
                                  className="p-2 text-zinc-600 hover:text-red-500 transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            ) : (
                              <div className="flex items-center gap-2">
                                <Lock className="w-3 h-3 text-zinc-700" />
                                <span className="text-[10px] font-mono text-zinc-700 uppercase">已加密</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'code' && (
              <motion.div
                key="code"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <section className="hardware-card">
                  <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
                    <h2 className="text-xs font-mono uppercase tracking-wider text-zinc-400">内容脚本 (content.js)</h2>
                  </div>
                  <div className="p-4 bg-black/40 overflow-x-auto">
                    <pre className="text-[11px] font-mono text-zinc-400 leading-relaxed">
{`// 监听 DOM 变化或页面加载
function findAndFill() {
    const passField = document.querySelector('input[type="password"]');
    if (!passField) return;

    // 向后台请求当前域名的凭据
    chrome.runtime.sendMessage({
        action: "GET_CREDENTIALS",
        url: window.location.origin
    }, (response) => {
        if (response && response.success) {
            const userField = document.querySelector('input[type="text"], input[type="email"]');
            if (userField) userField.value = response.username;
            passField.value = response.password;
            console.log("USB Vault: 自动填充成功");
        }
    });
}

// 页面加载完成后执行
window.addEventListener('load', findAndFill);`}
                    </pre>
                  </div>
                </section>

                <section className="hardware-card">
                  <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
                    <h2 className="text-xs font-mono uppercase tracking-wider text-zinc-400">后台脚本 (background.js)</h2>
                  </div>
                  <div className="p-4 bg-black/40 overflow-x-auto">
                    <pre className="text-[11px] font-mono text-zinc-400 leading-relaxed">
{`// 监听来自内容脚本的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "GET_CREDENTIALS") {
        // 通过 Native Messaging 与 Python 宿主通信
        chrome.runtime.sendNativeMessage('com.usb.vault', {
            action: "GET_PASSWORD",
            url: request.url
        }, (response) => {
            if (chrome.runtime.lastError) {
                console.error(chrome.runtime.lastError);
                sendResponse({ success: false });
            } else {
                sendResponse({ 
                    success: true, 
                    username: response.user, 
                    password: response.pass 
                });
            }
        });
        return true; // 保持通道开启以进行异步响应
    }
});`}
                    </pre>
                  </div>
                </section>

                <section className="hardware-card">
                  <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
                    <h2 className="text-xs font-mono uppercase tracking-wider text-zinc-400">Native Messaging 宿主程序 (Python)</h2>
                    <button className="text-[10px] font-mono text-emerald-500 hover:underline">下载 .py</button>
                  </div>
                  <div className="p-4 bg-black/40 overflow-x-auto">
                    <pre className="text-[11px] font-mono text-zinc-400 leading-relaxed">
{`import sys, json, struct, os
from cryptography.fernet import Fernet

USB_PATH = "E:/" # Dynamic detection recommended
VAULT_FILE = os.path.join(USB_PATH, "vault.db")

def get_message():
    raw_length = sys.stdin.buffer.read(4)
    if not raw_length: return None
    message_length = struct.unpack('@I', raw_length)[0]
    message = sys.stdin.buffer.read(message_length).decode('utf-8')
    return json.loads(message)

def send_message(message):
    content = json.dumps(message).encode('utf-8')
    sys.stdout.buffer.write(struct.pack('@I', len(content)))
    sys.stdout.buffer.write(content)
    sys.stdout.buffer.flush()

# Main Loop
while True:
    msg = get_message()
    if msg and msg.get("action") == "GET_PASSWORD":
        # Implementation logic...
        send_message({"action": "FILL_DATA", "user": "admin", "pass": "******"})`}
                    </pre>
                  </div>
                </section>

                <section className="hardware-card">
                  <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
                    <h2 className="text-xs font-mono uppercase tracking-wider text-zinc-400">Manifest V3 配置</h2>
                  </div>
                  <div className="p-4 bg-black/40">
                    <pre className="text-[11px] font-mono text-zinc-400">
{`{
  "manifest_version": 3,
  "name": "USB Vault Bridge",
  "version": "1.0",
  "permissions": ["nativeMessaging", "tabs"],
  "background": { "service_worker": "background.js" },
  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["content.js"]
  }]
}`}
                    </pre>
                  </div>
                </section>
              </motion.div>
            )}

            {activeTab === 'logs' && (
              <motion.div
                key="logs"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="hardware-card h-[500px] flex flex-col"
              >
                <div className="p-4 border-b border-zinc-800 bg-black/20">
                  <h2 className="text-xs font-mono uppercase tracking-wider text-zinc-400">内核调试控制台</h2>
                </div>
                <div className="flex-1 p-4 font-mono text-[10px] space-y-1 overflow-y-auto bg-black/40">
                  {systemLogs.map((log, i) => (
                    <p key={i} className={log.type === 'success' ? 'text-emerald-500' : log.type === 'error' ? 'text-red-500' : 'text-zinc-500'}>
                      [{log.time}] {log.msg}
                    </p>
                  ))}
                  <div className="text-zinc-700 animate-pulse">_</div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      <footer className="mt-auto py-8 text-center">
        <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-[0.2em]">
          零知识架构 • 无云端同步 • 需物理访问
        </p>
      </footer>
    </div>
  );
}

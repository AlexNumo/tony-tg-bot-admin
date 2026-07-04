import React, { useState, useMemo, useEffect, FormEvent } from 'react';
import { motion } from 'motion/react';
import { 
  Users, CreditCard, Clock, Search, ShieldAlert, Plus, Edit3, Trash2, 
  Check, Play, ArrowUpRight, TrendingUp, Filter, RefreshCw, Database,
  Terminal, ShieldCheck, Copy, CheckSquare, Info, AlertTriangle, MessageSquare, Phone, Send
} from 'lucide-react';
import { User, UserStatus } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, PieChart, Pie, Cell, Legend 
} from 'recharts';

interface CRMDashboardProps {
  userStatus: UserStatus;
  setUserStatus: (status: UserStatus) => void;
  currentDay: number;
  setCurrentDay: (day: number) => void;
  onSwitchToSimulator?: () => void;
}

export default function CRMDashboard({
  userStatus,
  setUserStatus,
  currentDay,
  setCurrentDay,
  onSwitchToSimulator
}: CRMDashboardProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [testResults, setTestResults] = useState<any[]>([]);
  const [supabaseStatus, setSupabaseStatus] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSqlGuide, setShowSqlGuide] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newTelegramId, setNewTelegramId] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newStatus, setNewStatus] = useState<UserStatus>('free');
  const [copiedSql, setCopiedSql] = useState(false);

  // Chat/Direct Communication state
  const [activeChatUser, setActiveChatUser] = useState<User | null>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [newChatMessage, setNewChatMessage] = useState('');
  const [loadingChat, setLoadingChat] = useState(false);

  const fetchChatMessages = async (telegramId: string) => {
    try {
      const res = await fetch(`/api/messages/${telegramId}`);
      const data = await res.json();
      if (data.success) {
        setChatMessages(data.data);
      }
    } catch (err) {
      console.error('Помилка завантаження діалогу:', err);
    }
  };

  const handleSendChatMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeChatUser || !newChatMessage.trim()) return;

    const textToSend = newChatMessage.trim();
    setNewChatMessage('');

    // Append optimistically
    setChatMessages(prev => [...prev, {
      id: Math.random().toString(),
      sender: 'bot',
      text: textToSend,
      timestamp: new Date().toISOString()
    }]);

    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramId: activeChatUser.telegramId,
          text: textToSend
        })
      });
      const resData = await res.json();
      if (!resData.success) {
        console.error(`Помилка відправки: ${resData.error || 'Невідома помилка'}`);
      }
      fetchChatMessages(activeChatUser.telegramId);
    } catch (err: any) {
      console.error(`Помилка з'єднання: ${err.message}`);
    }
  };

  useEffect(() => {
    if (!activeChatUser) return;
    fetchChatMessages(activeChatUser.telegramId);
    const interval = setInterval(() => {
      fetchChatMessages(activeChatUser.telegramId);
    }, 4000);
    return () => clearInterval(interval);
  }, [activeChatUser]);

  // Custom Confirmation Modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    type: 'danger' | 'warning' | 'info';
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    type: 'info'
  });

  // Real broadcast logs and scheduler configuration
  const [broadcastHour, setBroadcastHour] = useState<number>(11);
  const [broadcastMinute, setBroadcastMinute] = useState<number>(0);
  const [targetAudience, setTargetAudience] = useState<string>('paid');
  const [configSaving, setConfigSaving] = useState<boolean>(false);
  const [configMessage, setConfigMessage] = useState<string>('');
  const [broadcastLogs, setBroadcastLogs] = useState<any[]>([]);

  // Cron automation logs simulation
  const [cronLogs, setCronLogs] = useState<string[]>([
    "[09:00:00] ⏳ Запуск щоденного планувальника розсилок (course_broadcast)...",
    "[09:00:02] ✅ Надіслано День 7 для @olena_koval (Пакет VIP). Встановлено наступний день: 8",
    "[09:00:03] ✅ Надіслано День 4 для @mariya_shvets (Пакет Супровід). Встановлено наступний день: 5",
    "[09:00:04] ✅ Надіслано День 2 для @kateryna_p (Пакет Базовий). Встановлено наступний день: 3",
    "[09:00:05] ✅ Надіслано День 3 для @natalia_k (Пакет Базовий). Встановлено наступний день: 4",
    "[09:00:06] ℹ️ Користувачів з безкоштовним доступом пропущено. Надіслано нагадування про оплату.",
    "[09:00:07] 🎉 Щоденна розсилка успішно завершена."
  ]);

  const fetchBroadcastConfig = async () => {
    try {
      const res = await fetch('/api/broadcast/config');
      const data = await res.json();
      if (data.success && data.data) {
        setBroadcastHour(data.data.broadcastHour ?? 11);
        setBroadcastMinute(data.data.broadcastMinute ?? 0);
        setTargetAudience(data.data.targetAudience ?? 'paid');
      }
    } catch (err) {
      console.error('Помилка завантаження конфігурації планувальника:', err);
    }
  };

  const fetchBroadcastLogs = async () => {
    try {
      const res = await fetch('/api/broadcast/logs');
      const data = await res.json();
      if (data.success && data.data) {
        setBroadcastLogs(data.data);
      }
    } catch (err) {
      console.error('Помилка завантаження логів розсилки:', err);
    }
  };

  const handleSaveBroadcastConfig = async () => {
    setConfigSaving(true);
    setConfigMessage('');
    try {
      const res = await fetch('/api/broadcast/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          broadcastHour,
          broadcastMinute,
          targetAudience
        })
      });
      const data = await res.json();
      if (data.success) {
        setConfigMessage('✅ Збережено');
        setTimeout(() => setConfigMessage(''), 2000);
      } else {
        setConfigMessage('❌ Помилка');
      }
    } catch (err) {
      setConfigMessage('❌ Помилка');
      console.error('Помилка збереження конфігурації планувальника:', err);
    } finally {
      setConfigSaving(false);
    }
  };

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // Fetch users from backend (connected to real Supabase)
      const usersRes = await fetch('/api/users');
      const usersData = await usersRes.json();
      if (usersData.success) {
        setUsers(usersData.data);
      }

      // Fetch test results
      try {
        const testRes = await fetch('/api/test-results');
        const testData = await testRes.json();
        if (testData.success) {
          setTestResults(testData.data);
        }
      } catch (err) {
        console.error("Помилка завантаження тестів з API:", err);
      }

      // Fetch Supabase status & active tables check
      const statusRes = await fetch('/api/supabase-status');
      const statusData = await statusRes.json();
      setSupabaseStatus(statusData);

      // Fetch broadcast scheduler config & logs
      await fetchBroadcastConfig();
      await fetchBroadcastLogs();
    } catch (err) {
      console.error("Помилка завантаження даних CRM з бекенду:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const triggerCronSimulation = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/broadcast/trigger', {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        await fetchBroadcastLogs();
        await fetchDashboardData();
      }
    } catch (err) {
      console.error('Помилка запуску розсилки:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async (e: FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newTelegramId.trim()) return;

    const formattedUsername = newUsername.trim().startsWith('@') ? newUsername.trim() : `@${newUsername.trim()}`;
    const cleanId = newTelegramId.trim();

    try {
      // 1. Save user to backend (Supabase)
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramId: cleanId,
          username: formattedUsername,
          phone: newPhone.trim() || null,
          status: newStatus,
          currentDay: 1
        })
      });

      const resData = await res.json();

      if (resData.success) {
        // 2. If paid user, also register a success payment lead
        if (newStatus !== 'free') {
          await fetch('/api/leads', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              telegramId: cleanId,
              packageName: newStatus,
              status: 'success'
            })
          });
        }
        
        setNewUsername('');
        setNewTelegramId('');
        setNewPhone('');
        setNewStatus('free');
        setShowAddModal(false);
        fetchDashboardData(); // Reload users
      } else {
        alert(`Помилка створення користувача: ${resData.error || 'Невідома помилка'}`);
      }
    } catch (err: any) {
      alert(`Помилка підключення до API: ${err.message}`);
    }
  };

  const handleDeleteRequest = (u: User) => {
    setConfirmModal({
      isOpen: true,
      title: 'Видалення користувача 🛑',
      message: `Ви впевнені, що хочете видалити користувача ${u.username} (ID: ${u.telegramId})? Цю дію видалить всі записи про нього у базі даних, і її неможливо буде скасувати!`,
      type: 'danger',
      onConfirm: () => {
        handleDeleteUser(u.telegramId);
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleStatusChangeRequest = (u: User, nextStatus: UserStatus) => {
    setConfirmModal({
      isOpen: true,
      title: 'Зміна тарифу доступу 🔐',
      message: `Ви впевнені, що хочете змінити статус доступу для користувача ${u.username} з ${u.status.toUpperCase()} на ${nextStatus.toUpperCase()}? Це оновить доступи користувача у реальному часі.`,
      type: 'warning',
      onConfirm: () => {
        changeUserStatus(u.telegramId, nextStatus);
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleDeleteUser = async (telegramId: string) => {
    try {
      const res = await fetch(`/api/users/${telegramId}`, {
        method: 'DELETE'
      });
      const resData = await res.json();
      if (resData.success) {
        fetchDashboardData();
      } else {
        alert(`Помилка видалення: ${resData.error}`);
      }
    } catch (err: any) {
      alert(`Помилка з'єднання: ${err.message}`);
    }
  };

  const changeUserStatus = async (telegramId: string, nextStatus: UserStatus) => {
    try {
      const res = await fetch(`/api/users/${telegramId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus })
      });
      const resData = await res.json();
      if (resData.success) {
        // Also register purchase event on lead if upgraded to paid
        if (nextStatus !== 'free') {
          await fetch('/api/leads', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              telegramId,
              packageName: nextStatus,
              status: 'success'
            })
          });
        }
        fetchDashboardData();
      } else {
        alert(`Помилка оновлення статусу: ${resData.error}`);
      }
    } catch (err: any) {
      alert(`Помилка з'єднання: ${err.message}`);
    }
  };

  const changeUserDay = async (telegramId: string, nextDay: number) => {
    try {
      const res = await fetch(`/api/users/${telegramId}/current-day`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentDay: nextDay })
      });
      const resData = await res.json();
      if (resData.success) {
        fetchDashboardData();
      } else {
        alert(`Помилка оновлення прогресу: ${resData.error}`);
      }
    } catch (err: any) {
      alert(`Помилка з'єднання: ${err.message}`);
    }
  };

  const toggleUserStatus = async (telegramId: string, currentStatus: UserStatus) => {
    const statusSequence: UserStatus[] = ['free', 'base', 'support', 'vip'];
    const currIdx = statusSequence.indexOf(currentStatus);
    const nextStatus = statusSequence[(currIdx + 1) % statusSequence.length];
    changeUserStatus(telegramId, nextStatus);
  };

  const incrementUserDay = async (telegramId: string, currentDayNum: number) => {
    const nextDay = currentDayNum >= 8 ? 1 : currentDayNum + 1;
    changeUserDay(telegramId, nextDay);
  };

  // Recharts conversions calculation
  const packageData = useMemo(() => {
    const counts = { free: 0, base: 0, support: 0, vip: 0 };
    users.forEach(u => {
      counts[u.status] = (counts[u.status] || 0) + 1;
    });

    return [
      { name: 'Free', value: counts.free, color: '#f43f5e' },
      { name: 'Base (20€)', value: counts.base, color: '#f59e0b' },
      { name: 'Support (125€)', value: counts.support, color: '#06b6d4' },
      { name: 'VIP (400€)', value: counts.vip, color: '#a855f7' }
    ];
  }, [users]);

  const salesRevenue = useMemo(() => {
    let total = 0;
    users.forEach(u => {
      if (u.status === 'base') total += 20;
      if (u.status === 'support') total += 125;
      if (u.status === 'vip') total += 400;
    });
    return total;
  }, [users]);

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchesSearch = u.username.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            u.telegramId.includes(searchQuery);
      const matchesFilter = statusFilter === 'all' || u.status === statusFilter;
      return matchesSearch && matchesFilter;
    });
  }, [users, searchQuery, statusFilter]);

  const sqlSchemaCode = `-- 1. Створення таблиці користувачів (users)
CREATE TABLE IF NOT EXISTS users (
    user_id bigint PRIMARY KEY,
    username text,
    phone text, -- Номер телефону в міжнародному форматі (напр. +380991234567)
    status text DEFAULT 'free',
    current_day integer DEFAULT 1,
    join_date timestamptz DEFAULT timezone('utc'::text, now()),
    last_active text
);

-- 2. Створення таблиці тарифних планів (packages)
CREATE TABLE IF NOT EXISTS packages (
    id text PRIMARY KEY,
    name text,
    tag text,
    desc_text text,
    price text,
    old_price text,
    features text
);

-- 3. Створення таблиці лідів/оплат (leads)
CREATE TABLE IF NOT EXISTS leads (
    id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    user_id bigint,
    package_name text,
    status text DEFAULT 'pending',
    created_at timestamptz DEFAULT timezone('utc'::text, now())
);

-- 4. Створення таблиці результатів тесту (test_results)
CREATE TABLE IF NOT EXISTS test_results (
    id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    user_id bigint,
    score integer,
    created_at timestamptz DEFAULT timezone('utc'::text, now())
);

-- 5. Створення таблиці повідомлень (messages) для двостороннього чату
CREATE TABLE IF NOT EXISTS messages (
    id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    user_id bigint,
    direction text, -- 'user' (від користувача) або 'bot' (від Антоніни)
    text text,
    created_at timestamptz DEFAULT timezone('utc'::text, now())
);
);`;

  const handleCopySql = () => {
    navigator.clipboard.writeText(sqlSchemaCode);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  return (
    <div id="crm-dashboard-root" className="space-y-6 overflow-y-auto max-h-[calc(100vh-140px)] pr-2">
      
      {/* Supabase Status Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            supabaseStatus?.connected 
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
          }`}>
            <Database className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display font-semibold text-sm text-white">Статус підключення бази даних</h3>
              <span className={`inline-block w-2.5 h-2.5 rounded-full ${supabaseStatus?.connected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {supabaseStatus?.connected 
                ? `Успішно підключено до Supabase (${supabaseStatus.url}). Працюємо з реальною БД.` 
                : 'Помилка завантаження Supabase. Використовується локальне резервне сховище.'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowSqlGuide(!showSqlGuide)}
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border border-slate-700"
          >
            <Terminal className="w-3.5 h-3.5 text-sky-400" />
            <span>Інструкція SQL</span>
          </button>
          <button
            onClick={fetchDashboardData}
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border border-slate-700"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Оновити БД</span>
          </button>
        </div>
      </div>

      {/* SQL Setup Helper Section */}
      {showSqlGuide && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-4"
        >
          <div className="flex items-center justify-between border-b border-slate-850 pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <div>
                <h4 className="text-sm font-bold text-white">Створення таблиць у Supabase SQL Editor</h4>
                <p className="text-[10px] text-slate-400">Скопіюйте цей скрипт та запустіть у кабінеті Supabase, щоб налаштувати правильну структуру.</p>
              </div>
            </div>
            <button
              onClick={handleCopySql}
              className="bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              {copiedSql ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{copiedSql ? 'Скопійовано!' : 'Копіювати SQL'}</span>
            </button>
          </div>
          <div className="bg-slate-900 rounded-lg p-4 font-mono text-xs text-slate-300 overflow-x-auto max-h-60">
            <pre>{sqlSchemaCode}</pre>
          </div>
          <p className="text-[11px] text-slate-400 flex items-start gap-1.5">
            <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
            <span>Для інтеграції достатньо зайти в меню <b>SQL Editor</b> у лівій панелі вашого Supabase кабінету, обрати <b>New Query</b>, вставити вищеописаний скрипт і натиснути кнопку <b>Run</b>. Після цього реєстрація, оплата та відправка занять будуть записуватися в реальному часі.</span>
          </p>
        </motion.div>
      )}

      {/* Top statistics widgets */}
      <div id="crm-stats-grid" className="grid grid-cols-1 md:grid-cols-4 gap-4">
        
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex items-center justify-between">
          <div>
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider block">Загальна виручка</span>
            <span className="text-2xl font-bold font-display text-white mt-1">{salesRevenue.toLocaleString('de-DE')} €</span>
            <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-semibold mt-1">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Сума успішних оплат</span>
            </div>
          </div>
          <div className="w-11 h-11 bg-emerald-500/10 text-emerald-400 rounded-lg flex items-center justify-center border border-emerald-500/20">
            <CreditCard className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex items-center justify-between">
          <div>
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider block">Охоплення лідів</span>
            <span className="text-2xl font-bold font-display text-white mt-1">{users.length} користувачів</span>
            <span className="text-[10px] text-slate-500 block mt-1">
              Джерело: {supabaseStatus?.source === 'database' ? 'Реальна БД Supabase' : 'Локальна пам’ять (Резервна)'}
            </span>
          </div>
          <div className="w-11 h-11 bg-sky-500/10 text-sky-400 rounded-lg flex items-center justify-center border border-sky-500/20">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex items-center justify-between">
          <div>
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider block">Конверсія продажів</span>
            <span className="text-2xl font-bold font-display text-white mt-1">
              {users.length > 0 ? ((users.filter(u => u.status !== 'free').length / users.length) * 100).toFixed(0) : 0}%
            </span>
            <span className="text-[10px] text-amber-400 font-semibold block mt-1">Студентів курсу: {users.filter(u => u.status !== 'free').length}</span>
          </div>
          <div className="w-11 h-11 bg-amber-500/10 text-amber-400 rounded-lg flex items-center justify-center border border-amber-500/20">
            <ArrowUpRight className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex items-center justify-between">
          <div>
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider block">Поточний етап курсу</span>
            <span className="text-2xl font-bold font-display text-white mt-1">День {currentDay}/8</span>
            <span className="text-[10px] text-purple-400 font-semibold block mt-1">Захист контенту: АКТИВОВАНО</span>
          </div>
          <div className="w-11 h-11 bg-purple-500/10 text-purple-400 rounded-lg flex items-center justify-center border border-purple-500/20">
            <Clock className="w-5 h-5" />
          </div>
        </div>

      </div>

      {/* Main CRM Workspace (Database and Charts) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* User database table */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <h3 className="font-display font-semibold text-base text-white">Реєстр підписників курсу</h3>
              <p className="text-xs text-slate-400">Перевірка статусів підписки та керування прогресом занять у реальному часі.</p>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-sky-500 hover:bg-sky-600 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all self-start"
            >
              <Plus className="w-4 h-4" />
              Додати користувача
            </button>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Пошук за юзернеймом чи Telegram ID..."
                className="w-full bg-slate-950 text-xs text-slate-300 rounded-lg pl-9 pr-4 py-2 border border-slate-800 focus:outline-none focus:border-slate-755 font-sans"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              <select 
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-950 text-xs text-slate-300 rounded-lg px-3 py-2 border border-slate-800 focus:outline-none focus:border-slate-700"
              >
                <option value="all">Усі статуси</option>
                <option value="free">Безкоштовні (Free)</option>
                <option value="base">Базовий (Base)</option>
                <option value="support">Супровід (Support)</option>
                <option value="vip">VIP Супровід</option>
              </select>
            </div>
          </div>

          {/* Database Table */}
          {loading ? (
            <div className="py-20 text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-sky-400" />
              <span>Зчитування бази даних з Supabase...</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="p-3 rounded-l-lg">Користувач / TG ID</th>
                    <th className="p-3">Телефон</th>
                    <th className="p-3">Реєстрація</th>
                    <th className="p-3">Статус доступу</th>
                    <th className="p-3">Прогрес курсу</th>
                    <th className="p-3 text-right rounded-r-lg font-semibold">Дії</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-4 text-center text-slate-500 italic">Користувачів не знайдено в базі даних</td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-850/40 transition-colors">
                        <td className="p-3 font-medium">
                          <div className="text-white font-mono">{u.username}</div>
                          <div className="text-[10px] text-slate-500 font-mono mt-0.5">ID: {u.telegramId}</div>
                        </td>
                        <td className="p-3 text-slate-300 font-mono">
                          {u.phone ? (
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3 text-slate-500 shrink-0" />
                              {u.phone}
                            </span>
                          ) : (
                            <span className="text-slate-600 text-[10px] italic">Очікує /start</span>
                          )}
                        </td>
                        <td className="p-3 text-slate-400">{u.joinDate}</td>
                        <td className="p-3">
                          <select
                            value={u.status}
                            onChange={(e) => handleStatusChangeRequest(u, e.target.value as UserStatus)}
                            className={`px-2 py-1 rounded text-[10px] font-semibold bg-slate-950 border focus:outline-none cursor-pointer ${
                              u.status === 'free' 
                                ? 'text-rose-400 border-rose-500/20' 
                                : u.status === 'base' 
                                ? 'text-amber-400 border-amber-500/20' 
                                : u.status === 'support' 
                                ? 'text-cyan-400 border-cyan-500/20' 
                                : 'text-purple-400 border-purple-500/20'
                            }`}
                          >
                            <option value="free" className="text-rose-400 bg-slate-950">FREE (Безкоштовно)</option>
                            <option value="base" className="text-amber-400 bg-slate-950">BASE (Базовий)</option>
                            <option value="support" className="text-cyan-400 bg-slate-950">SUPPORT (Супровід)</option>
                            <option value="vip" className="text-purple-400 bg-slate-950">VIP (Індивідуально)</option>
                          </select>
                        </td>
                        <td className="p-3">
                          {u.status === 'free' ? (
                            <span className="text-slate-500 italic">Закрито (Free)</span>
                          ) : (
                            <select
                              value={u.currentDay}
                              onChange={(e) => changeUserDay(u.telegramId, parseInt(e.target.value))}
                              className="bg-slate-950 text-[10px] font-semibold text-slate-300 rounded px-2 py-1 border border-slate-800 focus:outline-none cursor-pointer"
                            >
                              {[1, 2, 3, 4, 5, 6, 7, 8].map(d => (
                                <option key={d} value={d} className="bg-slate-950 text-slate-300">День {d}</option>
                              ))}
                            </select>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-2.5">
                            <button 
                              onClick={() => setActiveChatUser(u)}
                              className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 hover:border-emerald-500/30 text-[10px] font-semibold px-2 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1 shrink-0"
                              title="Надіслати повідомлення / Діалог"
                            >
                              <MessageSquare className="w-3 h-3" />
                              Діалог
                            </button>
                            <button 
                              onClick={() => {
                                setUserStatus(u.status);
                                setCurrentDay(u.currentDay);
                                if (onSwitchToSimulator) {
                                  onSwitchToSimulator();
                                }
                              }}
                              className="bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/20 hover:border-sky-500/30 text-[10px] font-semibold px-2 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1 shrink-0"
                              title="Тестувати в симуляторі"
                            >
                              <Play className="w-3 h-3" />
                              Тест
                            </button>
                            <button 
                              onClick={() => handleDeleteRequest(u)}
                              className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 hover:border-rose-500/30 text-[10px] font-semibold px-2 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1 shrink-0"
                              title="Видалити користувача з бази"
                            >
                              <Trash2 className="w-3 h-3" />
                              Видалити
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Analytics charts panel */}
        <div className="space-y-6">
          
          {/* Pie Chart of subscriptions */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="font-display font-semibold text-base text-white">Тарифи учасників</h3>
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={packageData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={75}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {packageData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#fff', fontSize: 11 }} 
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-850">
              {packageData.map((p, idx) => (
                <div key={idx} className="flex items-center gap-1.5 text-[11px] text-slate-300">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                  <span className="truncate">{p.name}: {p.value} чол.</span>
                </div>
              ))}
            </div>
          </div>

          {/* APScheduler Background Task Monitoring */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-500 animate-pulse" />
                <h3 className="font-display font-semibold text-base text-white">Робота планувальника</h3>
              </div>
              <button 
                onClick={triggerCronSimulation}
                className="bg-sky-500 hover:bg-sky-600 text-white text-[10px] px-2.5 py-1.5 rounded border border-sky-400/20 transition-all font-semibold flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                Запустити розсилку
              </button>
            </div>
            
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Автоматичне щоденне надсилання матеріалів занять та практикуму користувачам відповідно до налаштованого розкладу.
            </p>

            {/* Config Box */}
            <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-850 space-y-3">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Налаштування розкладу</div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[9px] text-slate-500 block mb-0.5">Година</label>
                  <select
                    value={broadcastHour}
                    onChange={(e) => setBroadcastHour(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-1.5 py-1 text-[11px] text-white font-mono font-sans"
                  >
                    {Array.from({ length: 24 }).map((_, h) => (
                      <option key={h} value={h} className="font-sans">{String(h).padStart(2, '0')}:00</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[9px] text-slate-500 block mb-0.5">Хвилина</label>
                  <select
                    value={broadcastMinute}
                    onChange={(e) => setBroadcastMinute(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-1.5 py-1 text-[11px] text-white font-mono font-sans"
                  >
                    {Array.from({ length: 60 }).map((_, m) => (
                      <option key={m} value={m} className="font-sans">{String(m).padStart(2, '0')} хв</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[9px] text-slate-500 block mb-0.5">Кому</label>
                  <select
                    value={targetAudience}
                    onChange={(e) => setTargetAudience(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-1.5 py-1 text-[11px] text-white font-sans"
                  >
                    <option value="all" className="font-sans">Усі</option>
                    <option value="paid" className="font-sans">Оплачені</option>
                    <option value="unpaid" className="font-sans">Не оплачені</option>
                    <option value="free" className="font-sans">Безкоштовний</option>
                    <option value="base" className="font-sans">Базовий</option>
                    <option value="support" className="font-sans">Супровід</option>
                    <option value="vip" className="font-sans">ВІП</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[10px] text-emerald-400 font-medium">{configMessage}</span>
                <button
                  type="button"
                  onClick={handleSaveBroadcastConfig}
                  disabled={configSaving}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] px-3 py-1 rounded transition-all cursor-pointer font-semibold border border-slate-700 font-sans"
                >
                  {configSaving ? 'Збереження...' : 'Зберегти розклад'}
                </button>
              </div>
            </div>

            {/* Console Log Output */}
            <div className="space-y-1.5">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">Поточний лог виконання</div>
              <div className="bg-slate-950 rounded-xl p-3 border border-slate-850 h-36 overflow-y-auto font-mono text-[9px] text-slate-300 space-y-2">
                {broadcastLogs.length > 0 && broadcastLogs[0].details ? (
                  broadcastLogs[0].details.map((logLine: string, idx: number) => {
                    let colorClass = 'text-slate-400';
                    if (logLine.includes('✅') || logLine.includes('успішно')) colorClass = 'text-emerald-400';
                    if (logLine.includes('⏳') || logLine.includes('Планувальник')) colorClass = 'text-amber-400';
                    if (logLine.includes('🎓')) colorClass = 'text-sky-400';
                    if (logLine.includes('🔒') || logLine.includes('❌')) colorClass = 'text-rose-400';
                    return (
                      <div key={idx} className={colorClass}>
                        {logLine}
                      </div>
                    );
                  })
                ) : (
                  cronLogs.map((log, idx) => {
                    let colorClass = 'text-slate-400';
                    if (log.includes('✅')) colorClass = 'text-emerald-400';
                    if (log.includes('⏳') || log.includes('Планувальник')) colorClass = 'text-amber-400';
                    if (log.includes('🎓')) colorClass = 'text-sky-400';
                    if (log.includes('🔒')) colorClass = 'text-rose-400';
                    return (
                      <div key={idx} className={colorClass}>
                        {log}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* History logs block */}
            {broadcastLogs.length > 1 && (
              <div className="space-y-1.5 pt-1">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">Історія розсилок</div>
                <div className="space-y-1 max-h-24 overflow-y-auto text-[10px] font-sans">
                  {broadcastLogs.slice(1, 5).map((blog: any, bidx: number) => (
                    <div key={bidx} className="flex justify-between items-center p-1.5 bg-slate-950/40 rounded border border-slate-900">
                      <span className="text-slate-400 font-mono">
                        {new Date(blog.timestamp).toLocaleString('uk-UA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="text-slate-300">
                        {blog.trigger === 'auto' ? 'Авто' : 'Вручну'} • Надіслано: <strong className="text-emerald-400">{blog.sentCount}</strong>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Test Results list from Diagnostic (7 signs) */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-1.5">
              <CheckSquare className="w-4 h-4 text-emerald-400" />
              <h3 className="font-display font-semibold text-base text-white">Результати діагностики</h3>
            </div>
            <p className="text-xs text-slate-400">
              Показники пройдених тестів «7 ознак» у Telegram-боті (бали від 0 до 7).
            </p>

            <div className="overflow-hidden rounded-xl border border-slate-850 bg-slate-950">
              <div className="max-h-40 overflow-y-auto">
                <table className="w-full text-left text-[11px] font-sans">
                  <thead className="bg-slate-900 text-slate-400 uppercase text-[9px] tracking-wider sticky top-0">
                    <tr>
                      <th className="p-2">User ID</th>
                      <th className="p-2 text-center">Бали</th>
                      <th className="p-2 text-right">Дата</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850 text-slate-300">
                    {testResults.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="p-3 text-center text-slate-500 italic">Результатів ще немає</td>
                      </tr>
                    ) : (
                      testResults.slice(0, 10).map((r, idx) => {
                        // Find matching username in user list if possible
                        const matchUser = users.find(u => u.telegramId === String(r.user_id));
                        const nameLabel = matchUser ? matchUser.username : `ID: ${r.user_id}`;
                        
                        return (
                          <tr key={idx} className="hover:bg-slate-900/50">
                            <td className="p-2 font-mono font-medium text-white max-w-[120px] truncate" title={String(r.user_id)}>
                              {nameLabel}
                            </td>
                            <td className="p-2 text-center">
                              <span className={`px-1.5 py-0.5 rounded-full font-bold font-mono text-[10px] ${
                                r.score >= 5 
                                  ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' 
                                  : r.score >= 3 
                                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' 
                                  : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              }`}>
                                {r.score} / 7
                              </span>
                            </td>
                            <td className="p-2 text-right text-slate-500 font-mono text-[9px]">
                              {r.created_at ? new Date(r.created_at).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' }) : '—'}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* Add User Modal Simulation */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center p-4 z-50">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-slate-900 border border-slate-800 rounded-xl max-w-sm w-full p-6 space-y-4 shadow-2xl"
          >
            <div className="border-b border-slate-800 pb-3">
              <h4 className="font-display font-bold text-white text-base">Додати нового користувача</h4>
              <p className="text-xs text-slate-400">Створіть запис безпосередньо у Supabase.</p>
            </div>

            <form onSubmit={handleAddUser} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Юзернейм в Telegram</label>
                <input 
                  type="text" 
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="@username"
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Telegram User ID</label>
                <input 
                  type="text" 
                  value={newTelegramId}
                  onChange={(e) => setNewTelegramId(e.target.value)}
                  placeholder="напр. 542019482"
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Номер телефону (міжнародний)</label>
                <input 
                  type="text" 
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="напр. +380991234567"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Тарифний статус доступу</label>
                <select 
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as UserStatus)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                >
                  <option value="free">Безкоштовний (Free)</option>
                  <option value="base">Базовий (Base)</option>
                  <option value="support">Супровід (Support)</option>
                  <option value="vip">VIP Супровід</option>
                </select>
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                >
                  Скасувати
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-sky-500 hover:bg-sky-600 text-white py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                >
                  Зберегти в БД
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Custom Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center p-4 z-[60]">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-slate-900 border border-slate-800 rounded-xl max-w-sm w-full p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-start gap-3 border-b border-slate-800 pb-3">
              <div className={`p-2 rounded-full shrink-0 ${
                confirmModal.type === 'danger' 
                  ? 'bg-rose-500/10 text-rose-400' 
                  : confirmModal.type === 'warning' 
                  ? 'bg-amber-500/10 text-amber-400' 
                  : 'bg-sky-500/10 text-sky-400'
              }`}>
                {confirmModal.type === 'danger' ? (
                  <Trash2 className="w-5 h-5" />
                ) : confirmModal.type === 'warning' ? (
                  <AlertTriangle className="w-5 h-5" />
                ) : (
                  <Info className="w-5 h-5" />
                )}
              </div>
              <div>
                <h4 className="font-display font-bold text-white text-base">{confirmModal.title}</h4>
                <p className="text-xs text-slate-400 mt-1">{confirmModal.message}</p>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer"
              >
                Скасувати
              </button>
              <button
                type="button"
                onClick={() => {
                  confirmModal.onConfirm();
                }}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer text-white ${
                  confirmModal.type === 'danger'
                    ? 'bg-rose-500 hover:bg-rose-600'
                    : confirmModal.type === 'warning'
                    ? 'bg-amber-500 hover:bg-amber-600 text-slate-950'
                    : 'bg-sky-500 hover:bg-sky-600'
                }`}
              >
                Підтвердити
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Chat Drawer / Direct Dialogue */}
      {activeChatUser && (
        <div className="fixed inset-0 bg-slate-950/80 flex justify-end z-[70] p-4">
          <motion.div 
            initial={{ x: 300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="bg-slate-900 border-l border-slate-800 w-full max-w-md h-full flex flex-col rounded-xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="p-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-white font-bold">{activeChatUser.username}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                    activeChatUser.status === 'free' 
                      ? 'bg-rose-500/10 text-rose-400' 
                      : activeChatUser.status === 'base' 
                      ? 'bg-amber-500/10 text-amber-400' 
                      : activeChatUser.status === 'support' 
                      ? 'bg-cyan-500/10 text-cyan-400' 
                      : 'bg-purple-500/10 text-purple-400'
                  }`}>
                    {activeChatUser.status.toUpperCase()}
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 font-mono mt-0.5 flex items-center gap-1">
                  <span>ID: {activeChatUser.telegramId}</span>
                  {activeChatUser.phone && (
                    <>
                      <span>•</span>
                      <span className="text-slate-400">{activeChatUser.phone}</span>
                    </>
                  )}
                </div>
              </div>
              <button 
                onClick={() => setActiveChatUser(null)}
                className="text-slate-400 hover:text-white text-xs bg-slate-800 hover:bg-slate-700 px-2.5 py-1.5 rounded-lg transition-all cursor-pointer font-semibold"
              >
                Закрити
              </button>
            </div>

            {/* Message Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-950/40">
              {chatMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-2 p-6">
                  <MessageSquare className="w-8 h-8 text-slate-600 animate-pulse" />
                  <span className="text-xs text-slate-500 italic">Діалог пустий. Напишіть перше повідомлення від імені Антоніни, щоб розпочати спілкування!</span>
                </div>
              ) : (
                chatMessages.map((msg, idx) => {
                  const isBot = msg.sender === 'bot' || msg.sender === 'system';
                  return (
                    <div 
                      key={msg.id || idx} 
                      className={`flex flex-col ${isBot ? 'items-end' : 'items-start'}`}
                    >
                      <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-xs ${
                        isBot 
                          ? 'bg-sky-500/10 text-sky-300 border border-sky-500/20 rounded-tr-none' 
                          : 'bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700/50'
                      }`}>
                        <p className="whitespace-pre-wrap">{msg.text}</p>
                      </div>
                      <span className="text-[9px] text-slate-500 mt-0.5 font-mono">
                        {isBot ? 'Антоніна' : activeChatUser.username} • {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' }) : 'щойно'}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            {/* Input Form */}
            <form onSubmit={handleSendChatMessage} className="p-3 border-t border-slate-800 bg-slate-950 flex items-center gap-2">
              <input 
                type="text" 
                value={newChatMessage}
                onChange={(e) => setNewChatMessage(e.target.value)}
                placeholder="Написати від імені Антоніни..."
                className="flex-1 bg-slate-900 border border-slate-850 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
              />
              <button 
                type="submit"
                className="bg-sky-500 hover:bg-sky-600 text-white p-2 rounded-lg transition-all cursor-pointer shrink-0"
                title="Надіслати"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </motion.div>
        </div>
      )}

    </div>
  );
}

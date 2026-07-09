import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MessageSquare, Users, BookOpen, Code2, Sparkles, 
  ShieldCheck, Heart, User, ExternalLink
} from 'lucide-react';
import { UserStatus, Lesson } from './types';
import { lessonsData as fallbackLessons } from './data/lessonsData';

// Importing our modular subcomponents
import TelegramSimulator from './components/TelegramSimulator';
import CRMDashboard from './components/CRMDashboard';
import CourseMaterials from './components/CourseMaterials';
import CodeExplorer from './components/CodeExplorer';

export default function App() {
  const [activeTab, setActiveTab] = useState<'simulator' | 'crm' | 'materials' | 'code'>('simulator');
  const [userStatus, setUserStatus] = useState<UserStatus>('free');
  const [currentDay, setCurrentDay] = useState<number>(1);
  const [lessons, setLessons] = useState<Lesson[]>(fallbackLessons);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/lessons')
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.data)) {
          setLessons(data.data);
        }
      })
      .catch(err => console.error('Failed to fetch lessons:', err));
  }, []);

  const handleUpdateLessons = async (newLessons: Lesson[]) => {
    setLessons(newLessons);
    try {
      await fetch('/api/lessons', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessons: newLessons })
      });
      showToast('✨ Текст занять успішно оновлено та синхронізовано!');
    } catch (err) {
      console.error('Failed to save lessons:', err);
      showToast('❌ Помилка збереження програми на сервері');
    }
  };

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const handlePurchaseSuccess = async (pkgId: UserStatus) => {
    setUserStatus(pkgId);
    showToast(`🎉 Вітаємо! Доступ до пакету "${
      pkgId === 'base' ? 'Базовий' : pkgId === 'support' ? 'Супровід' : 'VIP'
    }" успішно активовано!`);

    // Sync purchase with real Supabase database
    try {
      await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramId: '412054211',
          username: '@tetiana_b',
          status: pkgId,
          currentDay: 1
        })
      });

      await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramId: '412054211',
          packageName: pkgId,
          status: 'success'
        })
      });
    } catch (err) {
      console.error('Failed to sync payment with Supabase:', err);
    }
  };

  const handleSetCurrentDay = async (dayNum: number) => {
    setCurrentDay(dayNum);
    if (userStatus !== 'free') {
      try {
        await fetch('/api/users/412054211/current-day', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ currentDay: dayNum })
        });
      } catch (err) {
        console.error('Failed to sync day progress with Supabase:', err);
      }
    }
  };

  const handleSimulateDayFromMaterials = async (dayNum: number) => {
    // If user is currently free, automatically upgrade them to Base for testing purposes
    if (userStatus === 'free') {
      showToast(`ℹ️ Для тестування активовано демо-підписку "Базовий"`);
      setUserStatus('base');
      try {
        await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            telegramId: '412054211',
            username: '@tetiana_b',
            status: 'base',
            currentDay: dayNum
          })
        });
      } catch (e) {}
    }
    await handleSetCurrentDay(dayNum);
    setActiveTab('simulator');
    showToast(`🚀 Заняття [День ${dayNum}] надіслано в симуляторі!`);
  };

  return (
    <div className="min-h-screen bg-[#070b12] text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-900">
      
      {/* Visual Ambient Background Glows */}
      <div className="absolute top-0 left-1/4 w-[300px] h-[300px] bg-sky-500/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute top-1/3 right-1/4 w-[250px] h-[250px] bg-amber-500/5 rounded-full blur-[80px] pointer-events-none" />
      
      {/* Top Header Bar */}
      <header className="border-b border-slate-800 bg-[#0c121d]/85 backdrop-blur-md sticky top-0 z-40 px-4 lg:px-8 py-3 shrink-0">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          
          {/* Brand Logo & CEO title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-amber-600 to-rose-600 flex items-center justify-center shadow-lg shadow-amber-500/10">
              <Sparkles className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display font-bold text-base lg:text-lg text-white tracking-tight">Точка переходу</h1>
                <span className="text-[10px] bg-amber-500/15 text-amber-400 font-semibold px-2 py-0.5 rounded-full border border-amber-500/10">Bot Platform</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-400 text-[11px] mt-0.5 font-sans">
                <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
                <span>CEO Telegram Bot & Data Security Suite</span>
              </div>
            </div>
          </div>

          {/* Tab Navigation Menu */}
          <nav className="flex items-center bg-slate-950/80 p-1 rounded-xl border border-slate-850 self-start sm:self-auto overflow-x-auto w-full sm:w-auto">
            <button
              onClick={() => setActiveTab('simulator')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                activeTab === 'simulator'
                  ? 'bg-[#1e293b] text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5 text-sky-400" />
              <span>Симулятор бота</span>
            </button>
            
            <button
              onClick={() => setActiveTab('crm')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                activeTab === 'crm'
                  ? 'bg-[#1e293b] text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Users className="w-3.5 h-3.5 text-emerald-400" />
              <span>Панель CRM & База</span>
            </button>

            <button
              onClick={() => setActiveTab('materials')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                activeTab === 'materials'
                  ? 'bg-[#1e293b] text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 text-amber-400" />
              <span>Програма (8 днів)</span>
            </button>
          </nav>

          {/* Quick Support / Instagram link */}
          <div className="hidden xl:flex items-center gap-3">
            <a 
              href="https://www.instagram.com/tonypashko" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-[11px] text-slate-400 hover:text-white transition-all flex items-center gap-1"
            >
              <span>Антоніна Пашко</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

        </div>
      </header>

      {/* Main Container Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-8 relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="h-full"
          >
            {activeTab === 'simulator' && (
              <TelegramSimulator 
                userStatus={userStatus}
                setUserStatus={setUserStatus}
                currentDay={currentDay}
                setCurrentDay={handleSetCurrentDay}
                onPurchaseSuccess={handlePurchaseSuccess}
                lessons={lessons}
              />
            )}

            {activeTab === 'crm' && (
              <CRMDashboard 
                userStatus={userStatus}
                setUserStatus={setUserStatus}
                currentDay={currentDay}
                setCurrentDay={handleSetCurrentDay}
                onSwitchToSimulator={() => {
                  setActiveTab('simulator');
                  showToast('🚀 Практикум успішно синхронізовано з симулятором бота!');
                }}
              />
            )}

            {activeTab === 'materials' && (
              <CourseMaterials 
                onSimulateDay={handleSimulateDayFromMaterials}
                lessons={lessons}
                onUpdateLessons={handleUpdateLessons}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Notification Toast Alert */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-50 max-w-sm bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-2xl flex items-start gap-3"
          >
            <div className="w-8 h-8 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-white leading-snug">Сповіщення платформи</p>
              <p className="text-[11px] text-slate-300 mt-1 leading-normal">{toastMessage}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Little clean footnote */}
      <footer className="border-t border-slate-900 bg-slate-950/60 py-3.5 px-4 text-center text-[10px] text-slate-500 font-sans shrink-0">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <span>© 2026 · Практикум «Точка переходу» · Усі права захищено</span>
          <div className="flex items-center justify-center gap-1.5">
            <Heart className="w-3 h-3 text-rose-500 fill-current" />
            <span>Розроблено за стандартами безпеки та збереження контенту</span>
          </div>
        </div>
      </footer>

    </div>
  );
}

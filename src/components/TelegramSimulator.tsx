import { useState, useRef, useEffect, FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Send, Bot, User as UserIcon, Check, CheckCheck, Play, Pause, FileText, 
  Download, Globe, ChevronRight, RefreshCw, CreditCard, Sparkles, Info, ArrowLeft
} from 'lucide-react';
import { ChatMessage, UserStatus, Lesson } from '../types';
import { lessonsData as fallbackLessons } from '../data/lessonsData';

interface TelegramSimulatorProps {
  userStatus: UserStatus;
  setUserStatus: (status: UserStatus) => void;
  currentDay: number;
  setCurrentDay: (day: number) => void;
  onPurchaseSuccess: (pkgId: UserStatus) => void;
  lessons?: Lesson[];
}

export default function TelegramSimulator({
  userStatus,
  setUserStatus,
  currentDay,
  setCurrentDay,
  onPurchaseSuccess,
  lessons = fallbackLessons
}: TelegramSimulatorProps) {
  const [usersList, setUsersList] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null); // null means Tetiana (fallback)
  const [isRealTime, setIsRealTime] = useState<boolean>(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-system',
      sender: 'system',
      text: 'Для початку симуляції натисніть кнопку СТАРТ або введіть /start',
      timestamp: '16:00'
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [activeAudioId, setActiveAudioId] = useState<string | null>(null);
  const [audioProgress, setAudioProgress] = useState<{ [key: string]: number }>({});
  const [showWebPage, setShowWebPage] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const audioIntervalRef = useRef<{ [key: string]: NodeJS.Timeout }>({});

  const getActiveId = () => {
    return isRealTime && selectedUser ? String(selectedUser.telegramId || selectedUser.id) : '412054211';
  };

  const saveMessageToServer = async (sender: 'user' | 'bot' | 'system', text: string) => {
    try {
      await fetch('/api/messages/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramId: getActiveId(),
          sender,
          text
        })
      });
    } catch (err) {
      console.error('Error saving message to server:', err);
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Fetch users list on mount
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await fetch('/api/users');
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          setUsersList(data.data);
        }
      } catch (err) {
        console.error('Failed to fetch users:', err);
      }
    };
    fetchUsers();
  }, []);

  // Update status and current day progress when selected user changes
  useEffect(() => {
    if (isRealTime && selectedUser) {
      setUserStatus(selectedUser.status || 'free');
      setCurrentDay(selectedUser.currentDay || 1);
    }
  }, [selectedUser, isRealTime]);

  // Load message history on mount, selected user change, or mode toggle
  useEffect(() => {
    const loadMessagesHistory = async () => {
      const activeId = getActiveId();
      try {
        const res = await fetch(`/api/messages/${activeId}`);
        const data = await res.json();
        if (data.success && data.data && data.data.length > 0) {
          const loaded = data.data.map((m: any) => ({
            id: m.id || `msg-${Math.random()}`,
            sender: m.sender || 'bot',
            text: m.text,
            timestamp: m.timestamp ? new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }));
          setMessages(loaded);
        } else {
          if (!isRealTime) {
            handleStartCommand();
          } else {
            setMessages([
              {
                id: 'empty-realtime',
                sender: 'system',
                text: 'Історія повідомлень порожня. Почніть діалог в реальному часі.',
                timestamp: getTimestamp()
              }
            ]);
          }
        }
      } catch (err) {
        console.error('Error loading chat history:', err);
        if (!isRealTime) handleStartCommand();
      }
    };
    
    loadMessagesHistory();
    
    // Set up polling for real-time mode only
    if (isRealTime) {
      const interval = setInterval(loadMessagesHistory, 4000);
      return () => clearInterval(interval);
    }
  }, [selectedUser, isRealTime, userStatus]);

  // Audio simulation player
  const toggleAudio = (msgId: string) => {
    if (activeAudioId === msgId) {
      clearInterval(audioIntervalRef.current[msgId]);
      setActiveAudioId(null);
    } else {
      if (activeAudioId) {
        clearInterval(audioIntervalRef.current[activeAudioId]);
      }
      setActiveAudioId(msgId);
      if (!audioProgress[msgId]) {
        setAudioProgress(prev => ({ ...prev, [msgId]: 0 }));
      }
      
      const interval = setInterval(() => {
        setAudioProgress(prev => {
          const current = prev[msgId] || 0;
          if (current >= 100) {
            clearInterval(interval);
            setActiveAudioId(null);
            return { ...prev, [msgId]: 100 };
          }
          return { ...prev, [msgId]: current + 2 };
        });
      }, 200);
      audioIntervalRef.current[msgId] = interval;
    }
  };

  const getTimestamp = () => {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getStatusLabel = (status: UserStatus) => {
    switch (status) {
      case 'free': return '🔴 Безкоштовний доступ (Ознайомча)';
      case 'base': return '🟢 Базовий';
      case 'support': return '🔵 Супровід';
      case 'vip': return '👑 VIP';
      default: return status;
    }
  };

  // Bot logic
  const TEST_QUESTIONS = [
    "Спокій з'являється тільки тоді, коли 'все встигла'?",
    "Відпочинок треба заслужити або пояснити собі, чому зараз можна?",
    "Автоматично береш на себе більше, ніж повинна?",
    "Легше дати, ніж попросити чи прийняти підтримку?",
    "Боляче, коли твої зусилля не помітили або не оцінили?",
    "Страшно розслабитись, ніби тоді все почне сипатися?",
    "Після досягнень швидко стає мало: треба більше, краще, ще один рівень?"
  ];

  const [testActive, setTestActive] = useState(false);
  const [testIndex, setTestIndex] = useState(0);
  const [testScore, setTestScore] = useState(0);

  // Core helper to support message editing (like actual Telegram callbacks)
  const sendOrEditMessage = (newMsg: ChatMessage, messageId?: string) => {
    if (messageId) {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, ...newMsg, id: messageId } : m));
    } else {
      setMessages(prev => [...prev, newMsg]);
    }
    // Auto persist to server if not system
    if (newMsg.sender !== 'system') {
      saveMessageToServer(newMsg.sender as 'user' | 'bot', newMsg.text);
    }
  };

  const handleStartCommand = (customStatus?: UserStatus, messageId?: string) => {
    setTestActive(false);
    const statusToCheck = customStatus || userStatus;
    const time = getTimestamp();
    
    let text = '';
    if (messageId) {
      text = `Головне меню онлайн-практикуму <b>«Точка переходу»</b>.\n\nОбери розділ для ознайомлення з програмою, тестуванням чи тарифами.`;
    } else {
      text = `Вітаємо! ✨\n\nРада бачити тебе тут. Я — провідник в онлайн-практикум <b>«Точка переходу»</b> Антоніни Пашко.\n\nЦей 7+1 денний практикум створений для жінок, у яких зовні все ніби добре, але всередині все частіше з'являється чесне відчуття: <b>так більше не хочу</b>.\n\nОбери цікавий розділ меню нижче, або почни з швидкого діагностичного тесту, щоб виявити, чи не блокує нейросаботаж твої справжні бажання.`;
    }

    const welcomeMsg: ChatMessage = {
      id: messageId || `bot-start-${Date.now()}`,
      sender: 'bot',
      text: `${text}\n\n🔑 <b>Ваш статус:</b> ${getStatusLabel(statusToCheck)}\n\nОберіть пункт меню нижче 👇`,
      timestamp: time,
      buttons: [
        { text: 'ℹ️ Про практикум', action: 'about_course' },
        { text: '📝 Пройти тест (7 ознак)', action: 'start_test' },
        { text: '📅 Програма за днями', action: 'program_menu' },
        { text: '👤 Про автора', action: 'about_author' },
        { text: '💳 Тарифи та запис', action: 'packages_menu' },
        { text: '❓ Задати питання', action: 'contacts' }
      ]
    };

    sendOrEditMessage(welcomeMsg, messageId);
  };

  const showAboutCourse = (messageId?: string) => {
    const time = getTimestamp();
    const msg: ChatMessage = {
      id: messageId || `bot-about-${Date.now()}`,
      sender: 'bot',
      text: `🌟 <b>7+1 - денний онлайн-практикум «Точка переходу»</b>\n\nЦе не криза. Це точка твого переходу до нового рівня життя.\n\n<b>Для кого цей практикум?</b>\nДля жінок, які зовні справляються та мають успіх, але всередині відчувають глибоку втому, потребу зупинитися і почати жити для себе, а не для відповідності чужим очікуванням.\n\n🔄 <b>Що зміниться (Трансформація):</b>\n1. <i>Ілюзія контролю:</i> Щось закінчилося, але ще незрозуміло що саме.\n   ➡️ <b>Нова опора:</b> Зі мною все гаразд — я на порозі масштабного нового.\n\n2. <i>Ілюзія контролю:</i> Звичний відпочинок більше не повертає сили.\n   ➡️ <b>Нова опора:</b> Я чітко бачу, куди насправді витікає моя енергія.\n\n3. <i>Ілюзія контролю:</i> Стало занадто складно зрозуміти, чого хочеться насправді.\n   ➡️ <b>Нова опора:</b> Я знову чую свій внутрішній голос та справжні бажання.\n\n⏱ <b>Формат:</b> 15-30 хвилин на день, проходження у власному темпі, доступ назавжди!`,
      timestamp: time,
      buttons: [
        { text: '📝 Пройти тест (7 ознак)', action: 'start_test' },
        { text: '📅 Програма за днями', action: 'program_menu' },
        { text: '↩️ Головне меню', action: 'main_menu' }
      ]
    };
    sendOrEditMessage(msg, messageId);
  };

  const startTest = (messageId?: string) => {
    const time = getTimestamp();
    const msg: ChatMessage = {
      id: messageId || `bot-test-intro-${Date.now()}`,
      sender: 'bot',
      text: `📝 <b>Діагностичний тест: 7 ознак заниженої самооцінки та втрати ресурсу</b>\n\nЦей тест допоможе тобі чесно поглянути на свій внутрішній стан та зрозуміти, чи перебуваєш ти зараз у точці переходу.\n\nТест складається з 7 коротких питань. Тобі потрібно відповідати щиро.\n\nГотова почати?`,
      timestamp: time,
      buttons: [
        { text: '🚀 Почати тест', action: 'test_begin' },
        { text: '↩️ Головне меню', action: 'main_menu' }
      ]
    };
    sendOrEditMessage(msg, messageId);
  };

  const sendTestQuestion = (index: number, messageId?: string) => {
    const time = getTimestamp();
    const msg: ChatMessage = {
      id: messageId || `bot-test-q-${index}-${Date.now()}`,
      sender: 'bot',
      text: `❓ <b>Питання ${index + 1}/7</b>\n\n<b>${TEST_QUESTIONS[index]}</b>`,
      timestamp: time,
      buttons: [
        { text: '✅ Так, це про мене', action: 'test_yes' },
        { text: '❌ Ні, це не про мене', action: 'test_no' },
        { text: '↩️ Перервати тест', action: 'main_menu' }
      ]
    };
    sendOrEditMessage(msg, messageId);
  };

  const handleTestAnswer = async (answer: boolean, messageId?: string) => {
    const newScore = answer ? testScore + 1 : testScore;
    setTestScore(newScore);
    const nextIdx = testIndex + 1;

    if (nextIdx < 7) {
      setTestIndex(nextIdx);
      sendTestQuestion(nextIdx, messageId);
    } else {
      setTestActive(false);
      const time = getTimestamp();
      
      try {
        await fetch('/api/test-results', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            telegramId: getActiveId(),
            score: newScore
          })
        });
      } catch (err) {
        console.error('Error saving test results:', err);
      }

      let resultText = `📊 <b>Результат тесту: ${newScore} з 7 балів</b>\n\n`;
      if (newScore >= 3) {
        resultText += `⚠️ <b>Це серйозний сигнал.</b>\nТвоя самооцінка та відчуття власної цінності все ще міцно прив'язані до корисності, результату, схвалення чи надмірних зусиль. Спокій приходить тільки тоді, коли все зроблено, а відпочинок відчувається як слабкість.\n\n<b>Важливо:</b> З тобою абсолютно все гаразд. Свого часу ці патерни допомогли вижити. Але сьогодні вони забирають твою живість, енергію та обмежують розвиток.\n\nПрактикум <b>«Точка переходу»</b> розроблений саме для того, щоб екологічно вийти з цього замкнутого кола.`;
      } else {
        resultText += `✅ <b>Гарний баланс.</b>\nЗдається, ти маєш відносно здоровий контакт зі своїми потребами та не схильна повністю розчинятися у справах. Проте, якщо ти відчуваш фонове бажання змін або шукаєш нові життєві орієнтири, практикум допоможе знайти необхідну ясність.`;
      }

      const msg: ChatMessage = {
        id: messageId || `bot-test-result-${Date.now()}`,
        sender: 'bot',
        text: resultText,
        timestamp: time,
        buttons: [
          { text: '📅 Подивитись програму', action: 'program_menu' },
          { text: '💳 Пакети участі', action: 'packages_menu' },
          { text: '↩️ Головне меню', action: 'main_menu' }
        ]
      };
      sendOrEditMessage(msg, messageId);
    }
  };

  const showProgramMenu = (messageId?: string) => {
    const time = getTimestamp();
    const msg: ChatMessage = {
      id: messageId || `bot-prog-menu-${Date.now()}`,
      sender: 'bot',
      text: `📅 <b>Програма: 7+1 днів, які повертають контакт із собою</b>\n\nКожен день містить відео, аудіо-практику та запитання в робочому зошиті. Обери день для детального ознайомлення:`,
      timestamp: time,
      buttons: [
        { text: '🎬 День 1. Мотивація', action: 'prog_day_1' },
        { text: '🎬 День 2. Енергія', action: 'prog_day_2' },
        { text: '🎬 День 3. Страхи', action: 'prog_day_3' },
        { text: '🎬 День 4. Хто Я', action: 'prog_day_4' },
        { text: '🎬 День 5. Точка відчаю', action: 'prog_day_5' },
        { text: '🎬 День 6. Переконання', action: 'prog_day_6' },
        { text: '🎬 День 7. Тіло і рішення', action: 'prog_day_7' },
        { text: '🎬 День 8. Інтеграція', action: 'prog_day_8' },
        { text: '↩️ Головне меню', action: 'main_menu' }
      ]
    };
    sendOrEditMessage(msg, messageId);
  };

  const showProgramDay = (dayNum: number, messageId?: string) => {
    const time = getTimestamp();
    const lesson = lessons.find(l => l.day === dayNum);
    if (!lesson) return;

    const msg: ChatMessage = {
      id: messageId || `bot-prog-day-${dayNum}-${Date.now()}`,
      sender: 'bot',
      text: `📅 <b>День ${dayNum}. ${lesson.title}</b>\n\n🔍 <b>Короткий опис:</b>\n${lesson.description}\n\n🔍 <b>Практика:</b>\n${lesson.practiceTitle || 'Аудіо-медитація'}\n\n🎬 Відео ${lesson.videoDuration || '15-20 хв'}\n🎧 Аудіо-практика\n📝 Робочий зошит PDF`,
      timestamp: time,
      buttons: [
        { text: '📅 Надіслати це заняття', action: `send_lesson_${dayNum}` },
        { text: '↩️ До програми', action: 'program_menu' },
        { text: '💳 Тарифи та запис', action: 'packages_menu' },
        { text: '↩️ Головне меню', action: 'main_menu' }
      ]
    };
    sendOrEditMessage(msg, messageId);
  };

  const showAboutAuthor = (messageId?: string) => {
    const time = getTimestamp();
    const msg: ChatMessage = {
      id: messageId || `bot-author-${Date.now()}`,
      sender: 'bot',
      text: `👤 <b>Антоніна Пашко — Авторка практикуму</b>\n\nПровідник у внутрішніх транзитах без надриву та напруги. Допомагає жінкам почути себе за межами ролей, очікувань та постійного 'треба'.\n\n🏆 <b>Регалії та цифри:</b>\n• <b>17+ років</b> практичного досвіду коучем, психологом та енергопрактиком.\n• <b>1350+ жінок</b>, які пройшли свій шлях трансформації та змін.\n• <b>70+ авторських проектів</b>, присвячених розвитку особистості.\n• Доктор філософії у сфері психологии Кембриджської академії.\n• Гранд-доктор філософії в галузі інформаційних технологій (психологія).\n• Професорка психології та спікерка європейського рівня.\n\n💬 <i>«Мені важливо, щоб реальний внутрішній зсув ви відчули вже з першої практики.»</i>`,
      timestamp: time,
      buttons: [
        { text: '📸 Instagram @tonypashko', action: 'instagram_link', url: 'https://www.instagram.com/tonypashko' },
        { text: '↩️ Головне меню', action: 'main_menu' }
      ]
    };
    sendOrEditMessage(msg, messageId);
  };

  const showContacts = (messageId?: string) => {
    const time = getTimestamp();
    const msg: ChatMessage = {
      id: messageId || `bot-contacts-${Date.now()}`,
      sender: 'bot',
      text: `❓ <b>Виникли запитання?</b>\n\nЯкщо у вас залишилися питання щодо тарифів, програми чи процесу оплати, ви можете:\n\n📱 Написати Антоніні в Instagram: <a href="https://instagram.com/tonypashko" target="_blank" class="text-sky-400 underline">Instagram @tonypashko</a>\n💬 Зв'язатися безпосередньо у Telegram: @tonypashko`,
      timestamp: time,
      buttons: [
        { text: '↩️ Головне меню', action: 'main_menu' }
      ]
    };
    sendOrEditMessage(msg, messageId);
  };

  const showPackagesMenu = (messageId?: string) => {
    const time = getTimestamp();
    const msg: ChatMessage = {
      id: messageId || `bot-packages-${Date.now()}`,
      sender: 'bot',
      text: `💳 <b>Обери безпечний та комфортний формат участі:</b>\n\n🟢 <b>1. Самостійно (Базовий)</b>\n• Повне самостійне проходження у своєму темпі\n• 8 відео-уроків, 8 аудіопрактик, робочий зошит\n• Доступ назавжди + подарунки\n🔥 <b>Ціна: 20€</b> (замість <s>100€</s>)\n\n🔵 <b>2. Зі спікером (Супровід)</b>\n• Все з базового пакета + живий контакт\n• Telegram-група з учасницями та голосові відповіді від Антоніни\n• <b>1 особиста сесія в Zoom</b> після проходження курсу\n🔥 <b>Ціна: 125€</b> (замість <s>200€</s>) (Залишилося місць: 5)\n\n🟣 <b>3. VIP Супровід (Індивідуально)</b>\n• Все з пакета Супровід\n• <b>4 особисті сесії в Zoom</b> та особистий супровід 24/7\n🔥 <b>Ціна: 400€</b> (замість <s>600€</s>) (Залишилося місць: 2)\n\n💡 <i>Старт одразу після оплати. Доступ залишається назавжди!</i>`,
      timestamp: time,
      buttons: [
        { text: '✨ 🌐 ВІДКРИТИ САЙТ ПРЯМО ТУТ 🌐 ✨', action: 'open_website', isWebApp: true },
        { text: '🟢 Базовий (20€)', action: 'order_base' },
        { text: '🔵 Супровід (125€)', action: 'order_support' },
        { text: '🟣 VIP (400€)', action: 'order_vip' },
        { text: '↩️ Головне меню', action: 'main_menu' }
      ]
    };
    sendOrEditMessage(msg, messageId);
  };

  const handleOrder = async (packageName: UserStatus, name: string, price: string, messageId?: string) => {
    const time = getTimestamp();
    
    try {
      await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramId: getActiveId(),
          packageName: packageName,
          status: 'pending'
        })
      });
    } catch (err) {
      console.error('Error saving lead:', err);
    }

    const msg: ChatMessage = {
      id: messageId || `bot-order-${packageName}-${Date.now()}`,
      sender: 'bot',
      text: `🎉 <b>Заявку на участь прийнято!</b>\n\nВи обрали пакет: <b>${name}</b>.\n\nНатисніть кнопку нижче, щоб перейти до безпечної оплати через платіжний сервіс <b>WayForPay</b>.\n\nПісля здійснення оплати доступ до практикуму буде відкрито автоматично. Якщо у вас виникнуть питання, ви завжди можете зв'язатися з автором.`,
      timestamp: time,
      buttons: [
        { text: `💳 Оплатити через WayForPay (${price})`, action: 'open_website', isWebApp: true },
        { text: '✅ Симулювати успішну оплату', action: `simulate_success_${packageName}` },
        { text: '↩️ Назад до тарифів', action: 'packages_menu' },
        { text: '↩️ Головне меню', action: 'main_menu' }
      ]
    };
    sendOrEditMessage(msg, messageId);
  };

  const simulatePaymentSuccess = (pkgId: UserStatus) => {
    const time = getTimestamp();
    const paymentMsg: ChatMessage = {
      id: `bot-payment-${Date.now()}`,
      sender: 'bot',
      mediaType: 'success',
      text: `🎉 <b>ОПЛАТА УСПІШНА! Ласкаво просимо в «Точку переходу»!</b> 🎉\n\nВітаємо! Ваш платіж зараховано, а преміум-доступ до матеріалів <b>активовано назавжди</b>.\n\n<b>Ви придбали пакет:</b> ${
        pkgId === 'base' ? '📦 Базовий (Самостійно)' : pkgId === 'support' ? '🤝 Супровід (Зі спікером)' : '💎 VIP Супровід'
      }.\n\n<b>Відтепер ви будете отримувати:</b>\n• 🎬 8 авторських відео-уроків Антоніни Пашко\n• 🎵 8 трансформаційних аудіо-практик у високій якості\n• 📄 Робочі зошити для щоденної чесної розмови із собою\n\n🚀 Перше заняття (День 1) вже надіслано вам нижче!`,
      timestamp: time
    };

    setMessages(prev => [...prev, paymentMsg]);
    onPurchaseSuccess(pkgId);
    
    // Auto-send day 1
    setTimeout(() => {
      sendDayMaterial(1, true);
    }, 1500);
  };

  const sendDayMaterial = (dayNum: number, bypassStatusCheck = false) => {
    const isPaid = bypassStatusCheck || userStatus !== 'free';
    const time = getTimestamp();
    const lesson: Lesson | undefined = lessons.find(l => l.day === dayNum);

    if (!lesson) return;

    if (!isPaid) {
      const blockedMsg: ChatMessage = {
        id: `bot-blocked-${Date.now()}`,
        sender: 'bot',
        text: `🔒 <b>Матеріал [День ${dayNum}: ${lesson.title}] заблоковано.</b>\n\nДля отримання повного доступу до 8 днів практикуму, включаючи відео-уроки, аудіо-практики та робочі зошити, придбайте один із пакетів участі.\n\nКористувачі без активної підписки отримують лише ознайомчі матеріали.`,
        timestamp: time,
        buttons: [
          { text: '💳 Переглянути тарифи оплати', action: 'packages_menu' }
        ]
      };
      setMessages(prev => [...prev, blockedMsg]);
      return;
    }

    setCurrentDay(dayNum);
    
    const pdfStr = lesson.pdfFiles && lesson.pdfFiles.length > 0 
      ? lesson.pdfFiles.map((f: string) => `• ${f}`).join('\n') 
      : '—';
    const formattedText = 
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🌸 <b>ДЕНЬ ${lesson.day} • ПРАКТИКУМ «ТОЧКА ПЕРЕХОДУ»</b> 🌸\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `✨ <b>Тема дня:</b>\n«{lesson.title}»\n\n` +
      `📝 <b>Про що цей день:</b>\n${lesson.description}\n\n` +
      `┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈\n` +
      `ℹ️ <b>МАТЕРІАЛИ ЗАНЯТТЯ:</b>\n` +
      `🎥 <b>Відео-урок:</b> ${lesson.videoDuration || '15-20 хв'}\n` +
      `🧘‍♀️ <b>Практика:</b> ${lesson.practiceTitle || 'Аудіо-медитація'}\n\n` +
      `📖 <b>Детальний зміст:</b>\n${lesson.fullDescription || ''}\n\n` +
      `📂 <b>Завдання в робочому зошиті:</b>\n${pdfStr}\n\n` +
      `┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈\n` +
      `🙏 Проходьте практику у зручному темпі!\n` +
      `Наступний урок буде надіслано автоматично.`;

    const textMsg: ChatMessage = {
      id: `bot-lesson-text-${dayNum}-${Date.now()}`,
      sender: 'bot',
      text: formattedText,
      timestamp: time,
      protectContent: true
    };

    const photoMsg: ChatMessage = {
      id: `bot-lesson-photo-${dayNum}-${Date.now()}`,
      sender: 'bot',
      mediaType: 'photo',
      photoFileId: lesson.photoFileId || lesson.welcomePhotoFileId,
      text: `🖼 <b>Зображення дня</b>\nФайл: <code>${lesson.photoFileId || lesson.welcomePhotoFileId}</code>`,
      timestamp: time,
      protectContent: true
    };

    const videoMsg: ChatMessage = {
      id: `bot-lesson-video-${dayNum}-${Date.now()}`,
      sender: 'bot',
      mediaType: 'video',
      videoFileId: lesson.videoFileId,
      text: `🎬 <b>Відео-урок День ${dayNum}</b>\nТривалість: ${lesson.videoDuration}\nФайл: <code>${lesson.videoFileId}</code>`,
      timestamp: time,
      protectContent: true
    };

    const audioMsg: ChatMessage = {
      id: `bot-lesson-audio-${dayNum}-${Date.now()}`,
      sender: 'bot',
      mediaType: 'audio',
      mediaTitle: `🎵 День ${dayNum}. Аудіо-практика`,
      mediaSubtitle: lesson.audioFileName,
      text: lesson.practiceTitle,
      timestamp: time,
      protectContent: true
    };

    const pdfMessages: ChatMessage[] = lesson.pdfFiles.map((pdfName, idx) => ({
      id: `bot-lesson-pdf-${dayNum}-${idx}-${Date.now()}`,
      sender: 'bot',
      mediaType: 'pdf',
      mediaTitle: pdfName,
      mediaSubtitle: 'Робочий зошит PDF',
      text: `📄 Завдання в зошиті: ${lesson.title}`,
      timestamp: time,
      protectContent: true
    }));

    // Send messages sequentially to simulate real Telegram delay
    setMessages(prev => [...prev, textMsg]);

    let delay = 1000;
    if (lesson.photoFileId || lesson.welcomePhotoFileId) {
      setTimeout(() => {
        setMessages(prev => [...prev, photoMsg]);
      }, delay);
      delay += 1000;
    }

    if (lesson.videoFileId) {
      setTimeout(() => {
        setMessages(prev => [...prev, videoMsg]);
      }, delay);
      delay += 1000;
    }

    if (lesson.audioFileId || lesson.audioFileName) {
      setTimeout(() => {
        setMessages(prev => [...prev, audioMsg]);
      }, delay);
      delay += 1000;
    }

    if (pdfMessages.length > 0) {
      pdfMessages.forEach((pdfMsg, idx) => {
        setTimeout(() => {
          setMessages(prev => [...prev, pdfMsg]);
        }, delay + (idx * 1000));
      });
    }
  };

  const handleSendMessage = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;

    const activeId = getActiveId();
    const textToSend = inputText.trim();
    setInputText('');

    if (isRealTime && selectedUser) {
      // Real-time: Send message as admin/bot to the real user
      try {
        const res = await fetch('/api/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            telegramId: activeId,
            text: textToSend
          })
        });
        const data = await res.json();
        if (data.success) {
          setMessages(prev => [
            ...prev,
            {
              id: `msg-sent-${Date.now()}`,
              sender: 'bot',
              text: textToSend,
              timestamp: getTimestamp()
            }
          ]);
        }
      } catch (err) {
        console.error('Failed to send real-time message:', err);
      }
    } else {
      // Test Mode (Simulation)
      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        sender: 'user',
        text: textToSend,
        timestamp: getTimestamp()
      };

      setMessages(prev => [...prev, userMsg]);
      saveMessageToServer('user', textToSend);
      const cmd = textToSend.toLowerCase();

      setTimeout(() => {
        const time = getTimestamp();
        if (cmd === '/start' || cmd === 'старт') {
          handleStartCommand();
        } else if (cmd === '/help' || cmd === 'допомога') {
          const helpMsg: ChatMessage = {
            id: `bot-help-${Date.now()}`,
            sender: 'bot',
            text: `🤖 <b>Помічник бота «Точка переходу»:</b>\n\n• /start — перезапустити бота та відкрити головне меню\n• /day1 ... /day8 — надіслати матеріали відповідного дня (доступно тільки для оплачених користувачів)\n• Для індивідуальних питань звертайтеся до Антоніни: @tonypashko`,
            timestamp: time
          };
          setMessages(prev => [...prev, helpMsg]);
          saveMessageToServer('bot', helpMsg.text);
        } else if (cmd.startsWith('/day')) {
          const dNum = parseInt(cmd.replace('/day', ''));
          if (dNum >= 1 && dNum <= 8) {
            sendDayMaterial(dNum);
          } else {
            const errText = `❌ Невірний день. Виберіть від /day1 до /day8.`;
            setMessages(prev => [...prev, {
              id: `bot-err-${Date.now()}`,
              sender: 'bot',
              text: errText,
              timestamp: time
            }]);
            saveMessageToServer('bot', errText);
          }
        } else {
          const echoMsg: ChatMessage = {
            id: `bot-echo-${Date.now()}`,
            sender: 'bot',
            text: `✨ <b>Дякую за твоє повідомлення!</b>\n\n<i>«З тобою все гаразд. Це не криза, це твоя точка переходу.»</i>\n\nНаш бот зараз працює в автоматичному режимі видачі матеріалів практикуму. \n\nЯкщо у вас виникли технічні проблеми або ви бажаєте особистий VIP-супровід Антоніни, напишіть у приватні повідомлення @tonypashko в Instagram.`,
            timestamp: time,
            buttons: [
              { text: '📸 Instagram @tonypashko', action: 'instagram_link', url: 'https://www.instagram.com/tonypashko' },
              { text: '↩️ Головне меню', action: 'main_menu' }
            ]
          };
          setMessages(prev => [...prev, echoMsg]);
          saveMessageToServer('bot', echoMsg.text);
        }
      }, 1000);
    }
  };

  const handleButtonAction = (action: string, messageId?: string) => {
    if (action === 'open_website') {
      setShowWebPage(true);
    } else if (action === 'main_menu') {
      handleStartCommand(userStatus, messageId);
    } else if (action === 'about_course') {
      showAboutCourse(messageId);
    } else if (action === 'start_test') {
      startTest(messageId);
    } else if (action === 'test_begin') {
      setTestActive(true);
      setTestIndex(0);
      setTestScore(0);
      sendTestQuestion(0, messageId);
    } else if (action === 'test_yes') {
      handleTestAnswer(true, messageId);
    } else if (action === 'test_no') {
      handleTestAnswer(false, messageId);
    } else if (action === 'program_menu') {
      showProgramMenu(messageId);
    } else if (action.startsWith('prog_day_')) {
      const dNum = parseInt(action.replace('prog_day_', ''));
      showProgramDay(dNum, messageId);
    } else if (action.startsWith('send_lesson_')) {
      const dNum = parseInt(action.replace('send_lesson_', ''));
      handleDaySelect(dNum);
    } else if (action === 'about_author') {
      showAboutAuthor(messageId);
    } else if (action === 'contacts') {
      showContacts(messageId);
    } else if (action === 'packages_menu') {
      showPackagesMenu(messageId);
    } else if (action === 'order_base') {
      handleOrder('base', '📦 Самостійно (Базовий)', '20€', messageId);
    } else if (action === 'order_support') {
      handleOrder('support', '🤝 Зі спікером (Супровід)', '125€', messageId);
    } else if (action === 'order_vip') {
      handleOrder('vip', '💎 Індивідуально (VIP)', '400€', messageId);
    } else if (action === 'simulate_success_base') {
      simulatePaymentSuccess('base');
    } else if (action === 'simulate_success_support') {
      simulatePaymentSuccess('support');
    } else if (action === 'simulate_success_vip') {
      simulatePaymentSuccess('vip');
    }
  };

  const handleStatusChange = async (newStatus: UserStatus) => {
    setUserStatus(newStatus);
    const activeId = getActiveId();
    
    if (isRealTime && selectedUser) {
      try {
        await fetch(`/api/users/${activeId}/status`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus })
        });
        setSelectedUser((prev: any) => prev ? { ...prev, status: newStatus } : null);
        // Refresh users list
        const uRes = await fetch('/api/users');
        const uData = await uRes.json();
        if (uData.success && Array.isArray(uData.data)) {
          setUsersList(uData.data);
        }
      } catch (err) {
        console.error('Failed to update status in real-time mode:', err);
      }
    } else {
      handleStartCommand(newStatus);
    }
  };

  const handleDaySelect = async (dayNum: number) => {
    setCurrentDay(dayNum);
    const activeId = getActiveId();
    
    if (isRealTime && selectedUser) {
      try {
        setMessages(prev => [
          ...prev, 
          {
            id: `system-broadcasting-${Date.now()}`,
            sender: 'system',
            text: `⏳ Надсилання матеріалів Дня ${dayNum} користувачу @${selectedUser.username || selectedUser.telegramId} в Telegram...`,
            timestamp: getTimestamp()
          }
        ]);
        const res = await fetch('/api/broadcast/trigger', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetUserId: activeId,
            dayNum: dayNum
          })
        });
        const data = await res.json();
        if (data.success) {
          setMessages(prev => [
            ...prev,
            {
              id: `system-broadcast-success-${Date.now()}`,
              sender: 'system',
              text: `✅ День ${dayNum} успішно надіслано в Telegram!`,
              timestamp: getTimestamp()
            }
          ]);
        } else {
          throw new Error(data.error || 'Помилка надсилання');
        }
      } catch (err: any) {
        console.error('Failed to trigger manual day broadcast:', err);
        setMessages(prev => [
          ...prev,
          {
            id: `system-broadcast-error-${Date.now()}`,
            sender: 'system',
            text: `❌ Помилка надсилання: ${err.message}`,
            timestamp: getTimestamp()
          }
        ]);
      }
    } else {
      sendDayMaterial(dayNum);
    }
  };

  const resetChat = () => {
    setMessages([
      {
        id: 'system-reset',
        sender: 'system',
        text: 'Чат скинуто. Натисніть кнопку СТАРТ для запуску бота.',
        timestamp: getTimestamp()
      }
    ]);
  };

  return (
    <div id="bot-simulator-container" className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-140px)]">
      {/* Simulation Tools Column */}
      <div id="simulation-tools" className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between text-slate-100 overflow-y-auto">
        <div>
          <div className="flex items-center gap-2 mb-4 border-b border-slate-800 pb-3">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <h3 className="font-display font-semibold text-lg text-white">Панель керування</h3>
          </div>

          {/* Mode Selector */}
          <div className="space-y-3 mb-6 border-b border-slate-800 pb-4">
            <span className="text-xs font-semibold text-slate-400 tracking-wider uppercase block">Режим роботи</span>
            <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1 rounded-xl border border-slate-850">
              <button
                type="button"
                onClick={() => setIsRealTime(false)}
                className={`py-2 text-[11px] rounded-lg font-semibold transition-all cursor-pointer ${
                  !isRealTime
                    ? 'bg-amber-500 text-slate-950'
                    : 'hover:bg-slate-900 text-slate-400 font-medium'
                }`}
              >
                Тест (Імітація)
              </button>
              <button
                type="button"
                onClick={() => setIsRealTime(true)}
                className={`py-2 text-[11px] rounded-lg font-semibold transition-all cursor-pointer ${
                  isRealTime
                    ? 'bg-sky-500 text-white'
                    : 'hover:bg-slate-900 text-slate-400 font-medium'
                }`}
              >
                Реальний час
              </button>
            </div>
          </div>

          {/* User selector for real-time mode */}
          {isRealTime && (
            <div className="space-y-3 mb-6 animate-fadeIn">
              <span className="text-xs font-semibold text-slate-400 tracking-wider uppercase block">Оберіть користувача CRM</span>
              <select
                value={selectedUser ? selectedUser.telegramId || selectedUser.id : ''}
                onChange={(e) => {
                  const u = usersList.find(x => String(x.telegramId || x.id) === e.target.value);
                  setSelectedUser(u || null);
                }}
                className="w-full bg-slate-950 text-slate-200 border border-slate-800 rounded-lg p-2.5 text-xs focus:outline-none focus:border-sky-500"
              >
                <option value="">-- Виберіть користувача --</option>
                {usersList.map((u) => (
                  <option key={u.telegramId || u.id} value={u.telegramId || u.id}>
                    {u.username ? `${u.username} (${u.status})` : `ID: ${u.telegramId} (${u.status})`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* User Subscription Status Switch */}
          <div className="space-y-3 mb-6">
            <span className="text-xs font-semibold text-slate-400 tracking-wider uppercase block">
              {isRealTime ? 'Змінити статус підписки' : 'Тестовий статус підписки'}
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button 
                onClick={() => handleStatusChange('free')}
                className={`py-2 px-3 text-xs rounded-lg font-medium transition-all cursor-pointer ${
                  userStatus === 'free' 
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500' 
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-transparent'
                }`}
              >
                Безкоштовно (Free)
              </button>
              <button 
                onClick={() => handleStatusChange('base')}
                className={`py-2 px-3 text-xs rounded-lg font-medium transition-all cursor-pointer ${
                  userStatus === 'base' 
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500' 
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-transparent'
                }`}
              >
                Базовий (Base)
              </button>
              <button 
                onClick={() => handleStatusChange('support')}
                className={`py-2 px-3 text-xs rounded-lg font-medium transition-all cursor-pointer ${
                  userStatus === 'support' 
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500' 
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-transparent'
                }`}
              >
                Супровід (Support)
              </button>
              <button 
                onClick={() => handleStatusChange('vip')}
                className={`py-2 px-3 text-xs rounded-lg font-medium transition-all cursor-pointer ${
                  userStatus === 'vip' 
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500' 
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-transparent'
                }`}
              >
                VIP Супровід
              </button>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-800 text-xs text-slate-400 flex items-start gap-2">
              <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <p>
                {isRealTime 
                  ? 'Зміна статусу оновлює інформацію про користувача в базі даних та відкриває доступ.'
                  : 'Зміна статусу імітує оплату від користувача і миттєво відкриває доступ до занять.'}
              </p>
            </div>
          </div>

          {/* Lesson Broadcast Trigger */}
          <div className="space-y-3 mb-6">
            <span className="text-xs font-semibold text-slate-400 tracking-wider uppercase block">
              {isRealTime ? 'Надіслати день занять' : 'Емуляція занять (Клік = Надіслати)'}
            </span>
            <div className="grid grid-cols-4 gap-1.5">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((day) => (
                <button
                  key={day}
                  onClick={() => handleDaySelect(day)}
                  className={`py-1.5 text-xs rounded-md font-semibold transition-all border cursor-pointer ${
                    currentDay === day && userStatus !== 'free'
                      ? 'bg-amber-500 text-slate-950 border-amber-500'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                  }`}
                >
                  День {day}
                </button>
              ))}
            </div>
          </div>

          {/* Quick Shortcuts */}
          <div className="space-y-2 mb-4">
            <span className="text-xs font-semibold text-slate-400 tracking-wider uppercase block">Швидкі команди</span>
            <div className="flex gap-2">
              <button
                onClick={() => { setInputText('/start'); }}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-1.5 px-2 rounded-lg text-xs font-mono border border-slate-700 transition-all text-center cursor-pointer"
              >
                /start
              </button>
              <button
                onClick={() => { setInputText('/help'); }}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-1.5 px-2 rounded-lg text-xs font-mono border border-slate-700 transition-all text-center cursor-pointer"
              >
                /help
              </button>
            </div>
          </div>
        </div>

        <button
          onClick={resetChat}
          className="w-full bg-slate-800 hover:bg-rose-950 hover:text-rose-200 hover:border-rose-900 border border-slate-700 text-slate-400 font-medium py-2 px-4 rounded-lg text-xs transition-all flex items-center justify-center gap-1 cursor-pointer"
        >
          <RefreshCw className="w-3 h-3" />
          Скинути історію чату
        </button>
      </div>

      {/* Main Telegram Chat Window */}
      <div id="telegram-chat-window" className="lg:col-span-3 bg-slate-950 border border-slate-800 rounded-xl flex flex-col justify-between overflow-hidden shadow-2xl relative">
        {/* Telegram Header */}
        <div className="bg-[#17212b] border-b border-slate-800 px-4 py-3 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-amber-600 to-amber-400 flex items-center justify-center text-slate-950 font-display font-bold text-base shadow-md">
              {isRealTime && selectedUser ? (selectedUser.username ? selectedUser.username.substring(1, 3).toUpperCase() : 'КП') : 'ТП'}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h4 className="font-sans font-semibold text-sm text-white">
                  {isRealTime && selectedUser 
                    ? (selectedUser.username || `Користувач ID: ${selectedUser.telegramId}`) 
                    : 'Точка переходу | Практикум'}
                </h4>
                {isRealTime && <Bot className="w-3.5 h-3.5 text-sky-400" />}
              </div>
              <span className={`text-[11px] font-medium ${isRealTime ? 'text-sky-400' : 'text-emerald-400 animate-pulse'}`}>
                {isRealTime ? 'діалог в реальному часі' : 'онлайн-симуляція'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3 text-slate-400 text-xs font-mono bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">
            <span>Захист:</span>
            <span className="text-emerald-400 font-semibold flex items-center gap-1">АКТИВНИЙ <Check className="w-3.5 h-3.5" /></span>
          </div>
        </div>

        {/* Message Panel */}
        <div className="flex-1 overflow-y-auto p-4 tg-chat-bg space-y-4">
          <AnimatePresence initial={false}>
            {messages.map((msg) => {
              if (msg.sender === 'system') {
                return (
                  <div key={msg.id} className="flex justify-center my-2">
                    <span className="bg-[#17212b]/90 text-slate-300 text-[11px] px-3 py-1.5 rounded-full border border-slate-800/50 shadow text-center max-w-[85%] font-medium">
                      {msg.text}
                    </span>
                  </div>
                );
              }

              const isBot = msg.sender === 'bot';

              return (
                <motion.div
                  key={msg.id}
                  layoutId={msg.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`flex ${isBot ? 'justify-start' : 'justify-end'} relative`}
                >
                  {/* Bot Logo in Chat */}
                  {isBot && (
                    <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 text-amber-500 flex items-center justify-center text-[10px] font-bold absolute -left-1 bottom-0 z-10 shadow">
                      AP
                    </div>
                  )}

                  <div className={`max-w-[80%] lg:max-w-[70%] rounded-2xl p-3 shadow-lg ${
                    isBot 
                      ? 'bg-[#182533] text-slate-100 rounded-bl-none ml-8 border border-slate-800/80' 
                      : 'bg-[#2b5278] text-white rounded-br-none border border-sky-900/50'
                  }`}>
                    
                    {/* Media renderers */}
                    {msg.mediaType === 'success' && (
                      <div className="mb-3 bg-slate-900/50 rounded-xl p-3 border border-emerald-500/30 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                          <CheckCheck className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="text-[10px] font-semibold text-emerald-400 tracking-wider uppercase block">Оплату підтверджено</span>
                          <span className="text-xs text-slate-300 font-medium">Преміум-матеріали розблоковано</span>
                        </div>
                      </div>
                    )}

                    {/* Rich text message */}
                    <div 
                      className="text-xs lg:text-[13px] leading-relaxed whitespace-pre-wrap select-text selection:bg-amber-500 selection:text-slate-900"
                      dangerouslySetInnerHTML={{ __html: msg.text }}
                    />

                    {/* Audio Player Card */}
                    {msg.mediaType === 'audio' && (
                      <div className="mt-3 bg-slate-900/60 rounded-xl p-3 border border-slate-800 flex items-center gap-3 select-none">
                        <button 
                          type="button"
                          onClick={() => toggleAudio(msg.id)}
                          className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all cursor-pointer ${
                            activeAudioId === msg.id 
                              ? 'bg-amber-500 text-slate-900 hover:bg-amber-400' 
                              : 'bg-slate-800 text-slate-100 hover:bg-slate-700'
                          }`}
                        >
                          {activeAudioId === msg.id ? (
                            <Pause className="w-4 h-4 fill-current" />
                          ) : (
                            <Play className="w-4 h-4 fill-current ml-0.5" />
                          )}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[11px] font-semibold text-white truncate">{msg.mediaTitle}</span>
                            <span className="text-[9px] text-slate-400 font-mono">12:40</span>
                          </div>
                          {/* Progress bar */}
                          <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-amber-500 transition-all duration-300"
                              style={{ width: `${audioProgress[msg.id] || 0}%` }}
                            />
                          </div>
                          <span className="text-[9px] text-slate-400 block mt-1 truncate">{msg.mediaSubtitle}</span>
                        </div>
                      </div>
                    )}

                    {/* Photo Card */}
                    {msg.mediaType === 'photo' && (
                      <div className="mt-3 bg-slate-900/75 rounded-xl border border-slate-800 overflow-hidden">
                        <div className="aspect-video w-full bg-slate-900 flex flex-col items-center justify-center relative border-b border-slate-800/50">
                          <div className="absolute inset-0 bg-gradient-to-tr from-amber-950/20 to-slate-950 flex items-center justify-center">
                            <Sparkles className="w-8 h-8 text-amber-500/40 animate-pulse" />
                          </div>
                          <span className="text-[10px] text-slate-400 z-10 font-mono bg-slate-950 px-2 py-0.5 rounded-full border border-slate-800">
                            🖼 Зображення дня
                          </span>
                        </div>
                        <div className="p-2 flex items-center justify-between">
                          <span className="text-[10px] font-mono text-slate-400 shrink-0 truncate max-w-[180px]">file_id: {msg.photoFileId?.substring(0, 15)}...</span>
                        </div>
                      </div>
                    )}

                    {/* Video Card */}
                    {msg.mediaType === 'video' && (
                      <div className="mt-3 bg-slate-900/70 rounded-xl border border-slate-800 overflow-hidden">
                        <div className="aspect-video w-full bg-slate-900 flex flex-col items-center justify-center relative border-b border-slate-800/50">
                          <div className="w-12 h-12 rounded-full bg-slate-950/80 text-amber-500 border border-slate-800 flex items-center justify-center hover:scale-105 transition-all cursor-pointer">
                            <Play className="w-5 h-5 fill-current ml-0.5" />
                          </div>
                          <span className="text-[10px] text-slate-400 mt-2 font-mono bg-slate-950 px-2 py-0.5 rounded-full border border-slate-800">
                            Vite Video Stream Player
                          </span>
                        </div>
                        <div className="p-2 flex items-center justify-between">
                          <span className="text-[10px] font-mono text-slate-400 shrink-0 truncate max-w-[180px]">file_id: {msg.videoFileId?.substring(0, 15)}...</span>
                          <span className="text-[10px] text-amber-400 font-medium flex items-center gap-1"><Sparkles className="w-3 h-3" /> 1080p Ultra</span>
                        </div>
                      </div>
                    )}

                    {/* PDF Card */}
                    {msg.mediaType === 'pdf' && (
                      <div className="mt-3 bg-slate-900/60 rounded-xl p-3 border border-slate-800 flex items-center justify-between select-none">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-9 h-9 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center shrink-0 border border-rose-500/20">
                            <FileText className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <span className="text-[11px] font-semibold text-white block truncate">{msg.mediaTitle}</span>
                            <span className="text-[9px] text-slate-400 block">{msg.mediaSubtitle || 'Завдання в PDF'} • 1.4 MB</span>
                          </div>
                        </div>
                        <button type="button" className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer">
                          <Download className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    {/* Buttons under message */}
                    {msg.buttons && msg.buttons.length > 0 && (
                      <div className="mt-4 space-y-2 select-none">
                        {msg.buttons.map((btn, bIdx) => (
                          <button
                            key={bIdx}
                            type="button"
                            onClick={() => {
                              if (btn.url) {
                                window.open(btn.url, '_blank');
                              } else {
                                handleButtonAction(btn.action, msg.id);
                              }
                            }}
                            className={`w-full text-center py-2.5 px-3 rounded-xl text-xs font-semibold transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer ${
                              btn.isWebApp
                                ? 'bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white shadow-md border border-sky-400/20'
                                : btn.action.startsWith('buy_')
                                ? 'bg-slate-900 hover:bg-slate-850 text-slate-100 hover:text-white border border-slate-700 hover:border-slate-600'
                                : 'bg-[#1e2c3a] hover:bg-[#253648] text-sky-400 border border-sky-500/10'
                            }`}
                          >
                            {btn.isWebApp && <Globe className="w-3.5 h-3.5 animate-pulse" />}
                            {btn.action.startsWith('buy_') && <CreditCard className="w-3.5 h-3.5 text-amber-500" />}
                            {btn.text}
                            <ChevronRight className="w-3.5 h-3.5 shrink-0 opacity-50" />
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Protection watermark */}
                    {msg.protectContent && (
                      <div className="mt-2 pt-1 border-t border-slate-800/40 flex items-center justify-between text-[8px] text-slate-500 font-mono">
                        <span>🔒 Копіювання заборонено (protect_content)</span>
                        <span>AP_SEC_V3</span>
                      </div>
                    )}

                    {/* Message metadata */}
                    <div className="flex justify-end items-center gap-1 mt-1 text-[9px] text-slate-400">
                      <span>{msg.timestamp}</span>
                      {isBot ? null : <CheckCheck className="w-3.5 h-3.5 text-sky-400" />}
                    </div>

                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
          <div ref={chatEndRef} />
        </div>

        {/* Telegram Input Bar */}
        <form onSubmit={handleSendMessage} className="bg-[#17212b] border-t border-slate-800 px-4 py-3 flex items-center gap-3">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Введіть повідомлення або команду (напр. /start, /help)..."
            className="flex-1 bg-[#0f1721] text-slate-100 placeholder-slate-400 rounded-xl px-4 py-2.5 text-xs lg:text-[13px] border border-slate-800 focus:outline-none focus:border-sky-500 transition-all font-sans"
          />
          <button
            type="submit"
            className="w-9 h-9 rounded-full bg-sky-500 hover:bg-sky-600 text-white flex items-center justify-center shrink-0 transition-all hover:scale-105 cursor-pointer"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>

        {/* WebApp Simulation Iframe Modal */}
        {showWebPage && (
          <div className="absolute inset-0 bg-slate-950/80 flex flex-col justify-end z-50">
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              className="bg-[#182026] w-full h-[90%] rounded-t-2xl flex flex-col overflow-hidden shadow-2xl border-t border-slate-800"
            >
              <div className="bg-[#1c262f] px-4 py-3 flex items-center justify-between border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-sky-400" />
                  <span className="text-xs font-semibold text-slate-100">Telegram WebApp — www.tonypashko.com</span>
                </div>
                <button 
                  type="button"
                  onClick={() => setShowWebPage(false)}
                  className="text-slate-400 hover:text-white text-xs font-semibold px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 transition-all cursor-pointer"
                >
                  Закрити
                </button>
              </div>

              {/* Simulated Landing Page inside the WebApp */}
              <div className="flex-1 overflow-y-auto p-5 space-y-6 text-slate-300">
                <div className="text-center space-y-2">
                  <span className="bg-amber-500/20 text-amber-400 text-[10px] px-2.5 py-1 rounded-full font-semibold uppercase tracking-wider">
                    7+1 денний практикум
                  </span>
                  <h2 className="font-display font-bold text-2xl text-white">Точка переходу</h2>
                  <p className="text-xs text-slate-400 italic">Антоніна Пашко • Психолог, Коуч та Енергопрактик</p>
                </div>

                <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 text-xs leading-relaxed space-y-2">
                  <p className="font-medium text-white">Для кого цей курс?</p>
                  <p>Для жінок, у яких зовні все ніби добре, але всередині все частіше з'являється чесне відчуття: <b>так більше не хочу</b>.</p>
                  <p>Це не криза. Це твоя точка переходу. Зупинка і чесна розмова із собою.</p>
                </div>

                <div className="space-y-3">
                  <h4 className="font-semibold text-xs text-slate-400 uppercase tracking-wider">Пакети участі</h4>
                  
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-sm text-white">Самостійно (Базовий)</span>
                      <span className="text-sm font-bold text-amber-400">20€</span>
                    </div>
                    <p className="text-[11px] text-slate-400">8 відео-уроків, 8 аудіо-практик, робочий зошит, доступ назавжди.</p>
                    <button 
                      type="button"
                      onClick={() => { simulatePaymentSuccess('base'); setShowWebPage(false); }}
                      className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold py-2 rounded-lg text-xs transition-all cursor-pointer"
                    >
                      Оплатити 20€
                    </button>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-sm text-white">Зі спікером (Супровід)</span>
                      <span className="text-sm font-bold text-cyan-400">125€</span>
                    </div>
                    <p className="text-[11px] text-slate-400">Telegram-група, розбори запитів, відповіді від Антоніни, 1 Zoom сесія.</p>
                    <button 
                      type="button"
                      onClick={() => { simulatePaymentSuccess('support'); setShowWebPage(false); }}
                      className="w-full bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-bold py-2 rounded-lg text-xs transition-all cursor-pointer"
                    >
                      Оплатити 125€
                    </button>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-sm text-white">Індивідуально (VIP)</span>
                      <span className="text-sm font-bold text-purple-400">400€</span>
                    </div>
                    <p className="text-[11px] text-slate-400">4 особисті сесії в Zoom, підтримка в чаті 24/7, індивідуальна карта.</p>
                    <button 
                      type="button"
                      onClick={() => { simulatePaymentSuccess('vip'); setShowWebPage(false); }}
                      className="w-full bg-purple-500 hover:bg-purple-600 text-white font-bold py-2 rounded-lg text-xs transition-all cursor-pointer"
                    >
                      Оплатити 400€
                    </button>
                  </div>
                </div>

                <div className="text-center text-[10px] text-slate-500 pb-4">
                  © 2026 · Точка переходу · Усі права захищено
                </div>
              </div>
            </motion.div>
          </div>
        )}

      </div>
    </div>
  );
}

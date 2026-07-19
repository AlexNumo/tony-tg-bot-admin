import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { lessonsData as initialLessons } from './src/data/lessonsData';

dotenv.config();

// Ensure TELEGRAM_BOT_TOKEN is loaded even if named BOT_TOKEN in .env
if (!process.env.TELEGRAM_BOT_TOKEN && process.env.BOT_TOKEN) {
  process.env.TELEGRAM_BOT_TOKEN = process.env.BOT_TOKEN;
}

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize Supabase Client
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY || '';

const hasSupabase = !!(supabaseUrl && supabaseSecretKey);
const supabase = hasSupabase ? createClient(supabaseUrl, supabaseSecretKey) : null;

// Default / fallback data to use if Supabase tables are not yet created or keys are missing
const defaultUsers = [
  { user_id: 621401924, username: '@olena_koval', phone: '+380671112233', status: 'vip', join_date: '2026-06-25T14:22:00Z', current_day: 7, last_active: 'Сьогодні, 14:22' },
  { user_id: 784012541, username: '@mariya_shvets', phone: '+380502223344', status: 'support', join_date: '2026-06-28T15:10:00Z', current_day: 4, last_active: 'Сьогодні, 15:10' },
  { user_id: 982144211, username: '@kateryna_p', phone: '+385112223334', status: 'base', join_date: '2026-07-01T21:05:00Z', current_day: 2, last_active: 'Вчора, 21:05' },
  { user_id: 412054211, username: '@tetiana_b', phone: '+380934445566', status: 'free', join_date: '2026-07-02T15:58:00Z', current_day: 1, last_active: 'Сьогодні, 15:58' },
  { user_id: 542104921, username: '@iryna_melnyk', phone: '+380975556677', status: 'free', join_date: '2026-06-30T09:00:00Z', current_day: 1, last_active: '3 дні тому' },
  { user_id: 321045922, username: '@natalia_k', phone: '+380996667788', status: 'base', join_date: '2026-06-29T09:30:00Z', current_day: 3, last_active: 'Вчора, 09:30' },
  { user_id: 891045211, username: '@svitlana_r', phone: '+380637778899', status: 'support', join_date: '2026-06-24T11:15:00Z', current_day: 8, last_active: 'Сьогодні, 11:15' }
];

const defaultPackages = [
  { id: 'base', name: 'Базовий', tag: 'Самостійно', desc_text: 'Повне самостійне проходження у своєму темпі.', price: '20€', old_price: '100€', features: '8 відео-уроків, 8 аудіопрактик, робочий зошит, доступ назавжди', available_places: null },
  { id: 'support', name: 'Супровід', tag: 'Зі спікером', desc_text: 'Все з базового пакета + живий контакт.', price: '125€', old_price: '200€', features: 'Telegram-група з учасницями, голосові відповіді від Антоніни, 1 особиста сесія в Zoom', available_places: 5 },
  { id: 'vip', name: 'VIP', tag: 'Індивідуально', desc_text: 'Все з пакета Супровід.', price: '400€', old_price: '600€', features: '4 особисті сесії в Zoom, особистий супровід 24/7', available_places: 2 }
];

const defaultLeads = [
  { id: 1, user_id: 621401924, package_name: 'vip', status: 'success', created_at: '2026-06-25T14:15:00Z' },
  { id: 2, user_id: 784012541, package_name: 'support', status: 'success', created_at: '2026-06-28T15:00:00Z' }
];

const defaultTestResults = [
  { id: 1, user_id: 982144211, score: 5, created_at: '2026-07-01T21:10:00Z' },
  { id: 2, user_id: 412054211, score: 6, created_at: '2026-07-02T16:05:00Z' }
];

// Helper to determine if table has issue
let tableIssues = {
  users: false,
  packages: false,
  leads: false,
  test_results: false,
  messages: false
};

// API Endpoint: Get Supabase status
app.get('/api/supabase-status', (req, res) => {
  res.json({
    connected: hasSupabase,
    url: supabaseUrl ? `${supabaseUrl.substring(0, 15)}...` : null,
    issues: tableIssues
  });
});

// Helper to send notifications to Antonina's admin bot
async function sendAdminNotification(text: string) {
  const adminBotToken = process.env.ADMIN_BOT_TOKEN;
  const adminIds = [7780694746, 216147493];
  
  if (!adminBotToken) return;
  
  for (const adminId of adminIds) {
    try {
      await fetch(`https://api.telegram.org/bot${adminBotToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: adminId,
          text: text,
          parse_mode: 'HTML'
        })
      });
    } catch (err: any) {
      console.error(`Failed to send admin notification to ${adminId} from server:`, err.message);
    }
  }
}

// Helper to push logs to Google Sheets via Webhook
async function logToGoogleSheet(logType: 'Messages' | 'Actions' | 'Progress' | 'Leads', data: any) {
  const webhookUrl = process.env.GOOGLE_SHEET_WEBHOOK_URL;
  if (!webhookUrl) return;
  
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        logType,
        ...data
      })
    });
  } catch (err: any) {
    console.error('Failed to log to Google Sheets:', err.message);
  }
}

// Local storage helpers to bypass missing current_day and last_active columns in database
const PROGRESS_FILE_PATH = path.join(process.cwd(), 'src/data/user_progress.json');

// Translate entire database to local files when USE_LOCAL_DB is true
const USE_LOCAL_DB = process.env.USE_LOCAL_DB === 'true';
const USERS_FILE_PATH = path.join(process.cwd(), 'src/data/users.json');
const LEADS_FILE_PATH = path.join(process.cwd(), 'src/data/leads.json');
const TEST_RESULTS_FILE_PATH = path.join(process.cwd(), 'src/data/test_results.json');
const PROGRESS_LOGS_FILE_PATH = path.join(process.cwd(), 'src/data/course_progress_logs.json');
const USER_ACTIONS_FILE_PATH = path.join(process.cwd(), 'src/data/user_actions.json');

function readProgressLogs(): any[] {
  try {
    if (fs.existsSync(PROGRESS_LOGS_FILE_PATH)) {
      return JSON.parse(fs.readFileSync(PROGRESS_LOGS_FILE_PATH, 'utf-8'));
    }
  } catch (err) {
    console.error('Error reading progress logs:', err);
  }
  return [];
}

function writeProgressLogs(logs: any[]) {
  try {
    const dir = path.dirname(PROGRESS_LOGS_FILE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(PROGRESS_LOGS_FILE_PATH, JSON.stringify(logs, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing progress logs:', err);
  }
}

function readUserActions(): any[] {
  try {
    if (fs.existsSync(USER_ACTIONS_FILE_PATH)) {
      return JSON.parse(fs.readFileSync(USER_ACTIONS_FILE_PATH, 'utf-8'));
    }
  } catch (err) {
    console.error('Error reading user actions file:', err);
  }
  return [];
}

function writeUserActions(actions: any[]) {
  try {
    const dir = path.dirname(USER_ACTIONS_FILE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(USER_ACTIONS_FILE_PATH, JSON.stringify(actions, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing user actions file:', err);
  }
}

function readLocalUsers(): any[] {
  try {
    if (fs.existsSync(USERS_FILE_PATH)) {
      const data = fs.readFileSync(USERS_FILE_PATH, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error reading users file:', err);
  }
  return defaultUsers;
}

function writeLocalUsers(users: any[]) {
  try {
    const dir = path.dirname(USERS_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(USERS_FILE_PATH, JSON.stringify(users, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing users file:', err);
  }
}

function readLocalLeads(): any[] {
  try {
    if (fs.existsSync(LEADS_FILE_PATH)) {
      const data = fs.readFileSync(LEADS_FILE_PATH, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error reading leads file:', err);
  }
  return [];
}

function writeLocalLeads(leads: any[]) {
  try {
    const dir = path.dirname(LEADS_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(LEADS_FILE_PATH, JSON.stringify(leads, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing leads file:', err);
  }
}

function readLocalTestResults(): any[] {
  try {
    if (fs.existsSync(TEST_RESULTS_FILE_PATH)) {
      const data = fs.readFileSync(TEST_RESULTS_FILE_PATH, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error reading test results file:', err);
  }
  return [];
}

function writeLocalTestResults(results: any[]) {
  try {
    const dir = path.dirname(TEST_RESULTS_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(TEST_RESULTS_FILE_PATH, JSON.stringify(results, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing test results file:', err);
  }
}

interface UserProgress {
  current_day: number;
  last_active: string;
}

interface ProgressStore {
  [userId: string]: UserProgress;
}

function readProgress(): ProgressStore {
  try {
    if (fs.existsSync(PROGRESS_FILE_PATH)) {
      const data = fs.readFileSync(PROGRESS_FILE_PATH, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error reading progress file:', err);
  }
  return {};
}

function writeProgress(userId: string, currentDay: number, lastActive: string) {
  try {
    const store = readProgress();
    store[userId] = {
      current_day: currentDay,
      last_active: lastActive
    };
    const dir = path.dirname(PROGRESS_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(PROGRESS_FILE_PATH, JSON.stringify(store, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing progress file:', err);
  }
}

// API Endpoint: Get Users
app.get('/api/users', async (req, res) => {
  if (USE_LOCAL_DB || !supabase) {
    const localUsers = readLocalUsers();
    const progressStore = readProgress();
    const mappedUsers = localUsers.map((u: any) => {
      const uId = String(u.user_id || u.telegramId || u.id);
      const localProg = (progressStore[uId] || {}) as any;
      return {
        id: uId,
        telegramId: uId,
        username: u.username || `@user_${uId}`,
        phone: u.phone || '',
        status: u.status || 'free',
        joinDate: u.join_date ? u.join_date.split('T')[0] : (u.joinDate || new Date().toISOString().split('T')[0]),
        currentDay: localProg.current_day !== undefined ? Number(localProg.current_day) : (u.current_day !== undefined ? Number(u.current_day) : (u.currentDay || 1)),
        lastActive: localProg.last_active || u.last_active || u.lastActive || 'Сьогодні',
        firstName: u.first_name || u.firstName || '',
        lastName: u.last_name || u.lastName || '',
        avatarUrl: u.avatar_url || u.avatarUrl || '',
        utmSource: u.utm_source || u.utmSource || '',
        utmMedium: u.utm_medium || u.utmMedium || '',
        isBlocked: u.is_blocked !== undefined ? u.is_blocked : (u.isBlocked || false)
      };
    });
    return res.json({ success: true, data: mappedUsers, source: 'local' });
  }

  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('join_date', { ascending: false });

    if (error) {
      console.error('Supabase error fetching users:', error.message);
      tableIssues.users = true;
      return res.json({ success: true, data: defaultUsers, source: 'fallback', error: error.message });
    }

    tableIssues.users = false;
    const progressStore = readProgress();

    // Map db columns to fit frontend structure
    const mappedUsers = data.map((u: any) => {
      const uId = String(u.user_id);
      const localProg = (progressStore[uId] || {}) as any;
      return {
        id: uId,
        telegramId: uId,
        username: u.username || `@user_${u.user_id}`,
        phone: u.phone || '',
        status: u.status || 'free',
        joinDate: u.join_date ? u.join_date.split('T')[0] : new Date().toISOString().split('T')[0],
        currentDay: localProg.current_day !== undefined ? Number(localProg.current_day) : (u.current_day !== undefined ? Number(u.current_day) : 1),
        lastActive: localProg.last_active || u.last_active || 'Сьогодні',
        firstName: u.first_name || '',
        lastName: u.last_name || '',
        avatarUrl: u.avatar_url || '',
        utmSource: u.utm_source || '',
        utmMedium: u.utm_medium || '',
        isBlocked: u.is_blocked || false
      };
    });

    res.json({ success: true, data: mappedUsers, source: 'database' });
  } catch (err: any) {
    tableIssues.users = true;
    res.json({ success: true, data: defaultUsers, source: 'fallback', error: err.message });
  }
});

// API Endpoint: Create User
app.post('/api/users', async (req, res) => {
  const { telegramId, username, phone, status, currentDay, firstName, lastName, avatarUrl, utmSource, utmMedium, isBlocked } = req.body;
  const user_id = parseInt(telegramId);
  
  if (isNaN(user_id)) {
    return res.status(400).json({ success: false, error: 'Некоректний Telegram ID' });
  }

  const join_date = new Date().toISOString();
  const last_active = 'Сьогодні, щойно';

  // Save user progress locally (preserve existing current_day if already set)
  const progressStore = readProgress();
  const existingDay = progressStore[String(user_id)]?.current_day;
  const targetDay = (currentDay !== undefined && currentDay !== null && currentDay !== '') ? Number(currentDay) : (existingDay || 1);
  writeProgress(String(user_id), targetDay, last_active);

  if (USE_LOCAL_DB || !supabase) {
    const localUsers = readLocalUsers();
    let user = localUsers.find((u: any) => String(u.user_id || u.telegramId || u.id) === String(user_id));
    if (user) {
      if (username !== undefined) user.username = username;
      if (phone !== undefined && phone !== null && phone !== '') user.phone = phone;
      if (status !== undefined && (status !== 'free' || !user.status || user.status === 'free')) user.status = status;
      if (firstName !== undefined) user.first_name = firstName;
      if (lastName !== undefined) user.last_name = lastName;
      if (avatarUrl !== undefined) user.avatar_url = avatarUrl;
      if (utmSource !== undefined) user.utm_source = utmSource;
      if (utmMedium !== undefined) user.utm_medium = utmMedium;
      if (isBlocked !== undefined) user.is_blocked = isBlocked;
      user.current_day = targetDay;
    } else {
      user = {
        user_id,
        telegramId: String(user_id),
        username: username || `@user_${user_id}`,
        phone: phone || '',
        status: status || 'free',
        first_name: firstName || '',
        last_name: lastName || '',
        avatar_url: avatarUrl || '',
        utm_source: utmSource || '',
        utm_medium: utmMedium || '',
        is_blocked: isBlocked || false,
        join_date,
        current_day: targetDay,
        last_active
      };
      localUsers.push(user);
    }
    writeLocalUsers(localUsers);
    return res.json({ success: true, data: user, source: 'local' });
  }

  try {
    let finalStatus = status || 'free';
    let finalPhone = phone || null;

    // Check existing user in Supabase to avoid overwriting paid status or phone
    const { data: existingUser } = await supabase
      .from('users')
      .select('status, phone, join_date')
      .eq('user_id', user_id)
      .maybeSingle();

    if (existingUser) {
      if (existingUser.status && existingUser.status !== 'free' && (!status || status === 'free')) {
        finalStatus = existingUser.status;
      }
      if (existingUser.phone && (!phone || phone.trim() === '')) {
        finalPhone = existingUser.phone;
      }
    }

    const { data, error } = await supabase
      .from('users')
      .upsert({
        user_id,
        username,
        phone: finalPhone,
        status: finalStatus,
        first_name: firstName || null,
        last_name: lastName || null,
        avatar_url: avatarUrl || null,
        utm_source: utmSource || null,
        utm_medium: utmMedium || null,
        is_blocked: isBlocked || false,
        join_date: existingUser?.join_date || join_date
      }, { onConflict: 'user_id' })
      .select();

    if (error) {
      console.error('Supabase error saving user:', error.message);
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// API Endpoint: Update User Status
app.put('/api/users/:telegramId/status', async (req, res) => {
  const { telegramId } = req.params;
  const { status } = req.body;
  const user_id = parseInt(telegramId);

  if (isNaN(user_id)) {
    return res.status(400).json({ success: false, error: 'Некоректний Telegram ID' });
  }

  const last_active = 'Сьогодні, щойно';
  const progressStore = readProgress();
  const currentDay = progressStore[String(user_id)]?.current_day || 1;
  writeProgress(String(user_id), currentDay, last_active);

  if (USE_LOCAL_DB || !supabase) {
    const localUsers = readLocalUsers();
    const user = localUsers.find((u: any) => String(u.user_id || u.telegramId || u.id) === String(user_id));
    if (user) {
      const oldStatus = user.status || 'free';
      user.status = status;
      writeLocalUsers(localUsers);
      if (status !== 'free' && oldStatus === 'free') {
        const usernameStr = user.username || '';
        const userLink = usernameStr ? `https://t.me/${usernameStr.replace('@', '')}` : `tg://user?id=${user_id}`;
        const userDisplayName = user.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : `@user_${user_id}`;
        sendAdminNotification(
          `🎉 <b>Активовано тариф (локально)!</b>\n\n` +
          `👤 <b>Ім'я:</b> ${userDisplayName}\n` +
          `⭐ <b>Новий статус:</b> <code>${status}</code>\n\n` +
          `👉 <a href="${userLink}"><b>ВІДКРИТИ ДІАЛОГ З КОРИСТУВАЧЕМ</b></a>`
        );
        sendPurchaseMaterials(user_id).catch(err => console.error("Error sending materials:", err.message));
      }
    }
    return res.json({ success: true, message: 'Статус оновлено локально' });
  }

  try {
    // Отримуємо поточний статус користувача перед оновленням
    const { data: userProfileBefore } = await supabase
      .from('users')
      .select('status')
      .eq('user_id', user_id)
      .maybeSingle();

    const { data, error } = await supabase
      .from('users')
      .update({ status })
      .eq('user_id', user_id);

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    const oldStatus = userProfileBefore?.status || 'free';
    if (status !== 'free' && oldStatus === 'free') {
      const { data: userProfile } = await supabase
        .from('users')
        .select('username, first_name, last_name')
        .eq('user_id', user_id)
        .maybeSingle();

      const usernameStr = userProfile?.username || '';
      const firstNameStr = userProfile?.first_name || '';
      const lastNameStr = userProfile?.last_name || '';
      const userLink = usernameStr ? `https://t.me/${usernameStr.replace('@', '')}` : `tg://user?id=${user_id}`;
      const userDisplayName = firstNameStr ? `${firstNameStr} ${lastNameStr}`.trim() : `@user_${user_id}`;

      sendAdminNotification(
        `🎉 <b>Активовано оплачений тариф!</b>\n\n` +
        `👤 <b>Ім'я:</b> ${userDisplayName}\n` +
        `⭐ <b>Новий статус:</b> <code>${status}</code>\n\n` +
        `👉 <a href="${userLink}"><b>ВІДКРИТИ ДІАЛОГ З КОРИСТУВАЧЕМ</b></a>`
      );
      
      // Надсилаємо робочі зошити та бонуси
      sendPurchaseMaterials(user_id).catch(err => console.error("Error sending purchase materials:", err.message));
    }

    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// API Endpoint: Update User Day
app.put('/api/users/:telegramId/current-day', async (req, res) => {
  const { telegramId } = req.params;
  const { currentDay } = req.body;
  const user_id = parseInt(telegramId);

  if (isNaN(user_id)) {
    return res.status(400).json({ success: false, error: 'Некоректний Telegram ID' });
  }

  const last_active = 'Сьогодні, щойно';
  writeProgress(String(user_id), currentDay || 1, last_active);

  if (USE_LOCAL_DB || !supabase) {
    const localUsers = readLocalUsers();
    const user = localUsers.find((u: any) => String(u.user_id || u.telegramId || u.id) === String(user_id));
    if (user) {
      user.current_day = currentDay || 1;
      user.last_active = last_active;
      writeLocalUsers(localUsers);
    }
    return res.json({ success: true, message: 'Прогрес оновлено локально' });
  }

  try {
    res.json({ success: true, message: 'Прогрес успішно оновлено у локальному кеші' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// API Endpoint: Delete User
app.delete('/api/users/:telegramId', async (req, res) => {
  const { telegramId } = req.params;
  const user_id = parseInt(telegramId);

  if (isNaN(user_id)) {
    return res.status(400).json({ success: false, error: 'Некоректний Telegram ID' });
  }

  if (USE_LOCAL_DB || !supabase) {
    const localUsers = readLocalUsers();
    const filtered = localUsers.filter((u: any) => String(u.user_id || u.telegramId || u.id) !== String(user_id));
    writeLocalUsers(filtered);
    // Also remove from progress store
    try {
      const store = readProgress();
      delete store[String(user_id)];
      fs.writeFileSync(PROGRESS_FILE_PATH, JSON.stringify(store, null, 2), 'utf-8');
    } catch (e) {}
    return res.json({ success: true, message: 'Видалено локально' });
  }

  try {
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('user_id', user_id);

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// API Endpoint: Get Packages
app.get('/api/packages', async (req, res) => {
  if (!supabase) {
    return res.json({ success: true, data: defaultPackages, source: 'fallback' });
  }

  try {
    const { data, error } = await supabase
      .from('packages')
      .select('*');

    if (error) {
      console.error('Supabase error fetching packages:', error.message);
      tableIssues.packages = true;
      return res.json({ success: true, data: defaultPackages, source: 'fallback', error: error.message });
    }

    tableIssues.packages = false;
    if (data.length === 0) {
      // Auto seed packages if table exists but empty
      try {
        await supabase.from('packages').insert(
          defaultPackages.map(pkg => ({
            id: pkg.id,
            name: pkg.name,
            tag: pkg.tag,
            desc_text: pkg.desc_text,
            price: pkg.price,
            old_price: pkg.old_price,
            features: pkg.features,
            available_places: pkg.available_places
          }))
        );
        return res.json({ success: true, data: defaultPackages, source: 'database_seeded' });
      } catch (seedErr) {
        return res.json({ success: true, data: defaultPackages, source: 'database_empty' });
      }
    }

    res.json({ success: true, data, source: 'database' });
  } catch (err: any) {
    tableIssues.packages = true;
    res.json({ success: true, data: defaultPackages, source: 'fallback', error: err.message });
  }
});

// API Endpoint: Get Leads
app.get('/api/leads', async (req, res) => {
  if (USE_LOCAL_DB || !supabase) {
    const localLeads = readLocalLeads();
    return res.json({ success: true, data: localLeads.length > 0 ? localLeads : defaultLeads, source: 'local' });
  }

  try {
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase error fetching leads:', error.message);
      tableIssues.leads = true;
      return res.json({ success: true, data: defaultLeads, source: 'fallback', error: error.message });
    }

    tableIssues.leads = false;
    res.json({ success: true, data, source: 'database' });
  } catch (err: any) {
    tableIssues.leads = true;
    res.json({ success: true, data: defaultLeads, source: 'fallback', error: err.message });
  }
});

// API Endpoint: Create Lead
app.post('/api/leads', async (req, res) => {
  const { telegramId, packageName, status } = req.body;
  const user_id = parseInt(telegramId);

  if (isNaN(user_id)) {
    return res.status(400).json({ success: false, error: 'Некоректний Telegram ID' });
  }

  if (USE_LOCAL_DB || !supabase) {
    const localLeads = readLocalLeads();
    const localUsers = readLocalUsers();
    let user = localUsers.find((u: any) => String(u.user_id || u.telegramId || u.id) === String(user_id));
    if (!user) {
      user = {
        user_id,
        telegramId: String(user_id),
        username: `@user_${user_id}`,
        status: 'free',
        join_date: new Date().toISOString()
      };
      localUsers.push(user);
      writeLocalUsers(localUsers);
      writeProgress(String(user_id), 1, 'Сьогодні, щойно');
    }

    const newLead = {
      id: localLeads.length + 1,
      user_id,
      package_name: packageName,
      status: status || 'pending',
      created_at: new Date().toISOString()
    };
    localLeads.push(newLead);
    writeLocalLeads(localLeads);
    
    logToGoogleSheet('Leads', { userId: user_id, packageName, status: newLead.status });

    if (newLead.status === 'success') {
      const userLink = `tg://user?id=${user_id}`;
      sendAdminNotification(
        `💳 <b>Отримано оплату (локально)!</b>\n\n` +
        `🆔 <b>Telegram ID:</b> <code>${user_id}</code>\n` +
        `📦 <b>Тариф:</b> <code>${packageName}</code>\n\n` +
        `👉 <a href="${userLink}"><b>ВІДКРИТИ ДІАЛОГ З КОРИСТУВАЧЕМ</b></a>`
      );
    }
    return res.json({ success: true, data: [newLead], source: 'local' });
  }

  try {
    // Ensure parent user exists to prevent foreign key constraint violation
    const { data: userExists } = await supabase
      .from('users')
      .select('user_id')
      .eq('user_id', user_id)
      .maybeSingle();

    if (!userExists) {
      await supabase
        .from('users')
        .insert({
          user_id,
          username: `@user_${user_id}`,
          status: 'free',
          join_date: new Date().toISOString()
        });
      // Initialize progress metadata locally too
      writeProgress(String(user_id), 1, 'Сьогодні, щойно');
    }

    const { data, error } = await supabase
      .from('leads')
      .insert({
        user_id,
        package_name: packageName,
        status: status || 'pending',
        created_at: new Date().toISOString()
      })
      .select();

    if (error) {
      console.error('Supabase error saving lead:', error.message);
      return res.status(500).json({ success: false, error: error.message });
    }

    logToGoogleSheet('Leads', { userId: user_id, packageName, status: status || 'pending' });

    if (status === 'success') {
      const { data: userProfile } = await supabase
        .from('users')
        .select('username, first_name, last_name, phone')
        .eq('user_id', user_id)
        .maybeSingle();

      const usernameStr = userProfile?.username || '';
      const firstNameStr = userProfile?.first_name || '';
      const lastNameStr = userProfile?.last_name || '';
      const phoneStr = userProfile?.phone || 'не вказано';
      const userLink = usernameStr ? `https://t.me/${usernameStr.replace('@', '')}` : `tg://user?id=${user_id}`;
      const userDisplayName = firstNameStr ? `${firstNameStr} ${lastNameStr}`.trim() : `@user_${user_id}`;

      sendAdminNotification(
        `💳 <b>Отримано нову оплату!</b>\n\n` +
        `👤 <b>Ім'я:</b> ${userDisplayName}\n` +
        `🆔 <b>Telegram ID:</b> <code>${user_id}</code>\n` +
        `📞 <b>Телефон:</b> ${phoneStr}\n` +
        `📦 <b>Тариф:</b> <code>${packageName}</code>\n\n` +
        `👉 <a href="${userLink}"><b>ВІДКРИТИ ДІАЛОГ З КОРИСТУВАЧЕМ</b></a>`
      );
    }

    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// API Endpoint: Get Test Results
app.get('/api/test-results', async (req, res) => {
  if (USE_LOCAL_DB || !supabase) {
    const localResults = readLocalTestResults();
    return res.json({ success: true, data: localResults.length > 0 ? localResults : defaultTestResults, source: 'local' });
  }

  try {
    const { data, error } = await supabase
      .from('test_results')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase error fetching test results:', error.message);
      tableIssues.test_results = true;
      return res.json({ success: true, data: defaultTestResults, source: 'fallback', error: error.message });
    }

    tableIssues.test_results = false;
    res.json({ success: true, data, source: 'database' });
  } catch (err: any) {
    tableIssues.test_results = true;
    res.json({ success: true, data: defaultTestResults, source: 'fallback', error: err.message });
  }
});

// API Endpoint: Create Test Result
app.post('/api/test-results', async (req, res) => {
  const { telegramId, score } = req.body;
  const user_id = parseInt(telegramId);

  if (isNaN(user_id)) {
    return res.status(400).json({ success: false, error: 'Некоректний Telegram ID' });
  }

  if (USE_LOCAL_DB || !supabase) {
    const localResults = readLocalTestResults();
    const localUsers = readLocalUsers();
    let user = localUsers.find((u: any) => String(u.user_id || u.telegramId || u.id) === String(user_id));
    if (!user) {
      user = {
        user_id,
        telegramId: String(user_id),
        username: `@user_${user_id}`,
        status: 'free',
        join_date: new Date().toISOString()
      };
      localUsers.push(user);
      writeLocalUsers(localUsers);
      writeProgress(String(user_id), 1, 'Сьогодні, щойно');
    }

    const newResult = {
      id: localResults.length + 1,
      user_id,
      score: Number(score),
      created_at: new Date().toISOString()
    };
    localResults.push(newResult);
    writeLocalTestResults(localResults);
    return res.json({ success: true, data: [newResult], source: 'local' });
  }

  try {
    // Ensure parent user exists to prevent foreign key constraint violation
    const { data: userExists } = await supabase
      .from('users')
      .select('user_id')
      .eq('user_id', user_id)
      .maybeSingle();

    if (!userExists) {
      await supabase
        .from('users')
        .insert({
          user_id,
          username: `@user_${user_id}`,
          status: 'free',
          join_date: new Date().toISOString()
        });
      // Initialize progress metadata locally too
      writeProgress(String(user_id), 1, 'Сьогодні, щойно');
    }

    const { data, error } = await supabase
      .from('test_results')
      .insert({
        user_id,
        score: Number(score),
        created_at: new Date().toISOString()
      })
      .select();

    if (error) {
      console.error('Supabase error saving test result:', error.message);
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// API Endpoint: Log User Action
app.post('/api/logs/action', async (req, res) => {
  const { telegramId, actionType, targetElement, metadata } = req.body;
  const user_id = parseInt(telegramId);
  
  if (isNaN(user_id)) {
    return res.status(400).json({ success: false, error: 'Некоректний Telegram ID' });
  }

  if (USE_LOCAL_DB || !supabase) {
    const localActions = readUserActions();
    const newAction = {
      id: localActions.length + 1,
      user_id,
      action_type: actionType,
      target_element: targetElement || '',
      created_at: new Date().toISOString(),
      metadata: metadata || {}
    };
    localActions.push(newAction);
    writeUserActions(localActions);
    logToGoogleSheet('Actions', { userId: user_id, actionType, targetElement });
    return res.json({ success: true, message: 'Дію зафіксовано локально', data: newAction });
  }

  try {
    const { data, error } = await supabase
      .from('user_actions')
      .insert({
        user_id,
        action_type: actionType,
        target_element: targetElement,
        created_at: new Date().toISOString(),
        metadata: metadata || {}
      })
      .select();

    if (error) {
      console.error('Supabase error saving action log:', error.message);
      return res.status(500).json({ success: false, error: error.message });
    }
    
    logToGoogleSheet('Actions', { userId: user_id, actionType, targetElement });
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// API Endpoint: Log Course Progress
app.post('/api/logs/progress', async (req, res) => {
  const { telegramId, dayNum, deliveryType, status, errorMessage } = req.body;
  const user_id = parseInt(telegramId);

  if (isNaN(user_id)) {
    return res.status(400).json({ success: false, error: 'Некоректний Telegram ID' });
  }

  if (USE_LOCAL_DB || !supabase) {
    const localLogs = readProgressLogs();
    const newLog = {
      id: localLogs.length + 1,
      user_id,
      day_num: Number(dayNum),
      sent_at: new Date().toISOString(),
      delivery_type: deliveryType || 'auto',
      status: status || 'delivered',
      error_message: errorMessage || null
    };
    localLogs.push(newLog);
    writeProgressLogs(localLogs);
    logToGoogleSheet('Progress', { userId: user_id, dayNum, deliveryType, status, errorMessage });
    return res.json({ success: true, message: 'Прогрес зафіксовано локально', data: newLog });
  }

  try {
    const { data, error } = await supabase
      .from('course_progress_logs')
      .insert({
        user_id,
        day_num: Number(dayNum),
        sent_at: new Date().toISOString(),
        delivery_type: deliveryType || 'auto',
        status: status || 'delivered',
        error_message: errorMessage || null
      })
      .select();

    if (error) {
      console.error('Supabase error saving progress log:', error.message);
      return res.status(500).json({ success: false, error: error.message });
    }
    logToGoogleSheet('Progress', { userId: user_id, dayNum, deliveryType, status, errorMessage });
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});


// --- TELEGRAM BOT & MESSAGES INTEGRATION ---
const MESSAGES_FILE_PATH = path.join(process.cwd(), 'src/data/user_messages.json');

interface LocalMessage {
  id: string;
  sender: 'user' | 'bot' | 'system';
  text: string;
  timestamp: string;
}

interface MessagesStore {
  [userId: string]: LocalMessage[];
}

function readMessages(): MessagesStore {
  try {
    if (fs.existsSync(MESSAGES_FILE_PATH)) {
      const data = fs.readFileSync(MESSAGES_FILE_PATH, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error reading messages file:', err);
  }
  return {};
}

function saveMessageLocally(userId: string, sender: 'user' | 'bot' | 'system', text: string) {
  try {
    const store = readMessages();
    if (!store[userId]) {
      store[userId] = [];
    }
    const newMessage: LocalMessage = {
      id: Math.random().toString(36).substring(2, 9),
      sender,
      text,
      timestamp: new Date().toISOString()
    };
    store[userId].push(newMessage);
    
    const dir = path.dirname(MESSAGES_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(MESSAGES_FILE_PATH, JSON.stringify(store, null, 2), 'utf-8');

    // Save to Supabase messages table if connected and table is active
    if (supabase && !tableIssues.messages) {
      supabase.from('messages').insert({
        user_id: parseInt(userId),
        direction: sender,
        text,
        created_at: new Date().toISOString()
      }).then(({ error }) => {
        if (error) {
          if (error.message && (error.message.includes("Could not find the table") || error.message.includes("relation \"public.messages\" does not exist"))) {
            tableIssues.messages = true;
            console.log('Supabase messages table does not exist yet. Falling back entirely to local JSON message storage.');
          } else {
            console.error('Supabase error saving message:', error.message);
          }
        }
      });
    }
    logToGoogleSheet('Messages', { userId, sender, text });
  } catch (err) {
    console.error('Error saving message locally:', err);
  }
}

// API Endpoint: Get user messages
app.get('/api/messages/:telegramId', async (req, res) => {
  const { telegramId } = req.params;
  const user_id = parseInt(telegramId);

  if (isNaN(user_id)) {
    return res.status(400).json({ success: false, error: 'Некоректний Telegram ID' });
  }

  try {
    const localStore = readMessages();
    const localMsgs = localStore[String(user_id)] || [];

    if (!supabase || tableIssues.messages) {
      return res.json({ success: true, data: localMsgs, source: 'local' });
    }

    const { data: dbMsgs, error } = await supabase
      .from('messages')
      .select('*')
      .eq('user_id', user_id)
      .order('created_at', { ascending: true });

    if (error) {
      if (error.message && (error.message.includes("Could not find the table") || error.message.includes("relation \"public.messages\" does not exist"))) {
        tableIssues.messages = true;
        console.log('Supabase messages table does not exist yet. Falling back to local JSON message storage.');
      } else {
        console.error('Supabase error fetching messages:', error.message);
      }
      return res.json({ success: true, data: localMsgs, source: 'local_fallback' });
    }

    if (dbMsgs && dbMsgs.length > 0) {
      const mappedDbMsgs = dbMsgs.map((m: any) => ({
        id: String(m.id),
        sender: m.direction === 'user' ? 'user' : 'bot',
        text: m.text,
        timestamp: m.created_at
      }));
      return res.json({ success: true, data: mappedDbMsgs, source: 'database' });
    }

    res.json({ success: true, data: localMsgs, source: 'local' });
  } catch (err: any) {
    res.json({ success: false, error: err.message });
  }
});

// API Endpoint: Save message (from user or bot) - perfect for the simulator
app.post('/api/messages/save', (req, res) => {
  const { telegramId, sender, text } = req.body;
  if (!telegramId || !sender || !text) {
    return res.status(400).json({ success: false, error: 'Некоректні параметри' });
  }
  saveMessageLocally(String(telegramId), sender, text);
  res.json({ success: true, message: 'Повідомлення успішно збережено в історію' });
});

// API Endpoint: Admin sends message to user
app.post('/api/messages', async (req, res) => {
  const { telegramId, text } = req.body;
  const user_id = parseInt(telegramId);

  if (isNaN(user_id) || !text) {
    return res.status(400).json({ success: false, error: 'Некоректні параметри' });
  }

  saveMessageLocally(String(user_id), 'bot', text);

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (token) {
    try {
      const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: user_id,
          text: text
        })
      });
      const tgData = (await tgRes.json()) as any;
      if (!tgData.ok) {
        console.error('Telegram sendMessage error:', tgData);
        return res.json({ success: true, warning: 'Повідомлення збережено локально, але не відправлено в Telegram (можливо, користувач заблокував бота)', error: tgData.description });
      }
    } catch (err: any) {
      console.error('Telegram connection error:', err.message);
      return res.json({ success: true, warning: 'Повідомлення збережено локально, але виникла помилка зв\'язку з Telegram' });
    }
  }

  res.json({ success: true, message: 'Повідомлення надіслано' });
});

// Helper: Telegram API callers
async function sendTelegramMessage(chatId: number, text: string, parseMode: string = 'HTML') {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: parseMode
      })
    });
  } catch (err) {
    console.error('Error sending message:', err);
  }
}

async function sendTelegramMessageWithKeyboard(chatId: number, text: string, replyMarkup: any, parseMode: string = 'HTML') {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        reply_markup: replyMarkup,
        parse_mode: parseMode
      })
    });
  } catch (err) {
    console.error('Error sending keyboard message:', err);
  }
}

async function sendPurchaseMaterials(userId: number) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error("TELEGRAM_BOT_TOKEN not found when trying to send purchase materials.");
    return;
  }
  
  const backendMaterialDir = path.resolve(process.cwd(), '../TonyBot_Backend/Material');
  const workbook1Path = path.join(backendMaterialDir, 'Робочий_зошит_Точка_переходу.pdf');
  const workbook2Path = path.join(backendMaterialDir, 'Робочий_зошит_Точка_переходу_2.pdf');
  const giftDir = path.join(backendMaterialDir, 'Gift');
  
  const gifts = [
    { name: '7_ОЗНАК_ЩО_ЗАСЛУГОВУЄШ_СВОЮ_ЦІННІСТЬ.pptx', type: 'document', caption: '🎁 Бонус 1: Презентація "7 ознак, що заслуговуєш свою цінність"' },
    { name: 'СИЛА без НАПРУГИ.pptx', type: 'document', caption: '🎁 Бонус 2: Презентація "Сила без напруги"' },
    { name: 'ПРАКТИКА - Медитація подарунок.m4a', type: 'audio', caption: '🎁 Бонус 3: Аудіопрактика-медитація "Повернення до себе"' }
  ];
  
  // 1. Send welcoming message
  const congratsText = `🎉 <b>Вітаємо у практикумі «Точка переходу»!</b>\n\n` +
    `Ваша оплата успішно отримана та доступ до програми активовано.\n\n` +
    `Нижче ми надсилаємо вам обіцяні матеріали: <b>два варіанти Робочого зошита</b> практикуму (оберіть той, який вам зручніше заповнювати), а також <b>3 спеціальні бонуси</b>, які допоможуть вам підготуватися та пройти цей шлях максимально комфортно і глибоко. ✨\n\n` +
    `<i>⏳ Для вашої зручності файли надходитимуть послідовно з інтервалом у 15 секунд.</i>`;
    
  await sendTelegramMessage(userId, congratsText);
  saveMessageLocally(String(userId), 'bot', congratsText);
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Helper to upload and send a file
  const sendLocalFile = async (filePath: string, type: 'document' | 'audio', caption: string) => {
    try {
      if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        return;
      }
      const fileBuffer = fs.readFileSync(filePath);
      const fileName = path.basename(filePath);
      
      const formData = new FormData();
      formData.append('chat_id', String(userId));
      formData.append(type, new Blob([fileBuffer]), fileName);
      formData.append('caption', caption);
      formData.append('protect_content', 'true');
      
      const method = type === 'document' ? 'sendDocument' : 'sendAudio';
      const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json() as any;
      if (!data.ok) {
        console.error(`Telegram API error sending ${fileName}:`, data);
      }
    } catch (err: any) {
      console.error(`Error sending local file ${filePath}:`, err.message);
    }
  };

  // 2. Send Workbook 1
  console.log(`Sending workbook 1 to user ${userId}...`);
  await sendLocalFile(workbook1Path, 'document', '📚 Робочий зошит «Точка переходу» (Варіант 1)\n\nТвій особистий простір для роздумів, відкриттів та чесної розмови із собою.');
  saveMessageLocally(String(userId), 'bot', '[Надіслано Робочий зошит PDF (Варіант 1)]');
  await new Promise(resolve => setTimeout(resolve, 15000));
  
  // 3. Send Workbook 2
  console.log(`Sending workbook 2 to user ${userId}...`);
  await sendLocalFile(workbook2Path, 'document', '📚 Робочий зошит «Точка переходу» (Варіант 2)\n\nАльтернативний формат зошиту для зручного використання.');
  saveMessageLocally(String(userId), 'bot', '[Надіслано Робочий зошит PDF (Варіант 2)]');
  await new Promise(resolve => setTimeout(resolve, 15000));

  // 4. Send Gifts
  for (let i = 0; i < gifts.length; i++) {
    const gift = gifts[i];
    const giftPath = path.join(giftDir, gift.name);
    console.log(`Sending gift ${gift.name} to user ${userId}...`);
    await sendLocalFile(giftPath, gift.type as any, gift.caption);
    saveMessageLocally(String(userId), 'bot', `[Надіслано бонус: ${gift.name}]`);
    if (i < gifts.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 15000));
    }
  }
}

// Helper: Auto-register user from Telegram updates
async function registerUserFromTelegram(userId: number, username: string, phone: string) {
  const last_active = 'Сьогодні, щойно';
  const progressStore = readProgress();
  if (!progressStore[String(userId)]) {
    writeProgress(String(userId), 1, last_active);
  }

  if (supabase) {
    try {
      const { data: userExists } = await supabase
        .from('users')
        .select('user_id')
        .eq('user_id', userId)
        .maybeSingle();

      if (!userExists) {
        await supabase
          .from('users')
          .insert({
            user_id: userId,
            username,
            phone: phone || null,
            status: 'free',
            join_date: new Date().toISOString()
          });
      } else if (phone) {
        await supabase
          .from('users')
          .update({ phone })
          .eq('user_id', userId);
      }
    } catch (err) {
      console.error('Supabase DB error auto-registering user:', err);
    }
  }
}

async function saveUserPhone(userId: number, phone: string) {
  if (supabase) {
    try {
      await supabase
        .from('users')
        .update({ phone })
        .eq('user_id', userId);
    } catch (err) {
      console.error('Supabase DB error updating user phone:', err);
    }
  }
}

// Generate Gemini response prompted as "Antonina"
async function generateGeminiResponse(userPrompt: string, username: string): Promise<string> {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) {
    return 'Дякую за ваше повідомлення! Я обов\'язково відповім вам найближчим часом. ✨';
  }

  try {
    const ai = new GoogleGenAI({
      apiKey: geminiApiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    const systemInstruction = `Ти — Антоніна, авторка та коуч психотерапевтичного практикуму з усвідомленості, медитації та емоційного балансу. 
Твоє завдання — з теплотою, емпатією, любов'ю та професіоналізмом відповідати на повідомлення клієнтів. 
Звертайся за нікнеймом (${username}) у дружній та довірливій формі. Давай короткі, надихаючі та змістовні відповіді виключно українською мовою. 
Підтримуй користувача, якщо він переживає стрес, тривогу чи втому, ділися порадами з фокусування на диханні.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: userPrompt,
      config: {
        systemInstruction,
      },
    });

    return response.text || 'Дякую за повідомлення! Я завжди поруч, щоб підтримати тебе.';
  } catch (err: any) {
    console.error('Gemini call failed in bot:', err.message);
    return 'Дякую за повідомлення! Зберігайте спокій, дихайте глибоко. Я поруч. 🙏';
  }
}

// Handle single Telegram update
async function handleTelegramUpdate(update: any) {
  const message = update.message;
  if (!message) return;

  const chatId = message.chat.id;
  const from = message.from;
  if (!from) return;

  const userId = from.id;
  const username = from.username ? `@${from.username}` : `@user_${userId}`;
  const text = message.text || '';

  let phone = '';
  if (message.contact) {
    phone = message.contact.phone_number;
    if (phone && !phone.startsWith('+')) {
      phone = '+' + phone;
    }
  }

  // Auto register/update user in DB
  await registerUserFromTelegram(userId, username, phone);

  // If user shared contact, thank them
  if (message.contact) {
    await saveUserPhone(userId, phone);
    const replyText = `✨ Дякую! Ваш номер телефону (${phone}) успішно перевірено та зареєстровано в базі.\n\nТепер ви повноправний учасник практикуму Антоніни! Напишіть будь-яке питання або очікуйте першого уроку.`;
    await sendTelegramMessage(userId, replyText);
    saveMessageLocally(String(userId), 'bot', replyText);
    return;
  }

  if (text) {
    saveMessageLocally(String(userId), 'user', text);

    if (text.startsWith('/start')) {
      const welcomeText = `Вітаю у практикумі Антоніни! 🌸\n\nЯ ваш персональний бот-провідник. Тут ви будете отримувати щоденні заняття, аудіопрактики та корисні матеріали нашого 8-денного курсу.\n\nБудь ласка, натисніть кнопку нижче, щоб поділитися своїм контактом для швидкої реєстрації в системі.`;
      
      const keyboard = {
        keyboard: [
          [{ text: '📱 Поділитися контактом', request_contact: true }]
        ],
        resize_keyboard: true,
        one_time_keyboard: true
      };

      await sendTelegramMessageWithKeyboard(userId, welcomeText, keyboard);
      saveMessageLocally(String(userId), 'bot', welcomeText);
    } else if (text.startsWith('/help') || text.toLowerCase() === 'допомога') {
      const helpText = `🤖 *Помічник практикуму «Точка переходу»:*\n\n` +
        `• /start — перезапустити бота та відкрити головне меню\n` +
        `• /help — показати список команд\n` +
        `• /day1 ... /day8 — отримати матеріали конкретного дня (доступно для оплачених тарифів)\n\n` +
        `📩 Напишіть своє питання у цей чат, і Антоніна обов'язково відповість вам!`;
      await sendTelegramMessage(userId, helpText);
      saveMessageLocally(String(userId), 'bot', helpText);
    } else if (text.startsWith('/day')) {
      const dayNum = parseInt(text.replace('/day', ''));
      if (isNaN(dayNum) || dayNum < 1 || dayNum > 8) {
        const errText = `❌ Невірний номер дня. Виберіть від /day1 до /day8.`;
        await sendTelegramMessage(userId, errText);
        saveMessageLocally(String(userId), 'bot', errText);
      } else {
        // Check user subscription status
        let isPaid = false;
        if (supabase) {
          try {
            const { data } = await supabase.from('users').select('status').eq('user_id', userId).maybeSingle();
            if (data && data.status !== 'free') isPaid = true;
          } catch (e) {
            isPaid = false;
          }
        } else {
          const progressStore = readProgress();
          const localProg = progressStore[String(userId)];
          if (localProg) isPaid = true; // or fallback
        }

        if (!isPaid) {
          const blockText = `🔒 *Матеріали [День ${dayNum}] заблоковано.*\n\nДля отримання доступу, будь ласка, придбайте один із пакетів участі в кабінеті нашого WebApp або зверніться безпосередньо до Антоніни Пашко.`;
          await sendTelegramMessage(userId, blockText);
          saveMessageLocally(String(userId), 'bot', blockText);
        } else {
          const lessons = getLessons();
          const lesson = lessons.find((l: any) => l.day === dayNum);
          if (lesson) {
            const lessonText = `🌸 *ПРАКТИКУМ «ТОЧКА ПЕРЕХОДУ» — ДЕНЬ ${lesson.day}* 🌸\n\n` +
              `✨ *Тема:* ${lesson.title}\n` +
              `📝 *Опис:* ${lesson.description}\n\n` +
              `🎥 *Відео-урок:* ${lesson.videoDuration || '15-20 хв'}\n` +
              `🧘‍♀️ *Практика:* ${lesson.practiceTitle || 'Аудіо-медитація'}\n\n` +
              `📖 *Текстова версія практики (якщо краще читати):*\n` +
              `${lesson.pdfFiles && lesson.pdfFiles.length > 0 ? lesson.pdfFiles.map((f: string) => `• ${f}`).join('\n') : '—'}`;
            await sendTelegramMessage(userId, lessonText);
            saveMessageLocally(String(userId), 'bot', lessonText);
          } else {
            const errText = `❌ Матеріали для дня ${dayNum} наразі недоступні.`;
            await sendTelegramMessage(userId, errText);
            saveMessageLocally(String(userId), 'bot', errText);
          }
        }
      }
    } else {
      let replyText = 'Дякую за повідомлення! Я передам його Антоніні. 😊';
      const geminiApiKey = process.env.GEMINI_API_KEY;
      if (geminiApiKey) {
        replyText = await generateGeminiResponse(text, username);
      }
      await sendTelegramMessage(userId, replyText);
      saveMessageLocally(String(userId), 'bot', replyText);
    }
  }
}

async function clearTelegramWebhook() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/deleteWebhook`);
    const data = await res.json() as any;
    if (data && data.ok) {
      console.log('Telegram webhook cleared successfully (switch to long polling).');
    } else {
      console.log('Telegram deleteWebhook info:', data ? data.description : 'no response');
    }
  } catch (err: any) {
    console.error('Failed to clear Telegram webhook:', err.message);
  }
}

// Background long polling loop
async function runTelegramPolling() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.log('TELEGRAM_BOT_TOKEN contains no value. Telegram Bot service is suspended.');
    return;
  }
  
  // Clear webhook on startup so that getUpdates is permitted
  await clearTelegramWebhook();
  
  console.log(`Telegram Bot background service launched. Polling telegram servers...`);
  let offset = 0;
  
  while (true) {
    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/getUpdates?offset=${offset}&timeout=30`);
      
      if (response.status === 409) {
        console.warn('Telegram Bot polling warning: conflict (409). Another instance or webhook might be active. Retrying in 15 seconds...');
        await new Promise(resolve => setTimeout(resolve, 15000));
        continue;
      }
      
      if (!response.ok) {
        throw new Error(`Telegram server responded with status: ${response.status}`);
      }
      const data = (await response.json()) as any;
      if (data.ok && data.result) {
        for (const update of data.result) {
          offset = update.update_id + 1;
          await handleTelegramUpdate(update);
        }
      }
    } catch (err: any) {
      console.error('Error in Telegram polling loop:', err.message);
      // Wait 10 seconds before retrying to prevent busy loop
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  }
}


const LESSONS_FILE_PATH = path.join(process.cwd(), 'src/data/lessons.json');

function getLessons() {
  try {
    if (fs.existsSync(LESSONS_FILE_PATH)) {
      const data = fs.readFileSync(LESSONS_FILE_PATH, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error reading lessons file:', err);
  }
  return initialLessons;
}

// API Endpoint: Get Lessons
app.get('/api/lessons', (req, res) => {
  const lessons = getLessons();
  res.json({ success: true, data: lessons });
});

// API Endpoint: Save Lessons
app.put('/api/lessons', (req, res) => {
  const { lessons } = req.body;
  if (!Array.isArray(lessons)) {
    return res.status(400).json({ success: false, error: 'Дані мають бути масивом' });
  }
  try {
    const dir = path.dirname(LESSONS_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(LESSONS_FILE_PATH, JSON.stringify(lessons, null, 2), 'utf-8');
    res.json({ success: true, message: 'Програму успішно збережено' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Scheduler Configuration & Logs System
const SCHEDULER_CONFIG_PATH = path.join(process.cwd(), 'src/data/scheduler_config.json');
const BROADCAST_LOGS_PATH = path.join(process.cwd(), 'src/data/broadcast_logs.json');

interface SchedulerConfig {
  broadcastHour: number;
  broadcastMinute: number;
  targetAudience: string;
  lastBroadcastDate: string;
}

function getSchedulerConfig(): SchedulerConfig {
  try {
    if (fs.existsSync(SCHEDULER_CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(SCHEDULER_CONFIG_PATH, 'utf-8'));
    }
  } catch (err) {
    console.error('Error reading scheduler config:', err);
  }
  return {
    broadcastHour: 11,
    broadcastMinute: 0,
    targetAudience: 'paid',
    lastBroadcastDate: ''
  };
}

function saveSchedulerConfig(config: SchedulerConfig) {
  try {
    const dir = path.dirname(SCHEDULER_CONFIG_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(SCHEDULER_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving scheduler config:', err);
  }
}

interface BroadcastLog {
  timestamp: string;
  trigger: 'auto' | 'manual';
  target: string;
  sentCount: number;
  details: string[];
}

function getBroadcastLogs(): BroadcastLog[] {
  try {
    if (fs.existsSync(BROADCAST_LOGS_PATH)) {
      return JSON.parse(fs.readFileSync(BROADCAST_LOGS_PATH, 'utf-8'));
    }
  } catch (err) {
    console.error('Error reading broadcast logs:', err);
  }
  return [
    {
      timestamp: new Date().toISOString(),
      trigger: 'auto',
      target: 'paid',
      sentCount: 4,
      details: [
        `[09:00:00] ⏳ Запуск щоденного планувальника розсилок (course_broadcast)...`,
        `[09:00:02] ✅ Надіслано День 7 для @olena_koval (Пакет VIP). Встановлено наступний день: 8`,
        `[09:00:03] ✅ Надіслано День 4 для @mariya_shvets (Пакет Супровід). Встановлено наступний день: 5`,
        `[09:00:04] ✅ Надіслано День 2 для @kateryna_p (Пакет Базовий). Встановлено наступний день: 3`,
        `[09:00:05] ✅ Надіслано День 3 для @natalia_k (Пакет Базовий). Встановлено наступний день: 4`,
        `[09:00:07] 🎉 Щоденна розсилка успішно завершена.`
      ]
    }
  ];
}

function saveBroadcastLog(log: BroadcastLog) {
  try {
    const logs = getBroadcastLogs();
    logs.unshift(log); // Add new log at the beginning
    const dir = path.dirname(BROADCAST_LOGS_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(BROADCAST_LOGS_PATH, JSON.stringify(logs.slice(0, 50), null, 2), 'utf-8'); // keep last 50 logs
  } catch (err) {
    console.error('Error saving broadcast log:', err);
  }
}

async function runNewsletterBroadcast(
  isManual: boolean = false,
  overrideTargetAudience?: string,
  targetUserId?: string,
  overrideDayNum?: number
): Promise<BroadcastLog> {
  const config = getSchedulerConfig();
  const audience = overrideTargetAudience || config.targetAudience;
  const lessons = getLessons();
  const logsList: string[] = [];
  const timestampStr = new Date().toISOString();
  const timeLabel = new Date().toLocaleTimeString('uk-UA');
  
  logsList.push(`[${timeLabel}] ⏳ Початок розсилки занять (тригер: ${isManual ? 'Вручну' : 'Автоматично'})...`);
  
  let targetUsers: any[] = [];
  
  if (USE_LOCAL_DB) {
    targetUsers = readLocalUsers();
    logsList.push(`[${timeLabel}] ℹ️ Використовується локальна база даних users.json`);
  } else if (supabase) {
    try {
      const { data, error } = await supabase.from('users').select('*');
      if (!error && data) {
        targetUsers = data;
      } else {
        targetUsers = defaultUsers;
        logsList.push(`[${timeLabel}] ⚠️ Помилка зчитування з Supabase, використано fallback-користувачів.`);
      }
    } catch (err: any) {
      targetUsers = defaultUsers;
      logsList.push(`[${timeLabel}] ⚠️ Виникла помилка: ${err.message}. Використано fallback-користувачів.`);
    }
  } else {
    targetUsers = defaultUsers;
    logsList.push(`[${timeLabel}] ℹ️ База Supabase неактивна, використовується локальний список.`);
  }

  // Filter users based on config targetAudience or targetUserId
  let filtered: any[] = [];
  if (targetUserId) {
    filtered = targetUsers.filter(u => String(u.user_id || u.telegramId || u.id) === String(targetUserId));
    logsList.push(`[${timeLabel}] 👥 Цільовий користувач: ${targetUserId} (${filtered[0]?.username || 'невідомий'})`);
  } else {
    const getAudienceLabel = (target: string): string => {
      switch (target) {
        case 'paid': return 'Лише оплачені';
        case 'unpaid': return 'Не оплачені';
        case 'free': return 'Безкоштовний';
        case 'base': return 'Базовий';
        case 'support': return 'Супровід';
        case 'vip': return 'ВІП';
        default: return 'Усі';
      }
    };
    filtered = targetUsers.filter(u => {
      const userStatus = u.status || 'free';
      if (audience === 'paid') {
        return userStatus === 'base' || userStatus === 'support' || userStatus === 'vip';
      }
      if (audience === 'unpaid' || audience === 'free') {
        return userStatus === 'free';
      }
      if (audience === 'base') {
        return userStatus === 'base';
      }
      if (audience === 'support') {
        return userStatus === 'support';
      }
      if (audience === 'vip') {
        return userStatus === 'vip';
      }
      return true; // Send to all
    });
    logsList.push(`[${timeLabel}] 👥 Знайдено користувачів для розсилки: ${filtered.length} (Ціль: ${getAudienceLabel(audience)})`);
  }

  let sentSuccessCount = 0;
  const progressStore = readProgress();

  for (const user of filtered) {
    const uId = String(user.user_id || user.telegramId || user.id);
    const localProg = progressStore[uId];
    const currentDay = overrideDayNum || (localProg ? Number(localProg.current_day) : (user.current_day !== undefined ? Number(user.current_day) : 1));
    
    const userStatus = user.status || 'free';
    const isPaid = userStatus === 'base' || userStatus === 'support' || userStatus === 'vip';
    if (currentDay > 1 && !isPaid) {
      logsList.push(`[${timeLabel}] 🔒 Користувач ${user.username || uId} має статус 'free', надсилання Дня ${currentDay} заблоковано.`);
      continue;
    }

    if (currentDay > 8 && !overrideDayNum) {
      logsList.push(`[${timeLabel}] 🎓 Користувач ${user.username || uId} вже завершив практикум (День 8)`);
      continue;
    }

    const lesson = lessons.find((l: any) => l.day === currentDay);
    if (!lesson) {
      logsList.push(`[${timeLabel}] ❌ Не знайдено матеріалів для Дня ${currentDay} користувача ${user.username || uId}`);
      continue;
    }

    // Format beautiful Telegram message
    const messageText = 
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🌸 *ДЕНЬ ${lesson.day} • ПРАКТИКУМ «ТОЧКА ПЕРЕХОДУ»* 🌸\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `✨ *Тема дня:*\n«${lesson.title}»\n\n` +
      `📝 *Про що цей день:*\n${lesson.description}\n\n` +
      `┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈\n` +
      `ℹ️ *МАТЕРІАЛИ ЗАНЯТТЯ:*\n` +
      `🎥 *Відео-урок:* ${lesson.videoDuration || '15-20 хв'}\n` +
      `🧘‍♀️ *Практика:* ${lesson.practiceTitle || 'Аудіо-медитація'}\n\n` +
      `📖 *Детальний зміст:*\n${lesson.fullDescription || ''}\n\n` +
      `📖 *Текстова версія практики (якщо краще читати):*\n` +
      `${lesson.pdfFiles && lesson.pdfFiles.length > 0 ? lesson.pdfFiles.map((f: string) => `• ${f}`).join('\n') : '—'}\n\n` +
      `┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈\n` +
      `🙏 Проходьте практику у зручному темпі!\n` +
      `Наступний урок буде надіслано автоматично об ${String(config.broadcastHour).padStart(2, '0')}:${String(config.broadcastMinute).padStart(2, '0')}.`;

    // Send real Telegram message
    const token = process.env.TELEGRAM_BOT_TOKEN;
    let tgSent = false;
    if (token) {
      try {
        // 1. Send text message (with copy protection)
        const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: parseInt(uId),
            text: messageText,
            parse_mode: 'Markdown',
            protect_content: true
          })
        });
        const tgData = (await tgRes.json()) as any;
        
        if (tgData && tgData.ok) {
          tgSent = true;
          
          // 2. Send photo if registered (with 15s delay)
          if (lesson.photoFileId) {
            await new Promise(resolve => setTimeout(resolve, 15000));
            try {
              await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  chat_id: parseInt(uId),
                  photo: lesson.photoFileId,
                  caption: '🖼 Зображення дня',
                  protect_content: true
                })
              });
            } catch (mediaErr: any) {
              console.error(`Failed to send broadcast photo to ${uId}:`, mediaErr.message);
            }
          }
          
          // 3. Send video if registered (with 15s delay)
          if (lesson.videoFileId) {
            await new Promise(resolve => setTimeout(resolve, 15000));
            try {
              await fetch(`https://api.telegram.org/bot${token}/sendVideo`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  chat_id: parseInt(uId),
                  video: lesson.videoFileId,
                  caption: '🎥 Відео-урок',
                  protect_content: true
                })
              });
            } catch (mediaErr: any) {
              console.error(`Failed to send broadcast video to ${uId}:`, mediaErr.message);
            }
          }
          
          // 4. Send audio if registered (with 15s delay)
          if (lesson.audioFileId) {
            await new Promise(resolve => setTimeout(resolve, 15000));
            try {
              await fetch(`https://api.telegram.org/bot${token}/sendAudio`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  chat_id: parseInt(uId),
                  audio: lesson.audioFileId,
                  caption: '🧘‍♀️ Аудіо-практика',
                  protect_content: true
                })
              });
            } catch (mediaErr: any) {
              console.error(`Failed to send broadcast audio to ${uId}:`, mediaErr.message);
            }
          }
          
          // 5. Send PDF document if registered (with 15s delay)
          if (lesson.pdfFileId) {
            await new Promise(resolve => setTimeout(resolve, 15000));
            try {
              await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  chat_id: parseInt(uId),
                  document: lesson.pdfFileId,
                  caption: '📝 Текстова версія практики (якщо вам зручніше читати, ніж слухати)',
                  protect_content: true
                })
              });
            } catch (mediaErr: any) {
              console.error(`Failed to send broadcast document to ${uId}:`, mediaErr.message);
            }
          }
        } else {
          logsList.push(`[${timeLabel}] ⚠️ Повідомлення для ${user.username || uId} не відправлено в Telegram (користувач заблокував бота або невірний ID).`);
        }
      } catch (err: any) {
        logsList.push(`[${timeLabel}] ❌ Помилка зв'язку з Telegram для ${user.username || uId}: ${err.message}`);
      }
    } else {
      logsList.push(`[${timeLabel}] ⚙️ Телеграм токен не налаштовано. Повідомлення збережено у внутрішній лог.`);
      tgSent = true; // Count as simulated success for reporting
    }

    // Save message to local history and database
    saveMessageLocally(uId, 'bot', messageText);

    // Increment current day and update database / local store
    const nextDay = currentDay + 1;
    const lastActiveLabel = `Отримано День ${currentDay} (${isManual ? 'вручну' : 'авто'})`;
    writeProgress(uId, nextDay, lastActiveLabel);

    if (supabase) {
      try {
        await supabase
          .from('users')
          .update({ 
            current_day: nextDay,
            last_active: lastActiveLabel
          })
          .eq('user_id', parseInt(uId));
      } catch (err: any) {
        console.error(`Failed to update user current_day in Supabase: ${err.message}`);
      }
    }

    if (tgSent) {
      sentSuccessCount++;
      if (currentDay === 8) {
        const usernameStr = user.username || '';
        const userLink = usernameStr ? `https://t.me/${usernameStr.replace('@', '')}` : `tg://user?id=${uId}`;
        const userDisplayName = user.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : `@user_${uId}`;
        sendAdminNotification(
          `🎓 <b>Практикум успішно завершено!</b>\n\n` +
          `👤 <b>Ім'я:</b> ${userDisplayName}\n` +
          `🏁 <b>Статус:</b> Надіслано матеріали 8-го дня\n\n` +
          `👉 <a href="${userLink}"><b>ВІДКРИТИ ДІАЛОГ З КОРИСТУВАЧЕМ</b></a>`
        );
      }
      logsList.push(`[${timeLabel}] ✅ [День ${currentDay}] успішно надіслано користувачу ${user.username || uId}. Встановлено наступний день: ${nextDay}`);
      
      // Log progress milestone locally or in Supabase
      if (USE_LOCAL_DB || !supabase) {
        const localLogs = readProgressLogs();
        localLogs.push({
          id: localLogs.length + 1,
          user_id: parseInt(uId),
          day_num: currentDay,
          sent_at: new Date().toISOString(),
          delivery_type: isManual ? 'manual' : 'auto',
          status: 'delivered',
          error_message: null
        });
        writeProgressLogs(localLogs);
      } else {
        try {
          await supabase.from('course_progress_logs').insert({
            user_id: parseInt(uId),
            day_num: currentDay,
            sent_at: new Date().toISOString(),
            delivery_type: isManual ? 'manual' : 'auto',
            status: 'delivered'
          });
        } catch (e) {}
      }
    }
  }

  logsList.push(`[${timeLabel}] 🚀 Розсилку завершено! Всього успішно відправлено: ${sentSuccessCount} користувачам.`);
  
  const finalLog: BroadcastLog = {
    timestamp: timestampStr,
    trigger: isManual ? 'manual' : 'auto',
    target: config.targetAudience,
    sentCount: sentSuccessCount,
    details: logsList
  };

  saveBroadcastLog(finalLog);
  return finalLog;
}

// Scheduler config getter
app.get('/api/broadcast/config', (req, res) => {
  res.json({ success: true, data: getSchedulerConfig() });
});

// Scheduler config setter
app.post('/api/broadcast/config', (req, res) => {
  const { broadcastHour, broadcastMinute, targetAudience } = req.body;
  const config = getSchedulerConfig();
  if (broadcastHour !== undefined) config.broadcastHour = Number(broadcastHour);
  if (broadcastMinute !== undefined) config.broadcastMinute = Number(broadcastMinute);
  if (targetAudience !== undefined) config.targetAudience = targetAudience;
  saveSchedulerConfig(config);
  res.json({ success: true, message: 'Налаштування планувальника збережено', data: config });
});

// Scheduler manual trigger
app.post('/api/broadcast/trigger', async (req, res) => {
  try {
    const { targetAudience, targetUserId, dayNum } = req.body;
    const log = await runNewsletterBroadcast(true, targetAudience, targetUserId, dayNum ? Number(dayNum) : undefined);
    res.json({ success: true, message: 'Розсилку запущено успішно', log });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Scheduler retrieve logs
app.get('/api/broadcast/logs', (req, res) => {
  res.json({ success: true, data: getBroadcastLogs() });
});

// API Endpoint: WayForPay Webhook
app.post('/api/payment/wayforpay-webhook', async (req, res) => {
  const { transactionStatus, orderReference, amount, phone, email, productName } = req.body;
  console.log('WayForPay webhook received:', req.body);
  
  if (transactionStatus === 'Approved') {
    // 1. Визначаємо пакет за сумою або назвою продукту
    let status: 'base' | 'support' | 'vip' = 'base';
    const amountVal = parseFloat(amount || '0');
    
    const isVip = (productName && productName.some((n: string) => n.toLowerCase().includes('vip'))) || amountVal >= 350;
    const isSupport = (productName && productName.some((n: string) => n.toLowerCase().includes('супровід') || n.toLowerCase().includes('support'))) || (amountVal >= 100 && amountVal < 350);
    
    if (isVip) {
      status = 'vip';
    } else if (isSupport) {
      status = 'support';
    } else {
      status = 'base';
    }
    
    const packageName = status === 'vip' ? 'VIP (Індивідуально) - 400€' :
                        status === 'support' ? 'Супровід (Зі спікером) - 125€' :
                        'Базовий (Самостійно) - 20€';

    // 2. Ідентифікація Telegram користувача за телефоном
    if (phone) {
      // Нормалізуємо номер телефону (тільки цифри)
      const normalizedPhone = phone.replace(/\D/g, '');
      console.log(`Searching user for phone: ${normalizedPhone} (original: ${phone})`);
      
      let matchedUser: any = null;
      if (USE_LOCAL_DB || !supabase) {
        const localUsers = readLocalUsers();
        matchedUser = localUsers.find((u: any) => {
          if (!u.phone) return false;
          const uPhone = u.phone.replace(/\D/g, '');
          return uPhone.endsWith(normalizedPhone) || normalizedPhone.endsWith(uPhone) || (uPhone.length >= 9 && normalizedPhone.endsWith(uPhone.slice(-9)));
        });
      } else {
        try {
          const { data } = await supabase.from('users').select('*');
          if (data) {
            matchedUser = data.find((u: any) => {
              if (!u.phone) return false;
              const uPhone = u.phone.replace(/\D/g, '');
              return uPhone.endsWith(normalizedPhone) || normalizedPhone.endsWith(uPhone) || (uPhone.length >= 9 && normalizedPhone.endsWith(uPhone.slice(-9)));
            });
          }
        } catch (dbErr: any) {
          console.error('Error fetching users from Supabase for webhook:', dbErr.message);
        }
      }
      
      if (matchedUser) {
        const userId = matchedUser.user_id || matchedUser.id;
        console.log(`Found active user in TG bot: ${userId}. Activating status ${status}...`);
        
        // Оновлюємо статус користувача
        const last_active = 'Сьогодні, активовано автоматично через WayForPay';
        writeProgress(String(userId), 1, last_active);
        
        if (USE_LOCAL_DB || !supabase) {
          const localUsers = readLocalUsers();
          const u = localUsers.find((x: any) => String(x.user_id || x.telegramId || x.id) === String(userId));
          if (u) {
            u.status = status;
            writeLocalUsers(localUsers);
          }
        } else {
          try {
            await supabase.from('users').update({ status, last_active }).eq('user_id', userId);
          } catch (e: any) {
            console.error('Error updating status in Supabase:', e.message);
          }
        }
        
        // Зберігаємо лід зі статусом success
        if (USE_LOCAL_DB || !supabase) {
          const localLeads = readLocalLeads();
          localLeads.push({
            id: localLeads.length + 1,
            user_id: Number(userId),
            package_name: packageName,
            status: 'success',
            created_at: new Date().toISOString()
          });
          writeLocalLeads(localLeads);
        } else {
          try {
            await supabase.from('leads').insert({
              user_id: Number(userId),
              package_name: packageName,
              status: 'success',
              created_at: new Date().toISOString()
            });
          } catch (e: any) {
            console.error('Error inserting lead in Supabase:', e.message);
          }
        }
        
        logToGoogleSheet('Leads', { userId, packageName, status: 'success' });
        
        // Надсилаємо сповіщення адміну
        const userLink = `tg://user?id=${userId}`;
        sendAdminNotification(
          `💳 <b>Успішна оплата WayForPay (автоматично)!</b>\n\n` +
          `👤 <b>Користувач:</b> @${matchedUser.username || matchedUser.user_id}\n` +
          `🆔 <b>Telegram ID:</b> <code>${userId}</code>\n` +
          `📞 <b>Телефон:</b> <code>${phone}</code>\n` +
          `💰 <b>Сума:</b> <code>${amount}</code>\n` +
          `📦 <b>Тариф:</b> <code>${packageName}</code>\n\n` +
          `👉 <a href="${userLink}"><b>ВІДКРИТИ ДІАЛОГ</b></a>`
        );
        
        // Надсилаємо робочі зошити та бонуси!
        await sendPurchaseMaterials(Number(userId));
      } else {
        // Користувача немає в боті -> створюємо гостьовий акаунт для подальшого зв'язування
        // Використовуємо телефон як унікальний BIGINT user_id (останні 10 цифр)
        const guestId = parseInt(normalizedPhone.slice(-10));
        
        if (isNaN(guestId)) {
          console.error("Failed to parse guestId from phone:", normalizedPhone);
          return res.json({ orderReference: orderReference || '', status: 'accept' });
        }
        
        console.log(`User not found in TG bot. Creating guest account with user_id: ${guestId}...`);
        
        const join_date = new Date().toISOString();
        const last_active = 'Оплачено на сайті, очікує запуску бота';
        
        if (USE_LOCAL_DB || !supabase) {
          const localUsers = readLocalUsers();
          localUsers.push({
            user_id: guestId,
            telegramId: String(guestId),
            username: `guest_buyer`,
            phone: `+${normalizedPhone}`,
            status: status,
            join_date,
            current_day: 1,
            last_active
          });
          writeLocalUsers(localUsers);
          
          const localLeads = readLocalLeads();
          localLeads.push({
            id: localLeads.length + 1,
            user_id: guestId,
            package_name: packageName,
            status: 'success',
            created_at: new Date().toISOString()
          });
          writeLocalLeads(localLeads);
        } else {
          try {
            // Спочатку створюємо користувача
            await supabase.from('users').insert({
              user_id: guestId,
              username: 'guest_buyer',
              phone: `+${normalizedPhone}`,
              status: status,
              join_date
            });
            
            // Створюємо лід
            await supabase.from('leads').insert({
              user_id: guestId,
              package_name: packageName,
              status: 'success',
              created_at: new Date().toISOString()
            });
          } catch (dbErr: any) {
            console.error('Error saving guest account in Supabase:', dbErr.message);
          }
        }
        
        logToGoogleSheet('Leads', { userId: guestId, packageName, status: 'success' });
        
        // Сповіщення адміна про покупку гостем
        sendAdminNotification(
          `⚠️ <b>Оплата від нового користувача (ще не в боті)!</b>\n\n` +
          `👤 <b>Гість:</b> <code>guest_buyer</code>\n` +
          `🆔 <b>Тимчасовий ID:</b> <code>${guestId}</code>\n` +
          `📞 <b>Телефон:</b> <code>+${normalizedPhone}</code>\n` +
          `📧 <b>Email:</b> <code>${email || 'не вказано'}</code>\n` +
          `📦 <b>Пакет:</b> <code>${packageName}</code>\n\n` +
          `<i>Користувач отримає матеріали одразу після того, як запустить бот та поділиться контактом.</i>`
        );
      }
    } else {
      console.warn('WayForPay webhook has no phone number.');
    }
  }
  
  res.json({
    orderReference: orderReference || '',
    status: 'accept',
    time: Math.floor(Date.now() / 1000)
  });
});

// Background schedule checker (runs once every 15 seconds)
function startBackgroundScheduler() {
  console.log('[Scheduler] Background service active.');
  setInterval(async () => {
    try {
      const config = getSchedulerConfig();
      const now = new Date();
      
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      
      if (Number(currentHour) === Number(config.broadcastHour) && Number(currentMinute) === Number(config.broadcastMinute)) {
        if (config.lastBroadcastDate !== todayStr) {
          config.lastBroadcastDate = todayStr;
          saveSchedulerConfig(config);
          console.log(`[Scheduler] Auto-broadcast triggered for hour ${currentHour}:${currentMinute} on date ${todayStr}`);
          await runNewsletterBroadcast(false);
        }
      }
    } catch (err: any) {
      console.error('[Scheduler] Error in background scheduler loop:', err.message);
    }
  }, 15000);
}


// Configure Vite Dev Server or Production Static Serving
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
    // Start background Telegram Bot polling
    // runTelegramPolling();
    // Start background newsletter scheduler
    startBackgroundScheduler();
  });
}

startServer();

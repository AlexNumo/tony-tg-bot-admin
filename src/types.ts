export type UserStatus = 'free' | 'base' | 'support' | 'vip';

export interface Lesson {
  day: number;
  title: string;
  description: string;
  practiceTitle: string;
  videoDuration: string;
  videoFileId: string;
  audioFileName: string;
  pdfFiles: string[];
  fullDescription: string;
}

export interface User {
  id: string;
  telegramId: string;
  username: string;
  phone?: string;
  status: UserStatus;
  joinDate: string;
  currentDay: number;
  lastActive: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'bot' | 'system';
  text: string;
  timestamp: string;
  mediaType?: 'audio' | 'video' | 'pdf' | 'packages' | 'success';
  mediaTitle?: string;
  mediaSubtitle?: string;
  videoFileId?: string;
  protectContent?: boolean;
  buttons?: { text: string; action: string; url?: string; isWebApp?: boolean }[];
}

export interface BotConfig {
  botToken: string;
  supabaseUrl: string;
  supabaseKey: string;
  startMessage: string;
  bonusesText: string;
}

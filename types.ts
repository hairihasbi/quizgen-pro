
export enum UserRole {
  ADMIN = 'admin',
  TEACHER = 'teacher'
}

export type UserStatus = 'pending' | 'approved' | 'rejected';

export interface User {
  id: string;
  username: string;
  fullName?: string;
  password?: string;
  role: UserRole;
  credits: number;
  isActive: boolean;
  email?: string;
  status?: UserStatus;
  createdAt?: string;
}

export enum QuestionType {
  MCQ = 'Pilihan Ganda',
  COMPLEX_MCQ = 'Pilihan Ganda Kompleks',
  TRUE_FALSE = 'Benar/Salah',
  SHORT_ANSWER = 'Isian Singkat',
  ESSAY = 'Uraian/Essay'
}

export interface Question {
  id: string;
  type: QuestionType;
  text: string;
  image?: string;
  passage?: string; 
  passageGroupId?: string; 
  passageHeader?: string; 
  isFirstInPassageGroup?: boolean; 
  options?: { label: string; text: string; image?: string }[];
  answer: string | string[];
  explanation: string;
  indicator: string;
  competency: string;
  topic: string;
  cognitiveLevel: string;
  subject?: string;
}

export interface Quiz {
  id: string;
  title: string;
  subject: string;
  level: string;
  grade: string;
  topic: string;
  subTopic?: string;
  difficulty: 'Mudah' | 'Sedang' | 'Sulit';
  questions: Question[];
  grid: string;
  tags?: string[];
  authorId: string;
  authorName?: string;
  isPublished: boolean;
  createdAt: string;
  status: 'completed' | 'failed' | 'processing';
}

export interface AIProgressEvent {
  step: string;
  percentage: number;
  message: string;
  details?: string;
  timestamp: string;
}

export interface ApiKey {
  id: string;
  key: string;
  usageCount: number;
  lastUsed: string;
  isActive: boolean;
  errorCount: number;
  lastErrorAt?: string;
}

export enum LogCategory {
  SECURITY = 'SECURITY',
  CONTENT = 'CONTENT',
  SYSTEM = 'SYSTEM',
  FINANCIAL = 'FINANCIAL'
}

export interface QuizLog {
  id: string;
  timestamp: string;
  category: LogCategory;
  action: string;
  details: string;
  status: 'success' | 'error' | 'pending';
  userId: string;
  metadata?: string;
}

export interface EmailNotification {
  id: string;
  to: string;
  subject: string;
  body: string;
  type: 'success' | 'error' | 'warning' | 'info';
  timestamp: string;
  isRead: boolean;
}

export interface EmailSettings {
  provider: 'none' | 'resend' | 'smtp';
  apiKey: string;
  fromEmail: string;
  senderName: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
}

export interface GoogleSettings {
  clientId: string;
}

export interface Transaction {
  id: string;
  userId: string;
  amount: number;
  credits: number;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  externalId: string;
  createdAt: string;
}

export interface PaymentPackage {
  id: string;
  name: string;
  credits: number;
  price: number;
  isActive: boolean;
  paymentLink?: string; // Properti baru untuk Link Pembayaran Langsung
}

export interface PaymentSettings {
  mode: 'sandbox' | 'production';
  clientId: string;
  secretKey: string;
  merchantName: string;
  callbackUrl: string;
  packages: PaymentPackage[];
}

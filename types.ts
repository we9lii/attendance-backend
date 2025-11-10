
export enum UserRole {
  EMPLOYEE = 'موظف',
  ADMIN = 'إداري',
}

export interface User {
  id: number;
  name: string;
  username?: string;
  role: UserRole;
  department: string;
  phone?: string;
  email?: string;
  createdAt?: string; // ISO string
}

export interface ApprovedLocation {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  radius: number; // in meters
}

export interface AttendanceRecord {
  id: number;
  userId: number;
  checkIn: string;
  checkOut?: string;
  isLate: boolean;
  lateMinutes: number;
  excuseReason?: string;
  mandatoryExcuseReason?: string; // For repeated lateness
  locationId?: number; // ID of the location for app-based check-in
  source: 'جهاز البصمة' | 'التطبيق';
}

export enum RequestType {
  LEAVE = 'إجازة',
  EXCUSE = 'عذر',
}

export enum RequestStatus {
  PENDING = 'قيد المراجعة',
  APPROVED = 'مقبول',
  REJECTED = 'مرفض',
}

export interface Request {
  id: number;
  userId: number;
  type: RequestType;
  date: string;
  duration?: number; // for leave
  reason: string;
  status: RequestStatus;
}

export interface Notification {
  id: number;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  targetUserIds?: number[]; // Undefined for general notifications
}

export interface ChatMessage {
  id: number;
  fromUserId: number;
  toUserId: number;
  message: string;
  timestamp: string;
  read: boolean;
}

// System settings for the Settings page
export interface SystemSettings {
  // 1) Attendance basics
  attendanceStartTime: string; // HH:MM (24h)
  latestAllowedTime: string;   // HH:MM (24h)
  allowedLatenessPerMonthBeforeReason: number;

  // 3) Notifications
  morningReminderEnabled: boolean;
  morningReminderTime: string; // HH:MM
  instantLateNotificationEnabled: boolean;
  instantLateMessageTemplate: string; // use [الوقت] placeholder
  autoRequestReasonEnabled: boolean;
  autoRequestMessageTemplate: string; // use [X] placeholder

  // 4) Monthly reports
  autoReportDay: number; // 1-28
  reportIncludeLateList: boolean;
  reportIncludeTotalLateHours: boolean;
  reportIncludeUnexcusedAbsences: boolean;
  reportIncludeLeaveAndExcuseSummary: boolean;
  reportIncludeDepartmentComparison: boolean;
  exportPdf: boolean;
  exportExcel: boolean;

  // 5) Fingerprint API integration (session-only; not persisted on server)
  fingerprintApiUrl: string;
  fingerprintUsername: string;
  fingerprintPassword: string;
}

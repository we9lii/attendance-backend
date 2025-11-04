
import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { User, ApprovedLocation, AttendanceRecord, Request, Notification, ChatMessage, SystemSettings } from './types';
import { UserRole, RequestType, RequestStatus } from './types';
import {
  SunIcon, MoonIcon, LocationMarkerIcon, ClockIcon, CalendarIcon, UserGroupIcon,
  ChartBarIcon, DocumentTextIcon, CheckCircleIcon, XCircleIcon, ExclamationIcon,
  UserRemoveIcon, CheckBadgeIcon, ArrowUpIcon, ArrowDownIcon, PresentationChartLineIcon,
  BellIcon, ChatBubbleLeftRightIcon, ArrowPathIcon, QueueListIcon, HomeIcon, InboxIcon,
  ChevronLeftIcon, ChevronRightIcon, AdjustmentsIcon, ClipboardListIcon
} from './components/Icons';
import { AttendanceBarChart, RequestStatusPieChart, LatenessLineChart } from './components/Charts';
import { api } from './api';

// --- بيانات حقيقية عبر API داخلي (بدون بيانات وهمية) ---


// --- HELPER FUNCTIONS ---
const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371e3; // metres
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;
  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // in metres
};

const formatMinutesToHoursAndMinutes = (totalMinutes: number) => {
    if (totalMinutes === 0) return '0 دقيقة';
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    let result = '';
    if (hours > 0) result += `${hours} ساعة`;
    if (minutes > 0) {
        if (result) result += ' و ';
        result += `${minutes} دقيقة`;
    }
    return result;
};


// --- i18n ---
type Lang = 'ar' | 'en';
const I18N: Record<Lang, Record<string, string>> = {
  ar: {
    companyLogoAlt: 'شعار شركة مدائن المستقبل للطاقة',
    developerLogoAlt: 'شعار المطور',
    companyName: 'شركة مدائن المستقبل للطاقة',
    appTitle: 'نظام إدارة الحضور والانصراف',
    subtitle: 'نظام ادارة الحضور و الانصراف',
    notifications: 'الإشعارات',
    markAllRead: 'وضع الكل كمقروء',
    noNotifications: 'لا توجد إشعارات حالياً',
    markRead: 'مقروء',
    hello: 'مرحباً',
    admin: 'إداري',
    employee: 'موظف',
    loading: 'جاري التحميل...',
    developedBy: 'تم التطوير بواسطة',
    langAR: 'AR',
    langEN: 'EN',
    // Login card
    loginTitle: 'تسجيل الدخول',
    loginSubtitle: 'أدخل بيانات الدخول للمتابعة',
    usernamePlaceholder: 'اسم المستخدم',
    passwordPlaceholder: 'كلمة المرور',
    loginButton: 'دخول',
    // Employee Dashboard
    attendanceStatusToday: 'حالة الدوام لهذا اليوم',
    checkIn: 'تسجيل الحضور',
    checkOut: 'تسجيل الانصراف',
    dayComplete: 'لقد أتممت يومك بنجاح!',
    notCheckedInYet: 'لم يتم تسجيل حضور بعد.',
    checkedInAt: 'تم تسجيل حضورك في:',
    checkedOutAt: 'تم تسجيل انصرافك في:',
    lateByMinutes: 'تأخير لمدة {n} دقيقة',
    mustCheckoutViaDevice: 'يجب تسجيل الانصراف من جهاز البصمة أيضاً.',
    submitRequests: 'تقديم الطلبات',
    leaveRequest: 'طلب إجازة',
    excuseRequest: 'طلب عذر',
    startDate: 'تاريخ البدء',
    daysCount: 'عدد الأيام',
    daysPlaceholder: 'المدة (أيام)',
    leaveTypeLabel: 'نوع الإجازة',
    leaveAnnual: 'سنوية',
    leaveSick: 'مرضية',
    leaveEmergency: 'طارئة',
    leaveUnpaid: 'بدون راتب',
    reasonOptional: 'السبب (اختياري)',
    leaveReasonPlaceholder: 'سبب الإجازة (اختياري)',
    affectedDate: 'التاريخ المعني',
    excuseTypeLabel: 'نوع العذر',
    excuseLate: 'تأخير',
    excuseAbsent: 'غياب',
    reason: 'السبب',
    excuseReasonPlaceholder: 'اذكر سبب العذر',
    sendRequest: 'إرسال الطلب',
    attendanceLog: 'سجل الحضور',
    date: 'التاريخ',
    checkInLabel: 'حضور',
    checkOutLabel: 'انصراف',
    source: 'المصدر',
    tardiness: 'تأخير',
    myRequests: 'طلباتي',
    type: 'النوع',
    status: 'الحالة',
    pendingReview: 'بإنتظار المراجعة',
    approved: 'تمت الموافقة',
    rejected: 'مرفوض',
    noFutureExcuseDate: 'لا يمكن اختيار تاريخ مستقبلي للعذر.',
    requestSentSuccess: 'تم إرسال طلبك بنجاح.',
    leave: 'إجازة',
    excuse: 'عذر',
    sourceApp: 'التطبيق',
    sourceDevice: 'جهاز البصمة',
    locating: 'جاري تحديد موقعك...',
    verifyingLocation: 'جار التحقق من الموقع...',
    checkInSuccessFrom: 'تم تسجيل حضورك بنجاح من: {name}',
    saveAttendanceError: 'تعذر حفظ سجل الحضور في النظام.',
    notInAnyLocation: 'أنت لست في نطاق أي موقع عمل مسجل.',
    enableLocationPermission: 'يرجى تفعيل صلاحية الوصول للموقع في المتصفح.',
    locationError: 'حدث خطأ أثناء الحصول على الموقع.',
    allowLocation: 'السماح باستخدام الموقع',
    latenessOrdinal: 'هذا هو تأخيرك رقم {n} هذا الشهر.',
    mandatoryExcuseRequiredTitle: 'سبب إلزامي للتأخير',
    mandatoryExcuseRequiredBody: 'لقد تجاوزت الحد المسموح به للتأخير هذا الشهر. يرجى إدخال سبب التأخير للمتابعة.',
    cancel: 'إلغاء',
    sendAndCheckIn: 'إرسال وتسجيل الحضور',
    chatWithAdmin: 'محادثة مع الإدارة',
    closed: 'مغلقة',
    open: 'مفتوحة',
    hide: 'إخفاء',
    show: 'إظهار',
    adminLabel: 'الإداري',
    me: 'أنا',
    chatWillAppear: 'سيظهر هنا سجل المحادثة عند بدء الإدارة للمحادثة.',
    chatClosedPlaceholder: 'المحادثة مغلقة',
    typeMessage: 'اكتب رسالة...',
    send: 'إرسال',
    cannotSendChatClosed: 'لا يمكن الإرسال. المحادثة مغلقة.',
    adminChatStarted: 'بدأت الإدارة محادثة جديدة معك.',
    newChat: 'محادثة جديدة',
    adminStartedChatTapToOpen: 'الإدارة بدأت محادثة معك. اضغط لفتح الدردشة.',
    adminChatClosed: 'تم إغلاق المحادثة من قبل الإدارة',
    reasonEmptyError: 'السبب لا يمكن أن يكون فارغاً.',
    checkOutSuccess: 'تم تسجيل انصرافك بنجاح.',
    // Admin / Navigation
    menu: 'القائمة',
    execSummary: 'الملخص التنفيذي',
    analyticsTab: 'التحليلات',
    requestsManagement: 'إدارة الطلبات',
    reportsTab: 'التقارير',
    chatsTab: 'المحادثات',
    sendNotificationTab: 'إرسال تنبيه',
    settingsTab: 'الإعدادات',
    totalAttendanceToday: 'إجمالي الحضور اليوم',
    lateToday: 'متأخرون اليوم',
    absentToday: 'غياب اليوم',
    viewMonthlyReport: 'عرض التقرير الشهري',
    autoGenerated: 'الذي تم إنشاؤه تلقائياً',
    performanceAnalytics: 'تحليلات الأداء',
    attendanceVsAbsenceLast14d: 'الحضور مقابل الغياب (آخر 14 يوم)',
    totalLatenessMinutesLast14d: 'مجموع دقائق التأخير (آخر 14 يوم)',
    dailyLatenessCount: 'عدد التأخيرات اليومية',
    attendanceAbsenceRatioTotal: 'نسبة الحضور/الغياب (إجمالي)',
    all: 'الكل',
    pendingShort: 'قيد الانتظار',
    searchByNameReasonType: 'بحث بالاسم/السبب/النوع',
    selectAll: 'تحديد الكل',
    approveSelected: 'اعتماد المحدد',
    rejectSelected: 'رفض المحدد',
    selectedCount: 'المحدد: {n}',
    select: 'تحديد',
    employeeLabel2: 'الموظف',
    action: 'إجراء',
    noMatchingResults: 'لا توجد نتائج مطابقة.',
    advancedReports: 'نظام التقارير المتقدم',
    generateMonthlyReport: 'توليد التقرير الشهري',
    absenceHeatmapTitle: 'الخريطة الحرارية للغياب - {month} {year}',
    present: 'حضور',
    absent: 'غياب',
    latenessCount: 'عدد التأخيرات',
    totalLatenessMinutes: 'مجموع دقائق التأخير',
    // Admin Reports - headers and statuses
    absenceReportsTitle: 'تقارير الغياب',
    absenceType: 'نوع الغياب',
    reasonCol: 'السبب',
    adminNote: 'ملاحظات الإداري',
    dayStatusLabel: 'حالة اليوم',
    totalHoursLabel: 'إجمالي الساعات',
    timeInLabel: 'وقت الحضور',
    timeOutLabel: 'وقت الانصراف',
    minutesLabel: 'دقائق',
    hoursLabel: 'ساعات',
    presentStatus: 'حاضر',
    lateStatus: 'متأخر',
    onLeaveStatus: 'بإجازة',
    excuseAcceptedStatus: 'بعذر مقبول',
    excuseRejectedStatus: 'بعذر مرفوض',
    underReviewStatus: 'قيد المراجعة',
    unjustifiedStatus: 'غير مبرر',
    officialExcusesTitle: 'الاعتذارات الرسمية',
    // Admin Chat
    liveChatsTitle: 'المحادثات المباشرة',
    employeeListTitle: 'قائمة الموظفين',
    pickEmployeeToChat: 'اختر موظفًا للدردشة',
    searchByNamePlaceholder: 'ابحث بالاسم...',
    clear: 'مسح',
    chatOpen: 'محادثة مفتوحة',
    noChatOpen: 'لا توجد محادثة مفتوحة',
    active: 'نشطة',
    inactive: 'غير نشط',
    noResults: 'لا توجد نتائج.',
    chatHistoryTitle: 'سجل المحادثات',
    filterAll: 'الكل',
    filterOpen: 'المفتوحة',
    filterClosed: 'المغلقة',
    searchNameLastMessagePlaceholder: 'بحث في الاسم/آخر رسالة...',
    youLabel: 'أنت:',
    employeeLabelGeneric: 'الموظف',
    closedAt: 'أُغلِقت:',
    noHistoryResults: 'لا توجد نتائج في السجل.',
    chatClosedBanner: 'المحادثة مغلقة. لا يمكن إرسال رسائل جديدة حتى يبدأ الإداري محادثة جديدة.',
    closeChat: 'إغلاق المحادثة',
    hide: 'إخفاء',
    impersonatePrefix: 'الدخول كـ',
    startChatBySending: 'ابدأ المحادثة بإرسال رسالة.',
    typeTextMessagePlaceholder: 'اكتب رسالة نصية...',
    selectEmployeeToStart: 'اختر موظفًا من القائمة لبدء محادثة جانبية.',
    adminLabel2: 'الإداري',
    cannotSendClosed: 'لا يمكن الإرسال. المحادثة مغلقة.',
    // Notifications section
    sendNotificationTitle: 'إرسال تنبيه',
    sendNotificationDesc: 'واجهة لإرسال تنبيهات عامة أو خاصة للموظفين.',
    notifyEmployeeTitle: 'تنبيه مخصص لموظف',
    notifyAllTitle: 'تنبيه عام لجميع الموظفين',
    selectEmployee: 'اختر الموظف',
    titleLabel: 'العنوان',
    messageLabel: 'الرسالة',
    adminNotificationTitleDefault: 'تنبيه إداري',
    generalNotificationTitleDefault: 'إشعار عام',
    // Settings - basic attendance
    basicAttendanceSettings: 'إعدادات الحضور الأساسية',
    collapseSection: 'طي القسم',
    workStartTime: 'وقت بدء الدوام',
    latestAllowedTimeLabel: 'آخر وقت مسموح بدون تأخير',
    allowedLatenessPerMonth: 'عدد مرات التأخير المسموح (شهريًا)',
    saveChanges: 'حفظ التغييرات',
    // Settings - approved locations
    approvedLocationsTitle: 'إدارة المواقع المعتمدة للحضور',
    closeForm: 'إغلاق النموذج',
    addNewLocation: 'إضافة موقع جديد',
    locationName: 'اسم الموقع',
    locationNamePlaceholder: 'مثال: فرع الرياض – المبنى الرئيسي',
    radiusMeters: 'نصف القطر (متر)',
    rangeLabel: 'النطاق:',
    interactiveMap: 'الخريطة التفاعلية',
    latitude: 'خط العرض',
    longitude: 'خط الطول',
    useMyLocation: 'استخدام موقعي الحالي',
    enterLocationNameToast: 'يرجى إدخال اسم الموقع.',
    locationSavedToast: 'تم حفظ الموقع بنجاح',
    locationSaveFailedToast: 'تعذر حفظ الموقع. تأكد من اتصال الخادم.',
    nameCol: 'الاسم',
    radiusCol: 'نصف القطر (م)',
    actionsCol: 'إجراءات',
    save: 'حفظ',
    cancel: 'إلغاء',
    edit: 'تعديل',
    delete: 'حذف',
    locationUpdatedToast: 'تم تحديث الموقع',
    updateFailedToast: 'فشل التحديث. تحقق من الخادم.',
    locationDeletedToast: 'تم حذف الموقع',
    deleteFailedToast: 'فشل الحذف. تحقق من الخادم.',
    saveLocation: 'حفظ الموقع',
    metersUnit: 'متر',
    dragToChangePosition: 'اسحب لتغيير الموضع',
    geoLocationFailedToast: 'تعذر الحصول على موقعك الحالي.',
    // Settings - notifications
    notificationsSettingsTitle: 'إعدادات التنبيهات',
    morningReminder: 'تنبيه التذكير الصباحي',
    instantLateNotification: 'تنبيه التأخير الفوري',
    instantLatePlaceholder: 'أنت متأخر! آخر وقت مسموح للحضور كان [الوقت]',
    autoRequestReason: 'طلب سبب التأخير تلقائيًا',
    autoRequestPlaceholder: 'لقد تأخرت [X] مرات هذا الشهر. يُرجى إدخال سبب التأخير',
    // Settings - monthly report
    monthlyReportSettingsTitle: 'إعدادات التقارير الشهرية',
    autoGenDate: 'تاريخ التوليد التلقائي',
    includeLateList: 'قائمة الموظفين المتأخرين',
    includeTotalLateHours: 'إجمالي ساعات التأخير لكل موظف',
    includeUnexcusedAbsences: 'ملخص الغيابات غير المبررة',
    includeLeaveExcuseSummary: 'ملخص طلبات الإجازة والعذر',
    includeDeptComparison: 'مقارنة أداء الأقسام',
    exportPdfDefault: 'تصدير PDF (افتراضي)',
    enableExcelExport: 'تفعيل تصدير Excel',
    // Settings - fingerprint integration
    fingerprintIntegrationTitle: 'التكامل مع نظام البصمة (اختياري)',
    fingerprintApiUrlLabel: 'رابط API نظام البصمة',
    fingerprintApiUrlPlaceholder: 'http://qssun.dyndns.org:8085/personnel/api/',
    fingerprintUsernameLabel: 'اسم المستخدم (لن يتم تخزينه بعد المزامنة)',
    fingerprintUsernamePlaceholder: 'admin',
    fingerprintPasswordLabel: 'كلمة المرور (لن يتم تخزينها بعد المزامنة)',
    fingerprintPasswordPlaceholder: 'Admin@123',
    testConnection: 'اختبار الاتصال',
    saveUrlOnly: 'حفظ الرابط فقط',
    connectionOk: 'تم الاتصال بنجاح',
    connectionFailed: 'تعذر الاتصال',
    connectionTestFailed: 'فشل اختبار الاتصال. تحقق من الشبكة/الخادم.',
    fingerprintWarning: '⚠️ تُستخدم بيانات الدخول فقط لجلب قائمة الموظفين الأولية — لا تُخزّن في النظام بعد المزامنة.',
    // Settings - users management
    usersManagementTitle: 'إدارة المستخدمين',
    createAdminTitle: 'إنشاء حساب إداري جديد',
    createEmployeeTitle: 'إنشاء حساب موظف جديد',
    nameLabelGeneric: 'الاسم',
    usernameLabelGeneric: 'اسم المستخدم',
    passwordLabelGeneric: 'كلمة المرور',
    departmentLabelGeneric: 'القسم (اختياري)',
    createAccountAction: 'إنشاء الحساب',
    usersTableTitle: 'قائمة المستخدمين',
    roleColGeneric: 'الدور',
    departmentColGeneric: 'القسم',
    createdAtColGeneric: 'تاريخ الإنشاء',
    accountCreatedToast: 'تم إنشاء الحساب بنجاح',
    accountSaveFailedToast: 'تعذر إنشاء الحساب. تحقق من الخادم.',
    userDeletedToast: 'تم حذف المستخدم',
    userDeleteFailedToast: 'فشل حذف المستخدم. تحقق من الخادم.',
  },
  en: {
    companyLogoAlt: 'Future Cities Energy logo',
    developerLogoAlt: 'Developer logo',
    companyName: 'Future Cities Energy Co.',
    appTitle: 'Attendance and Time Management System',
    subtitle: 'Attendance and Time Management System',
    notifications: 'Notifications',
    markAllRead: 'Mark all as read',
    noNotifications: 'No notifications',
    markRead: 'Read',
    hello: 'Hello',
    admin: 'Admin',
    employee: 'Employee',
    loading: 'Loading...',
    developedBy: 'Developed by',
    langAR: 'AR',
    langEN: 'EN',
    // Login card
    loginTitle: 'Sign in',
    loginSubtitle: 'Enter your credentials to continue',
    usernamePlaceholder: 'Username',
    passwordPlaceholder: 'Password',
    loginButton: 'Sign in',
    // Employee Dashboard
    attendanceStatusToday: 'Today\'s Attendance Status',
    checkIn: 'Check in',
    checkOut: 'Check out',
    dayComplete: 'You\'ve completed your day successfully!',
    notCheckedInYet: 'No check-in recorded yet.',
    checkedInAt: 'You checked in at:',
    checkedOutAt: 'You checked out at:',
    lateByMinutes: 'Late by {n} minutes',
    mustCheckoutViaDevice: 'You must check out via the fingerprint device as well.',
    submitRequests: 'Submit Requests',
    leaveRequest: 'Leave Request',
    excuseRequest: 'Excuse Request',
    startDate: 'Start Date',
    daysCount: 'Number of days',
    daysPlaceholder: 'Duration (days)',
    leaveTypeLabel: 'Leave type',
    leaveAnnual: 'Annual',
    leaveSick: 'Sick',
    leaveEmergency: 'Emergency',
    leaveUnpaid: 'Unpaid',
    reasonOptional: 'Reason (optional)',
    leaveReasonPlaceholder: 'Leave reason (optional)',
    affectedDate: 'Affected date',
    excuseTypeLabel: 'Excuse type',
    excuseLate: 'Late',
    excuseAbsent: 'Absent',
    reason: 'Reason',
    excuseReasonPlaceholder: 'Provide the excuse reason',
    sendRequest: 'Send request',
    attendanceLog: 'Attendance Log',
    date: 'Date',
    checkInLabel: 'Check-in',
    checkOutLabel: 'Check-out',
    source: 'Source',
    tardiness: 'Tardiness',
    myRequests: 'My Requests',
    type: 'Type',
    status: 'Status',
    pendingReview: 'Pending review',
    approved: 'Approved',
    rejected: 'Rejected',
    noFutureExcuseDate: 'Cannot select a future date for excuse.',
    requestSentSuccess: 'Your request has been sent successfully.',
    leave: 'Leave',
    excuse: 'Excuse',
    sourceApp: 'App',
    sourceDevice: 'Biometric device',
    locating: 'Determining your location...',
    verifyingLocation: 'Verifying location...',
    checkInSuccessFrom: 'Checked in successfully from: {name}',
    saveAttendanceError: 'Failed to save attendance record.',
    notInAnyLocation: 'You are not within any registered work location.',
    enableLocationPermission: 'Please enable location permission in the browser.',
    locationError: 'An error occurred while obtaining location.',
    allowLocation: 'Allow Location Access',
    latenessOrdinal: 'This is your {n}th lateness this month.',
    mandatoryExcuseRequiredTitle: 'Mandatory excuse required',
    mandatoryExcuseRequiredBody: 'You exceeded the allowed lateness this month. Please provide an excuse to continue.',
    cancel: 'Cancel',
    sendAndCheckIn: 'Submit and check in',
    chatWithAdmin: 'Chat with Admin',
    closed: 'Closed',
    open: 'Open',
    hide: 'Hide',
    show: 'Show',
    adminLabel: 'Admin',
    me: 'Me',
    chatWillAppear: 'The chat log appears here when started by admin.',
    chatClosedPlaceholder: 'Chat is closed',
    typeMessage: 'Type a message...',
    send: 'Send',
    cannotSendChatClosed: 'Cannot send. Conversation is closed.',
    adminChatStarted: 'An admin started a new chat with you.',
    newChat: 'New chat',
    adminStartedChatTapToOpen: 'Admin started a chat with you. Tap to open.',
    adminChatClosed: 'The chat was closed by the admin',
    reasonEmptyError: 'Reason cannot be empty.',
    checkOutSuccess: 'Checked out successfully.',
    // Admin / Navigation
    menu: 'Menu',
    execSummary: 'Executive Summary',
    analyticsTab: 'Analytics',
    requestsManagement: 'Requests Management',
    reportsTab: 'Reports',
    chatsTab: 'Chats',
    sendNotificationTab: 'Send Notification',
    settingsTab: 'Settings',
    totalAttendanceToday: 'Total attendance today',
    lateToday: 'Late today',
    absentToday: 'Absences today',
    viewMonthlyReport: 'View monthly report',
    autoGenerated: 'Auto-generated',
    performanceAnalytics: 'Performance analytics',
    attendanceVsAbsenceLast14d: 'Attendance vs Absence (last 14 days)',
    totalLatenessMinutesLast14d: 'Total lateness minutes (last 14 days)',
    dailyLatenessCount: 'Daily lateness count',
    attendanceAbsenceRatioTotal: 'Attendance/Absence ratio (total)',
    all: 'All',
    pendingShort: 'Pending',
    searchByNameReasonType: 'Search by name/reason/type',
    selectAll: 'Select all',
    approveSelected: 'Approve selected',
    rejectSelected: 'Reject selected',
    selectedCount: 'Selected: {n}',
    select: 'Select',
    employeeLabel2: 'Employee',
    action: 'Action',
    noMatchingResults: 'No matching results.',
    advancedReports: 'Advanced Reports System',
    generateMonthlyReport: 'Generate monthly report',
    absenceHeatmapTitle: 'Absence heatmap - {month} {year}',
    present: 'Present',
    absent: 'Absent',
    latenessCount: 'Lateness count',
    totalLatenessMinutes: 'Total lateness minutes',
    // Admin Reports - headers and statuses
    absenceReportsTitle: 'Absence Reports',
    absenceType: 'Absence type',
    reasonCol: 'Reason',
    adminNote: 'Admin note',
    dayStatusLabel: 'Day status',
    totalHoursLabel: 'Total hours',
    timeInLabel: 'Check-in time',
    timeOutLabel: 'Check-out time',
    minutesLabel: 'Minutes',
    hoursLabel: 'Hours',
    presentStatus: 'Present',
    lateStatus: 'Late',
    onLeaveStatus: 'On leave',
    excuseAcceptedStatus: 'Excuse accepted',
    excuseRejectedStatus: 'Excuse rejected',
    underReviewStatus: 'Under review',
    unjustifiedStatus: 'Unjustified',
    officialExcusesTitle: 'Official Excuses',
    // Admin Chat
    liveChatsTitle: 'Live Chats',
    employeeListTitle: 'Employee list',
    pickEmployeeToChat: 'Pick an employee to chat',
    searchByNamePlaceholder: 'Search by name...',
    clear: 'Clear',
    chatOpen: 'Chat open',
    noChatOpen: 'No chat open',
    active: 'Active',
    inactive: 'Inactive',
    noResults: 'No results.',
    chatHistoryTitle: 'Chat history',
    filterAll: 'All',
    filterOpen: 'Open',
    filterClosed: 'Closed',
    searchNameLastMessagePlaceholder: 'Search name/last message...',
    youLabel: 'You:',
    employeeLabelGeneric: 'Employee',
    closedAt: 'Closed:',
    noHistoryResults: 'No results in history.',
    chatClosedBanner: 'Conversation is closed. You can’t send new messages until an admin starts a new one.',
    closeChat: 'Close chat',
    hide: 'Hide',
    impersonatePrefix: 'Sign in as',
    startChatBySending: 'Start the conversation by sending a message.',
    typeTextMessagePlaceholder: 'Type a text message...',
    selectEmployeeToStart: 'Select an employee from the list to start a side chat.',
    adminLabel2: 'Admin',
    cannotSendClosed: 'Cannot send. Conversation is closed.',
    // Notifications section
    sendNotificationTitle: 'Send Notification',
    sendNotificationDesc: 'Interface to send general or targeted notifications to employees.',
    notifyEmployeeTitle: 'Custom notification to employee',
    notifyAllTitle: 'General notification to all employees',
    selectEmployee: 'Select employee',
    titleLabel: 'Title',
    messageLabel: 'Message',
    adminNotificationTitleDefault: 'Admin alert',
    generalNotificationTitleDefault: 'General notice',
    // Settings - basic attendance
    basicAttendanceSettings: 'Basic attendance settings',
    collapseSection: 'Collapse section',
    workStartTime: 'Work start time',
    latestAllowedTimeLabel: 'Latest allowed time without lateness',
    allowedLatenessPerMonth: 'Allowed lateness count (monthly)',
    saveChanges: 'Save changes',
    // Settings - approved locations
    approvedLocationsTitle: 'Approved attendance locations',
    closeForm: 'Close form',
    addNewLocation: 'Add new location',
    locationName: 'Location name',
    locationNamePlaceholder: 'e.g., Riyadh branch – HQ',
    radiusMeters: 'Radius (meters)',
    rangeLabel: 'Range:',
    interactiveMap: 'Interactive map',
    latitude: 'Latitude',
    longitude: 'Longitude',
    useMyLocation: 'Use my current location',
    enterLocationNameToast: 'Please enter a location name.',
    locationSavedToast: 'Location saved successfully',
    locationSaveFailedToast: 'Failed to save location. Check the server connection.',
    nameCol: 'Name',
    radiusCol: 'Radius (m)',
    actionsCol: 'Actions',
    save: 'Save',
    cancel: 'Cancel',
    edit: 'Edit',
    delete: 'Delete',
    locationUpdatedToast: 'Location updated',
    updateFailedToast: 'Update failed. Check the server.',
    locationDeletedToast: 'Location deleted',
    deleteFailedToast: 'Delete failed. Check the server.',
    saveLocation: 'Save location',
    metersUnit: 'm',
    dragToChangePosition: 'Drag to change position',
    geoLocationFailedToast: 'Failed to get your current location.',
    // Settings - notifications
    notificationsSettingsTitle: 'Notification settings',
    morningReminder: 'Morning reminder',
    instantLateNotification: 'Instant lateness notification',
    instantLatePlaceholder: 'You are late! Latest allowed arrival was [time]',
    autoRequestReason: 'Auto request lateness reason',
    autoRequestPlaceholder: 'You have been late [X] times this month. Please provide a reason.',
    // Settings - monthly report
    monthlyReportSettingsTitle: 'Monthly report settings',
    autoGenDate: 'Auto-generation date',
    includeLateList: 'List of late employees',
    includeTotalLateHours: 'Total lateness hours per employee',
    includeUnexcusedAbsences: 'Unjustified absences summary',
    includeLeaveExcuseSummary: 'Leave and excuse requests summary',
    includeDeptComparison: 'Departments performance comparison',
    exportPdfDefault: 'Export PDF (default)',
    enableExcelExport: 'Enable Excel export',
    // Settings - fingerprint integration
    fingerprintIntegrationTitle: 'Fingerprint system integration (optional)',
    fingerprintApiUrlLabel: 'Fingerprint API URL',
    fingerprintApiUrlPlaceholder: 'http://qssun.dyndns.org:8085/personnel/api/',
    fingerprintUsernameLabel: 'Username (not stored after sync)',
    fingerprintUsernamePlaceholder: 'admin',
    fingerprintPasswordLabel: 'Password (not stored after sync)',
    fingerprintPasswordPlaceholder: 'Admin@123',
    testConnection: 'Test connection',
    saveUrlOnly: 'Save URL only',
    connectionOk: 'Connected successfully',
    connectionFailed: 'Connection failed',
    connectionTestFailed: 'Connection test failed. Check network/server.',
    fingerprintWarning: '⚠️ Credentials are used only to fetch the initial employees list — not stored after syncing.',
    // Settings - users management
    usersManagementTitle: 'User Management',
    createAdminTitle: 'Create New Admin Account',
    createEmployeeTitle: 'Create New Employee Account',
    nameLabelGeneric: 'Name',
    usernameLabelGeneric: 'Username',
    passwordLabelGeneric: 'Password',
    departmentLabelGeneric: 'Department (optional)',
    createAccountAction: 'Create Account',
    usersTableTitle: 'Users List',
    roleColGeneric: 'Role',
    departmentColGeneric: 'Department',
    createdAtColGeneric: 'Created At',
    accountCreatedToast: 'Account created successfully',
    accountSaveFailedToast: 'Failed to create account. Check the server.',
    userDeletedToast: 'User deleted',
    userDeleteFailedToast: 'Failed to delete user. Check the server.',
  },
};

const useI18n = (lang: Lang) => (key: string) => I18N[lang][key] ?? key;

// --- UI COMPONENTS ---

const ThemeToggle: React.FC<{ theme: 'light' | 'dark'; toggleTheme: () => void; }> = ({ theme, toggleTheme }) => (
  <button onClick={toggleTheme} className="p-2 rounded-full bg-white/60 dark:bg-gray-700/60 backdrop-blur text-gray-800 dark:text-gray-200 ring-1 ring-gray-200/60 dark:ring-gray-600/50 hover:bg-white/80 dark:hover:bg-gray-700/80 transition">
    {theme === 'light' ? <MoonIcon className="w-6 h-6" /> : <SunIcon className="w-6 h-6" />}
  </button>
);

const Header: React.FC<{ user: User | null; toggleRole: () => void; theme: 'light' | 'dark'; toggleTheme: () => void; notifications: Notification[]; onMarkRead: (id: number) => void; onMarkAllRead: () => void; lang: Lang; setLang: (l: Lang) => void; }> = ({ user, toggleRole, theme, toggleTheme, notifications, onMarkRead, onMarkAllRead, lang, setLang }) => {
    const [open, setOpen] = useState(false);
    const [blink, setBlink] = useState(false);
    const btnRef = useRef<HTMLButtonElement | null>(null);
    const unreadCount = notifications.filter(n => !n.read).length;
    const [authToken, setAuthToken] = useState<string>(() => {
      try { return localStorage.getItem('authToken') || ''; } catch { return ''; }
    });
    const [authUser, setAuthUser] = useState<{ username: string; role: string } | null>(null);
    const [showLogin, setShowLogin] = useState(false);
    const [loginLoading, setLoginLoading] = useState(false);
    const [loginError, setLoginError] = useState('');
    const [loginForm, setLoginForm] = useState<{ username: string; password: string }>({ username: '', password: '' });
    const t = useI18n(lang);

    useEffect(() => {
      if (unreadCount > 0) {
        setBlink(true);
        const t = setTimeout(() => setBlink(false), 1500);
        return () => clearTimeout(t);
      }
    }, [unreadCount]);

    useEffect(() => {
      async function loadMe() {
        try {
          if (!authToken) { setAuthUser(null); return; }
          const me = await api.get('/me');
          setAuthUser(me.user);
        } catch {
          setAuthUser(null);
        }
      }
      loadMe();
    }, [authToken]);

    const handleLogin = async () => {
      try {
        setLoginLoading(true);
        setLoginError('');
        const { token, user } = await api.login(loginForm.username.trim(), loginForm.password);
        try {
          localStorage.setItem('authToken', token);
          if (user && user.role) localStorage.setItem('authRole', String(user.role).toLowerCase());
        } catch {}
        setAuthToken(token);
        setAuthUser(user);
        setShowLogin(false);
      } catch (e: any) {
        setLoginError(e?.message || 'Login failed');
      } finally {
        setLoginLoading(false);
      }
    };

    const handleLogout = async () => {
      try { await api.logout(); } catch {}
      try { localStorage.removeItem('authToken'); localStorage.removeItem('authRole'); } catch {}
      setAuthToken('');
      setAuthUser(null);
    };

    const latest10 = notifications.slice().sort((a,b)=>new Date(b.timestamp).getTime()-new Date(a.timestamp).getTime()).slice(0,10);
    const itemClasses = (n: Notification) => n.read
      ? 'bg-gray-50 text-gray-700 dark:bg-gray-800/60 dark:text-gray-300'
      : 'bg-blue-50 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200';

    return (
        <header className="sticky top-0 z-30 backdrop-blur supports-[backdrop-filter]:bg-white/70 bg-white/80 dark:bg-gray-900/70 ring-1 ring-gray-200/60 dark:ring-gray-700/60 shadow-sm">
            <div className="container mx-auto px-4 py-3 flex justify-between items-center">
            <div className="flex items-center gap-3">
        <img src="https://www2.0zz0.com/2025/10/28/09/441262869.png" alt={t('companyLogoAlt')} className="h-10 md:h-11 object-contain" />
                <div className="leading-tight hidden sm:block">
      <h1 className="text-lg md:text-xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-700 to-blue-600 dark:from-indigo-300 dark:to-blue-200 bg-clip-text text-transparent">شركة مدائن المستقبل للطاقة</h1>
                  <div className="text-[11px] md:text-xs text-gray-500 dark:text-gray-300">{t('subtitle')}</div>
                </div>
            </div>
            <div className="flex items-center gap-3 relative">
                <div className="h-6 w-px bg-gray-200 dark:bg-gray-700 hidden md:block" aria-hidden="true"></div>
                {user && (
                    <button ref={btnRef} onClick={() => setOpen(v => !v)} className="relative p-2 rounded-full bg-white/60 dark:bg-gray-700/60 backdrop-blur ring-1 ring-gray-200/60 dark:ring-gray-600/50 hover:bg-white/80 dark:hover:bg-gray-700/80 transition">
                        <BellIcon className={`w-6 h-6 ${blink ? 'animate-pulse' : ''}`}/>
                        {unreadCount > 0 && <span className="absolute -top-0.5 -right-0.5 block h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white dark:ring-gray-800"></span>}
                    </button>
                )}
                {open && (
                  <div className="absolute top-full mt-2 right-0 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-xl ring-1 ring-gray-200/60 dark:ring-gray-700/60 overflow-hidden z-30">
                    <div className="flex items-center justify-between px-3 py-2 border-b dark:border-gray-700">
                      <div className="text-sm font-semibold">{t('notifications')}</div>
                      <button onClick={onMarkAllRead} className="text-xs px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600">{t('markAllRead')}</button>
                    </div>
                    <ul className="max-h-96 overflow-y-auto">
                      {latest10.length === 0 && (
                        <li className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400">{t('noNotifications')}</li>
                      )}
                      {latest10.map(n => (
                        <li key={n.id} className={`px-3 py-2 text-sm border-b dark:border-gray-700 ${itemClasses(n)}`}>
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="font-medium truncate">{n.title}</div>
                              <div className="text-xs opacity-80 truncate">{n.message}</div>
                              <div className="text-[11px] opacity-70 mt-1">{new Date(n.timestamp).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US')}</div>
                            </div>
                            {!n.read && (
                              <button onClick={() => onMarkRead(n.id)} className="text-[11px] px-2 py-1 rounded-md bg-gray-900 text-white dark:bg-gray-700">{t('markRead')}</button>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="h-6 w-px bg-gray-200 dark:bg-gray-700 hidden sm:block" aria-hidden="true"></div>
                {user ? (
                    <span className="text-gray-600 dark:text-gray-300 hidden sm:inline">{t('hello')}, {user.name} ({user.role})</span>
                ) : <span className="text-gray-600 dark:text-gray-300">{t('loading')}</span>}
                <div className="h-6 w-px bg-gray-200 dark:bg-gray-700 hidden sm:block" aria-hidden="true"></div>
                {/* إصلاح البار: إزالة زر الدخول المنبثق، وإبقاء الخروج فقط عند وجود توكن */}
                {authToken && (
                  <button onClick={handleLogout} className="px-3 py-1 text-sm rounded-md bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600">تسجيل الخروج</button>
                )}
                {/* Language toggle, does not change layout direction */}
                <div className="inline-flex items-center rounded-full bg-white/60 dark:bg-gray-700/60 backdrop-blur ring-1 ring-gray-200/60 dark:ring-gray-600/50 p-1">
                  <button onClick={() => setLang('ar')} className={`px-2.5 py-1 text-xs md:text-sm rounded-full transition ${lang==='ar' ? 'bg-gradient-to-r from-indigo-600 to-blue-500 text-white shadow-sm' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'}`}>{t('langAR')}</button>
                  <button onClick={() => setLang('en')} className={`px-2.5 py-1 text-xs md:text-sm rounded-full transition ${lang==='en' ? 'bg-gradient-to-r from-indigo-600 to-blue-500 text-white shadow-sm' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'}`}>{t('langEN')}</button>
                </div>
                <ThemeToggle theme={theme} toggleTheme={toggleTheme} />
            </div>
            {/* Close container div */}
            </div>
        </header>
    );
};


const Footer: React.FC<{ lang: Lang }> = ({ lang }) => {
  const t = useI18n(lang);
  return (
    <footer className="text-center p-4 text-sm text-gray-500 dark:text-gray-400 mt-auto">
      <div className="flex items-center justify-center gap-2">
        <span>{t('developedBy')}</span>
        <img src="https://www2.0zz0.com/2025/10/28/09/583635552.gif" alt="شعار المطور" className="h-8 rounded-full" />
        <span>&copy; {new Date().getFullYear()}</span>
      </div>
    </footer>
  );
};

const Toast: React.FC<{ message: string; type: 'success' | 'error' | 'warning'; onClose: () => void }> = ({ message, type, onClose }) => {
    const baseClasses = "fixed top-5 right-5 p-4 rounded-lg shadow-lg flex items-center gap-3 animate-fade-in-down z-50";
    const typeClasses = {
        success: "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200",
        error: "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200",
        warning: "bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200",
    };

    useEffect(() => {
        const timer = setTimeout(onClose, 5000);
        return () => clearTimeout(timer);
    }, [onClose]);

    return (
        <div className={`${baseClasses} ${typeClasses[type]}`}>
            {type === 'success' && <CheckCircleIcon className="w-6 h-6" />}
            {type === 'error' && <XCircleIcon className="w-6 h-6" />}
            {type === 'warning' && <ExclamationIcon className="w-6 h-6" />}
            <span>{message}</span>
            <button onClick={onClose} className="mr-auto -my-1 -mr-1 p-1">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"></path></svg>
            </button>
        </div>
    );
};

const Modal: React.FC<{ title: string; children: React.ReactNode; onClose: () => void; }> = ({ title, children, onClose }) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md animate-fade-in-up">
            <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
                <h3 className="text-lg font-bold">{title}</h3>
                <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"></path></svg>
                </button>
            </div>
            <div className="p-6">{children}</div>
        </div>
    </div>
);


// مكونات إرسال التنبيهات من لوحة الإداري (مستوى الوحدة)
const EmployeeNotificationForm: React.FC<{ users: User[]; onSent: (n: Notification) => void }> = ({ users, onSent }) => {
  const [lang, setLangDummy] = useState<Lang>('ar'); // will be overridden from outer scope if needed
  // try to detect from body dir or leave default
  const t = useI18n((document?.documentElement?.getAttribute('data-lang') as Lang) || 'ar');
  const [targetId, setTargetId] = useState<number | null>(users.find(u=>u.role===UserRole.EMPLOYEE)?.id || null);
  const [title, setTitle] = useState(t('adminNotificationTitleDefault'));
  const [message, setMessage] = useState('');
  const send = async () => {
    if (!targetId || !message.trim()) return;
    const payload = { title, message, targetUserIds: [targetId] };
    try {
      const res = await api.post('/notifications', payload);
      const n: Notification = {
        id: res?.id || Date.now(),
        title,
        message,
        timestamp: res?.timestamp || new Date().toISOString(),
        read: false,
        targetUserIds: [targetId],
      };
      onSent(n);
    } catch {}
    setMessage('');
  };
  return (
    <div className="space-y-3">
      <label className="block text-sm">{t('selectEmployee')}</label>
      <select value={targetId ?? ''} onChange={e=>setTargetId(Number(e.target.value))} className="w-full px-3 py-2 rounded-md bg-white dark:bg-gray-700">
        {users.filter(u=>u.role===UserRole.EMPLOYEE).map(u=> (
          <option key={u.id} value={u.id}>{u.name}</option>
        ))}
      </select>
      <label className="block text-sm">{t('titleLabel')}</label>
      <input value={title} onChange={e=>setTitle(e.target.value)} className="w-full px-3 py-2 rounded-md bg-white dark:bg-gray-700" />
      <label className="block text-sm">{t('messageLabel')}</label>
      <textarea value={message} onChange={e=>setMessage(e.target.value)} className="w-full px-3 py-2 rounded-md bg-white dark:bg-gray-700" />
      <button onClick={send} className="px-4 py-2 rounded-md bg-gradient-to-r from-indigo-600 to-blue-500 text-white hover:from-indigo-700 hover:to-blue-600">{t('send')}</button>
    </div>
  );
};

const GeneralNotificationForm: React.FC<{ onSent: (n: Notification) => void }> = ({ onSent }) => {
  const t = useI18n((document?.documentElement?.getAttribute('data-lang') as Lang) || 'ar');
  const [title, setTitle] = useState(t('generalNotificationTitleDefault'));
  const [message, setMessage] = useState('');
  const send = async () => {
    if (!message.trim()) return;
    const payload = { title, message, targetUserIds: null };
    try {
      const res = await api.post('/notifications', payload);
      const n: Notification = {
        id: res?.id || Date.now(),
        title,
        message,
        timestamp: res?.timestamp || new Date().toISOString(),
        read: false,
        targetUserIds: undefined,
      };
      onSent(n);
    } catch {}
    setMessage('');
  };
  return (
    <div className="space-y-3">
      <label className="block text-sm">{t('titleLabel')}</label>
      <input value={title} onChange={e=>setTitle(e.target.value)} className="w-full px-3 py-2 rounded-md bg-white dark:bg-gray-700" />
      <label className="block text-sm">{t('messageLabel')}</label>
      <textarea value={message} onChange={e=>setMessage(e.target.value)} className="w-full px-3 py-2 rounded-md bg-white dark:bg-gray-700" />
      <button onClick={send} className="px-4 py-2 rounded-md bg-gradient-to-r from-indigo-600 to-blue-500 text-white hover:from-indigo-700 hover:to-blue-600">{t('send')}</button>
    </div>
  );
};

// --- App ---

export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem('lang') as Lang) || 'ar');
  const t = useI18n(lang);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Auth presence at app-level to show dedicated login page
  const [authPresent, setAuthPresent] = useState<boolean>(() => {
    try { return !!localStorage.getItem('authToken'); } catch { return false; }
  });
  const [loginForm, setLoginForm] = useState<{ username: string; password: string }>({ username: '', password: '' });
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Data state
  const [users, setUsers] = useState<User[]>([]);
  const [locations, setLocations] = useState<ApprovedLocation[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const defaultSettings: SystemSettings = {
    attendanceStartTime: '08:00',
    latestAllowedTime: '08:15',
    allowedLatenessPerMonthBeforeReason: 3,
    morningReminderEnabled: true,
    morningReminderTime: '07:50',
    instantLateNotificationEnabled: true,
    instantLateMessageTemplate: 'أنت متأخر! آخر وقت مسموح للحضور كان [الوقت]',
    autoRequestReasonEnabled: true,
    autoRequestMessageTemplate: 'لقد تأخرت [X] مرات هذا الشهر. يُرجى إدخال سبب التأخير',
    autoReportDay: 25,
    reportIncludeLateList: true,
    reportIncludeTotalLateHours: true,
    reportIncludeUnexcusedAbsences: true,
    reportIncludeLeaveAndExcuseSummary: true,
    reportIncludeDepartmentComparison: true,
    exportPdf: true,
    exportExcel: false,
    fingerprintApiUrl: 'http://qssun.dyndns.org:8085/personnel/api/',
    fingerprintUsername: 'admin',
    fingerprintPassword: 'Admin@123',
  };
  const [settings, setSettings] = useState<SystemSettings>(() => {
    try {
      const raw = localStorage.getItem('system_settings');
      return raw ? { ...defaultSettings, ...JSON.parse(raw) } : defaultSettings;
    } catch { return defaultSettings; }
  });
  const saveSettings = (next: Partial<SystemSettings>) => {
    setSettings(prev => {
      const merged = { ...prev, ...next };
      try { localStorage.setItem('system_settings', JSON.stringify(merged)); } catch {}
      showToast('تم تحديث الإعدادات بنجاح', 'success');
      return merged;
    });
  };
  
  const showToast = (message: string, type: 'success' | 'error' | 'warning') => {
    setToast({ message, type });
  };

  // تفاصيل الملخص التنفيذي (بيانات مباشرة من القاعدة)
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailType, setDetailType] = useState<'PRESENT'|'LATE'|'ABSENT'|'NONE'>('NONE');
  const [detailDateIso, setDetailDateIso] = useState<string>(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const dd = String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${dd}`;
  });
  const [detailRecords, setDetailRecords] = useState<AttendanceRecord[]>([]);

  const loadDetailsForDay = async (kind: 'PRESENT'|'LATE'|'ABSENT') => {
    try {
      const start = `${detailDateIso}T00:00:00.000Z`;
      const end = `${detailDateIso}T23:59:59.999Z`;
      const rows = await api.get(`/attendance?from=${encodeURIComponent(start)}&to=${encodeURIComponent(end)}`);
      setDetailType(kind);
      setDetailRecords(rows || []);
      setDetailOpen(true);
    } catch {
      setDetailType(kind);
      setDetailRecords([]);
      setDetailOpen(true);
    }
  };

  const formatTime = (iso?: string) => iso ? new Date(iso).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : '—';

  // Geolocation: show a banner and request permission when user clicks
  const [geoPromptVisible, setGeoPromptVisible] = useState<boolean>(false);
  useEffect(() => {
    try {
      const perms = (navigator as any).permissions;
      if (perms && typeof perms.query === 'function') {
        perms.query({ name: 'geolocation' }).then((status: any) => {
          setGeoPromptVisible(status.state !== 'granted');
          if (typeof status.onchange === 'function') {
            status.onchange = () => setGeoPromptVisible(status.state !== 'granted');
          }
        }).catch(() => setGeoPromptVisible(true));
      } else {
        // Older browsers: show prompt banner
        setGeoPromptVisible(true);
      }
    } catch { setGeoPromptVisible(true); }
  }, []);

  const requestLocationAccess = () => {
    if (!('geolocation' in navigator)) {
      showToast(t('locationError'), 'error');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      () => {
        setGeoPromptVisible(false);
      },
      (error) => {
        showToast(error && (error as any).code === (navigator as any).geolocation?.PERMISSION_DENIED ? t('enableLocationPermission') : t('locationError'), 'warning');
        setGeoPromptVisible(true);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Keep authPresent in sync with localStorage changes
  useEffect(() => {
    const fn = () => {
      try { setAuthPresent(!!localStorage.getItem('authToken')); } catch { setAuthPresent(false); }
    };
    const id = setInterval(fn, 500);
    window.addEventListener('storage', fn);
    return () => { clearInterval(id); window.removeEventListener('storage', fn); };
  }, []);

  const handleAppLogin = async () => {
    try {
      setLoginLoading(true);
      setLoginError('');
      const { token, user } = await api.login(loginForm.username.trim(), loginForm.password);
      try {
        localStorage.setItem('authToken', token);
        if (user && user.role) localStorage.setItem('authRole', String(user.role).toLowerCase());
      } catch {}
      setAuthPresent(true);
    } catch (e: any) {
      setLoginError(e?.message || 'Login failed');
    } finally {
      setLoginLoading(false);
    }
  };

  useEffect(() => {
    const localTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    if (localTheme) {
      setTheme(localTheme);
      document.documentElement.classList.toggle('dark', localTheme === 'dark');
    } else {
      // الوضع الافتراضي داكن للأول مرة
      setTheme('dark');
      document.documentElement.classList.add('dark');
    }

    const fetchData = async () => {
      // بيانات وهمية للاستخدام عند فشل الاتصال
      const sampleUsers: User[] = [
        { id: 1, name: 'فيصل النتيفي', role: UserRole.ADMIN, department: 'الإدارة' },
        { id: 2, name: 'موظف تجريبي', role: UserRole.EMPLOYEE, department: 'غير محدد' },
      ];
      const sampleLocations: ApprovedLocation[] = [
        { id: 1, name: 'المقر الرئيسي', latitude: 24.7136, longitude: 46.6753, radius: 500 },
      ];
      const sampleAttendance: AttendanceRecord[] = [
        { id: 1, userId: 2, checkIn: new Date().toISOString(), isLate: false, lateMinutes: 0, source: 'التطبيق' },
      ];

      try {
        let usersRes: any = null;
        let locationsRes: any = null;

        try {
          usersRes = await api.get('/users');
        } catch (e) {
          usersRes = [];
          showToast('فشل تحميل قائمة الموظفين من قاعدة البيانات.', 'error');
        }
        try {
          locationsRes = await api.get('/approved-locations');
        } catch (e) {
          locationsRes = [];
          showToast('فشل تحميل المواقع المعتمدة من قاعدة البيانات.', 'error');
        }

        // تحويل المستخدمين إلى الصيغة الداخلية
        const employees: User[] = (Array.isArray(usersRes) ? usersRes : usersRes?.results || usersRes || []).map((e: any) => ({
          id: Number(e.id ?? Date.now()),
          name: String(e.name || 'موظف'),
          role: String(e.role).toLowerCase() === 'admin' ? UserRole.ADMIN : UserRole.EMPLOYEE,
          department: String(e.department || 'غير محدد'),
        }));

        setUsers(employees);
        setLocations(Array.isArray(locationsRes) ? locationsRes : []);

        // تحميل سجلات الحضور من قاعدة بياناتنا، أو بيانات وهمية عند الفشل
        let att: any = [];
        try {
          att = await api.get('/attendance');
        } catch (e) {
          att = [];
          showToast('فشل تحميل سجلات الحضور من قاعدة البيانات.', 'error');
        }
        const attNormalized: AttendanceRecord[] = (Array.isArray(att) ? att : []).map((r: any) => ({
          id: Number(r.id),
          userId: Number(r.user_id),
          checkIn: new Date(r.check_in).toISOString(),
          checkOut: r.check_out ? new Date(r.check_out).toISOString() : undefined,
          isLate: !!r.is_late,
          lateMinutes: Number(r.late_minutes || 0),
          excuseReason: r.excuse_reason || undefined,
          mandatoryExcuseReason: r.mandatory_excuse_reason || undefined,
          locationId: r.location_id || undefined,
          source: r.source || 'التطبيق',
        }));
        setAttendance(attNormalized);

        // اختر مستخدمًا افتراضيًا بناءً على الدور بعد المصادقة
        let desiredRole: UserRole | null = null;
        try {
          const r = (localStorage.getItem('authRole') || '').toLowerCase();
          if (r === 'admin') desiredRole = UserRole.ADMIN;
          else if (r === 'employee') desiredRole = UserRole.EMPLOYEE;
        } catch {}
        const defaultUser = (desiredRole ? employees.find(u => u.role === desiredRole) : employees.find(u => u.role === UserRole.EMPLOYEE))
          || employees.find(u => u.role === UserRole.ADMIN)
          || null;
        setCurrentUser(defaultUser);

        // تحميل التنبيهات لهذا المستخدم (تتضمن العامة)
        try {
          const notif = await api.get(`/notifications?userId=${defaultUser?.id || ''}&limit=50`);
          setNotifications(Array.isArray(notif) ? notif : []);
        } catch (e) {
          // فشل تحميل التنبيهات — لا يمنع التشغيل
        }
      } catch (err) {
        console.error('Failed to load initial data', err);
        setError('تعذّر تحميل البيانات من الخادم. الرجاء المحاولة لاحقاً.');
        showToast('تعذّر تحميل البيانات من الخادم.', 'error');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // عند تغيّر حالة المصادقة أو قائمة المستخدمين، أعِد اختيار المستخدم الحالي وفق الدور المخزّن
  useEffect(() => {
    if (!authPresent || !users.length) return;
    let desiredRole: UserRole | null = null;
    try {
      const r = (localStorage.getItem('authRole') || '').toLowerCase();
      if (r === 'admin') desiredRole = UserRole.ADMIN;
      else if (r === 'employee') desiredRole = UserRole.EMPLOYEE;
    } catch {}
    const nextUser = (desiredRole ? users.find(u => u.role === desiredRole) : users.find(u => u.role === UserRole.EMPLOYEE))
      || users.find(u => u.role === UserRole.ADMIN)
      || null;
    setCurrentUser(nextUser);
  }, [authPresent, users]);

  const toggleTheme = () => {
    setTheme(prev => {
      const newTheme = prev === 'light' ? 'dark' : 'light';
      localStorage.setItem('theme', newTheme);
      document.documentElement.classList.toggle('dark', newTheme === 'dark');
      return newTheme;
    });
  };

  // persist language without changing layout direction
  useEffect(() => {
    localStorage.setItem('lang', lang);
    // Sync browser tab title with selected language
    try {
      const _t = useI18n(lang);
      document.title = _t('appTitle');
    } catch {}
  }, [lang]);

  const toggleRole = () => {
      if (!currentUser) return;
      const targetRole = currentUser.role === UserRole.EMPLOYEE ? UserRole.ADMIN : UserRole.EMPLOYEE;
      const newUser = users.find(u => u.role === targetRole) || null;
      if (!newUser) {
        showToast('لا يوجد مستخدم بهذا الدور حالياً.', 'warning');
        return;
      }
      setCurrentUser(newUser);
  };

  // إشعارات: أدوات وضع كمقروء/الكل
  const markNotificationRead = async (id: number) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    try { await api.post('/notifications/read', { id }); } catch {}
  };
  const markAllNotificationsRead = async () => {
    const latest10Ids = notifications.slice().sort((a,b)=>new Date(b.timestamp).getTime()-new Date(a.timestamp).getTime()).slice(0,10).map(n=>n.id);
    setNotifications(prev => prev.map(n => latest10Ids.includes(n.id) ? { ...n, read: true } : n));
    // Batch fire-and-forget
    await Promise.all(latest10Ids.map(id => api.post('/notifications/read', { id }).catch(()=>{})));
  };
  
  const mainContent = () => {
    if (isLoading) return <div className="text-center p-10">جاري تحميل البيانات...</div>;
    if (error) return <div className="text-center p-10 text-red-500">{error}</div>;
    if (!currentUser) return <div className="text-center p-10">لم يتم العثور على مستخدمين.</div>;
    
    return currentUser.role === UserRole.EMPLOYEE ? (
      <EmployeeDashboard 
        user={currentUser} 
        showToast={showToast} 
        attendance={attendance}
        setAttendance={setAttendance}
        requests={requests} 
        setRequests={setRequests}
        locations={locations}
        notifications={notifications.filter(n => n.targetUserIds?.includes(currentUser.id) || !n.targetUserIds)}
        setNotifications={setNotifications}
        allUsers={users}
        settings={settings}
        chatMessages={chatMessages}
        setChatMessages={setChatMessages}
        lang={lang}
      />
    ) : (
      <AdminDashboard 
        users={users} 
        setUsers={setUsers}
        attendance={attendance} 
        requests={requests} 
        setRequests={setRequests}
        locations={locations}
        setLocations={setLocations}
        notifications={notifications}
        setNotifications={setNotifications}
        chatMessages={chatMessages}
        setChatMessages={setChatMessages}
        showToast={showToast}
        currentUser={currentUser}
        setCurrentUser={setCurrentUser}
        settings={settings}
        saveSettings={saveSettings}
        lang={lang}
      />
    );
  }
  // Dedicated login page when not authenticated
  if (!authPresent) {
    const t = useI18n(lang);
    return (
      <div className="font-sans bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 min-h-screen flex flex-col">
        {/* شريط علوي يضم تبديل اللغة والوضع العام */}
        <header className="sticky top-0 z-30 bg-transparent">
          <div className="container mx-auto px-4 py-3 flex justify-end items-center gap-3">
            <div className="inline-flex items-center rounded-full bg-white/60 dark:bg-gray-700/60 backdrop-blur ring-1 ring-gray-200/60 dark:ring-gray-600/50 p-1">
              <button onClick={() => setLang('ar')} className={`px-2.5 py-1 text-xs md:text-sm rounded-full transition ${lang==='ar' ? 'bg-gradient-to-r from-indigo-600 to-blue-500 text-white shadow-sm' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'}`}>{t('langAR')}</button>
              <button onClick={() => setLang('en')} className={`px-2.5 py-1 text-xs md:text-sm rounded-full transition ${lang==='en' ? 'bg-gradient-to-r from-indigo-600 to-blue-500 text-white shadow-sm' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'}`}>{t('langEN')}</button>
            </div>
            <ThemeToggle theme={theme} toggleTheme={toggleTheme} />
          </div>
        </header>
        <main className="flex-grow container mx-auto px-4 py-12 flex items-center justify-center">
          <div className="w-full max-w-lg bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-xl ring-1 ring-gray-200/60 dark:ring-gray-700/60">
            {/* شريط متدرّج أعلى البطاقة */}
            <div className="h-2 bg-gradient-to-r from-indigo-600 via-blue-500 to-purple-600"></div>
            <div className="p-7">
              <div className="text-center mb-4">
                <div className="text-lg font-semibold mb-1">{t('loginTitle')}</div>
                <div className="text-xs text-gray-500">{t('loginSubtitle')}</div>
              </div>
              {loginError && <div className="text-sm text-red-600 mb-3">{loginError}</div>}
              <div className="space-y-3">
                <input value={loginForm.username} onChange={e=>setLoginForm(f=>({ ...f, username: e.target.value }))} className="w-full text-sm px-3 py-2 rounded-md border dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200" placeholder={t('usernamePlaceholder')} />
                <input type="password" value={loginForm.password} onChange={e=>setLoginForm(f=>({ ...f, password: e.target.value }))} className="w-full text-sm px-3 py-2 rounded-md border dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200" placeholder={t('passwordPlaceholder')} />
                {/* زر الدخول بتدرّج لوني */}
                <button onClick={handleAppLogin} disabled={loginLoading} className="w-full px-4 py-2 text-sm rounded-md bg-gradient-to-r from-indigo-600 to-blue-500 text-white hover:from-indigo-700 hover:to-blue-600 disabled:opacity-50">{loginLoading ? '...' : t('loginButton')}</button>
              </div>
            </div>
          </div>
        </main>
        <Footer lang={lang} />
      </div>
    );
  }

  return (
    <div className={`font-sans bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 min-h-screen flex flex-col transition-colors duration-300`}>
      <Header user={currentUser} toggleRole={toggleRole} theme={theme} toggleTheme={toggleTheme} notifications={notifications.filter(n => !n.targetUserIds || (currentUser && n.targetUserIds?.includes(currentUser.id)))} onMarkRead={markNotificationRead} onMarkAllRead={markAllNotificationsRead} lang={lang} setLang={setLang} />
      {geoPromptVisible && (
        <div className="container mx-auto px-4 mt-3">
          <div className="mb-3 rounded-md bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 p-3 flex items-center justify-between">
            <span className="text-sm">{t('enableLocationPermission')}</span>
            <button onClick={requestLocationAccess} className="px-3 py-1.5 text-sm rounded-md bg-gradient-to-r from-indigo-600 to-blue-500 text-white hover:from-indigo-700 hover:to-blue-600">
              {t('allowLocation')}
            </button>
          </div>
        </div>
      )}
      <main className="flex-grow container mx-auto p-4 md:p-8">
         {mainContent()}
      </main>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <Footer lang={lang} />
    </div>
  );
}

// --- DASHBOARDS & SUB-COMPONENTS ---

interface EmployeeDashboardProps {
    user: User;
    showToast: (message: string, type: 'success' | 'error' | 'warning') => void;
    attendance: AttendanceRecord[];
    setAttendance: React.Dispatch<React.SetStateAction<AttendanceRecord[]>>;
    requests: Request[];
    setRequests: React.Dispatch<React.SetStateAction<Request[]>>;
    locations: ApprovedLocation[];
    notifications: Notification[];
    setNotifications: React.Dispatch<React.SetStateAction<Notification[]>>;
    allUsers: User[];
    settings: SystemSettings;
    chatMessages: ChatMessage[];
    setChatMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
    lang: Lang;
}

const EmployeeDashboard: React.FC<EmployeeDashboardProps> = ({ user, showToast, attendance, setAttendance, requests, setRequests, locations, notifications, setNotifications, allUsers, settings, chatMessages, setChatMessages, lang }) => {
    const t = useI18n(lang);
    const locale = lang === 'ar' ? 'ar-EG' : 'en-US';
    const [requestType, setRequestType] = useState<RequestType>(RequestType.LEAVE);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [isCheckingIn, setIsCheckingIn] = useState(false);
    const [checkInProgressMessage, setCheckInProgressMessage] = useState('');
    const [showMandatoryExcuseModal, setShowMandatoryExcuseModal] = useState(false);
    const [showChat, setShowChat] = useState<boolean>(false);
    const [employeeChatInput, setEmployeeChatInput] = useState<string>('');
    const [activeAdminId, setActiveAdminId] = useState<number | null>(null);

    useEffect(() => {
        const timerId = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timerId);
    }, []);

    const todayRecord = attendance.find(a => a.userId === user.id && new Date(a.checkIn).toDateString() === new Date().toDateString());

    const latenessCountThisMonth = attendance.filter(a => {
        const checkInDate = new Date(a.checkIn);
        return a.userId === user.id && a.isLate && checkInDate.getMonth() === new Date().getMonth();
    }).length;

    const handleRequestSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        // التحقق: تاريخ العذر لا يكون مستقبليًا
        if (requestType === RequestType.EXCUSE) {
          const dateStr = String(formData.get('date') || '');
          const d = new Date(dateStr + 'T00:00:00');
          const today = new Date();
          today.setHours(0,0,0,0);
          if (d.getTime() > today.getTime()) {
            showToast(t('noFutureExcuseDate'), 'error');
            return;
          }
        }

        // صياغة السبب اعتماداً على نوع الطلب
        let reasonComposed = String(formData.get('reason') || '').trim();
        if (requestType === RequestType.LEAVE) {
          const leaveType = String(formData.get('leaveType') || 'غير محدد');
          reasonComposed = `نوع الإجازة: ${leaveType}` + (reasonComposed ? ` — السبب: ${reasonComposed}` : '');
        } else {
          const excuseType = String(formData.get('excuseType') || 'غير محدد');
          reasonComposed = `نوع العذر: ${excuseType} — السبب: ${reasonComposed || '—'}`;
        }

        setRequests(prev => [...prev, {
            id: Date.now(),
            userId: user.id,
            type: requestType,
            date: formData.get('date') as string,
            reason: reasonComposed,
            status: RequestStatus.PENDING,
            // FIX: Use `Number()` for safer type conversion from form data. `parseInt` can cause errors with null/empty values.
            ...(requestType === RequestType.LEAVE && { duration: Number(formData.get('duration')) }),
        }]);
        showToast(t('requestSentSuccess'), 'success');
        // إشعار للإداري بوجود طلب جديد
        const adminIds = allUsers.filter(u => u.role === UserRole.ADMIN).map(u => u.id);
    const notif = { id: Date.now() + 1, title: 'طلب جديد', message: `لديك طلب ${requestType === RequestType.LEAVE ? 'إجازة' : 'عذر'} جديد من ${user.name}`, timestamp: new Date().toISOString(), read: false, targetUserIds: adminIds };
        setNotifications(prev => [notif, ...prev]);
    api.post('/notifications', { title: notif.title, message: notif.message, targetUserIds: adminIds }).catch(()=>{});
        e.currentTarget.reset();
    };
    
    const performCheckIn = async (mandatoryReason?: string) => {
        setIsCheckingIn(true);
        setCheckInProgressMessage(t('locating'));
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                setCheckInProgressMessage(t('verifyingLocation'));
                const { latitude, longitude } = position.coords;

                const validLocation = locations.find(loc => getDistance(latitude, longitude, loc.latitude, loc.longitude) <= loc.radius);

                if (validLocation) {
                    const now = new Date();
                    const [lh, lm] = settings.latestAllowedTime.split(':').map(n=>Number(n));
                    const lateThreshold = new Date(now.getFullYear(), now.getMonth(), now.getDate(), lh, lm, 0);
                    const isLate = now > lateThreshold;
                    const lateMinutes = isLate ? Math.round((now.getTime() - lateThreshold.getTime()) / 60000) : 0;
                    
                    const newRecord: AttendanceRecord = {
                      id: Date.now(),
                      userId: user.id,
                      checkIn: now.toISOString(),
                      isLate,
                      lateMinutes,
                      source: 'التطبيق',
                      locationId: validLocation.id,
                      ...(mandatoryReason && { mandatoryExcuseReason: mandatoryReason })
                    };

                    try {
                      const saved = await api.post('/attendance/check-in', {
                        userId: newRecord.userId,
                        locationId: newRecord.locationId,
                        source: newRecord.source,
                      });
                      setAttendance(prev => [...prev, { ...newRecord, id: Number(saved?.id || newRecord.id) }]);
                      showToast(t('checkInSuccessFrom').replace('{name}', validLocation.name), 'success');
                      // تنبيه تأخير أو حضور
                      if (isLate && settings.instantLateNotificationEnabled) {
      const lateStr = settings.latestAllowedTime;
      const lateMsg = settings.instantLateMessageTemplate.replace('[الوقت]', `${lateStr} صباحًا`);
      const lateNotif = { id: Date.now() + 2, title: 'تنبيه تأخير', message: lateMsg, timestamp: new Date().toISOString(), read: false, targetUserIds: [user.id] };
                        setNotifications(prev => [lateNotif, ...prev]);
      api.post('/notifications', { title: lateNotif.title, message: lateNotif.message, targetUserIds: [user.id] }).catch(()=>{});
                      }
                      // طلب سبب التأخير التلقائي عند تجاوز الحد
                      if (isLate && settings.autoRequestReasonEnabled) {
                        const threshold = settings.allowedLatenessPerMonthBeforeReason;
                        const newCount = latenessCountThisMonth + 1;
                        if (newCount >= threshold) {
                          const msg = settings.autoRequestMessageTemplate.replace('[X]', String(newCount));
                          const notifEmp = { id: Date.now() + 3, title: 'طلب سبب التأخير', message: msg, timestamp: new Date().toISOString(), read: false, targetUserIds: [user.id] };
                          const adminIds = allUsers.filter(u => u.role === UserRole.ADMIN).map(u => u.id);
                          const notifAdmin = { id: Date.now() + 4, title: 'تنبيه إداري', message: `${user.name} تجاوز حد التأخير المسموح.`, timestamp: new Date().toISOString(), read: false, targetUserIds: adminIds };
                          setNotifications(prev => [notifEmp, notifAdmin, ...prev]);
                          api.post('/notifications', { title: notifEmp.title, message: notifEmp.message, targetUserIds: [user.id] }).catch(()=>{});
                          api.post('/notifications', { title: notifAdmin.title, message: notifAdmin.message, targetUserIds: adminIds }).catch(()=>{});
                          setShowMandatoryExcuseModal(true);
                        }
                      }
                    } catch (err) {
                      showToast(t('saveAttendanceError'), 'error');
                    }
                } else {
                    showToast(t('notInAnyLocation'), 'error');
                }
                setIsCheckingIn(false);
                setShowMandatoryExcuseModal(false);
            },
            (error) => {
                showToast(error.code === error.PERMISSION_DENIED ? t('enableLocationPermission') : t('locationError'), 'error');
                setIsCheckingIn(false);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    };

    const handleCheckInClick = () => {
        const now = new Date();
        const lateThreshold = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 15, 0);
        if (now > lateThreshold && latenessCountThisMonth >= 2) {
             showToast(t('latenessOrdinal').replace('{n}', String(latenessCountThisMonth + 1)), 'warning');
            setShowMandatoryExcuseModal(true);
            // إشعار إلزام إدخال سبب للموظف والإداري
            const adminIds = allUsers.filter(u => u.role === UserRole.ADMIN).map(u => u.id);
      const notifEmp = { id: Date.now() + 3, title: 'سبب التأخير مطلوب', message: 'تكرر تأخيرك 3 مرات هذا الشهر — أدخل سبب التأخير قبل تسجيل الحضور.', timestamp: new Date().toISOString(), read: false, targetUserIds: [user.id] };
      const notifAdmin = { id: Date.now() + 4, title: 'تنبيه إداري', message: `الموظف ${user.name} تأخر 3 مرات هذا الشهر — يُطلب منه إدخال سبب`, timestamp: new Date().toISOString(), read: false, targetUserIds: adminIds };
            setNotifications(prev => [notifEmp, notifAdmin, ...prev]);
      api.post('/notifications', { title: notifEmp.title, message: notifEmp.message, targetUserIds: [user.id] }).catch(()=>{});
      api.post('/notifications', { title: notifAdmin.title, message: notifAdmin.message, targetUserIds: adminIds }).catch(()=>{});
        } else {
            performCheckIn();
        }
    };
    
    const handleMandatoryExcuseSubmit = (reason: string) => {
        if (!reason.trim()) {
            showToast(t('reasonEmptyError'), 'error');
            return;
        }
        performCheckIn(reason);
    };

    const handleCheckOut = async () => {
        if (!todayRecord) {
            showToast(t('notCheckedInYet'), 'warning');
            return;
        }
        try {
            const res = await api.post('/attendance/check-out', { userId: user.id });
            const co = String(res?.checkOut || new Date().toISOString());
            setAttendance(prev => prev.map(rec => rec.id === todayRecord.id ? { ...todayRecord, checkOut: co } : rec));
            showToast(t('checkOutSuccess'), 'success');
        } catch (e: any) {
            const msg = e?.message || '';
            if (msg.includes('Already checked out')) showToast(t('dayComplete'), 'warning');
            else if (msg.includes('No check-in')) showToast(t('notCheckedInYet'), 'warning');
            else showToast('تعذّر تسجيل الانصراف من الخادم.', 'error');
        }
    };
    
    // افتح صندوق الدردشة تلقائياً عند تلقي رسالة جديدة من الإداري
    useEffect(() => {
        const adminIds = allUsers.filter(u => u.role === UserRole.ADMIN).map(u => u.id);
        const latestIncoming = [...chatMessages]
          .filter(m => adminIds.includes(m.fromUserId) && m.toUserId === user.id)
          .sort((a,b)=> new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
          .slice(-1)[0];
        if (latestIncoming) {
            const closedMsgAr = I18N.ar.adminChatClosed;
            const closedMsgEn = I18N.en.adminChatClosed;
            const isClosure = latestIncoming.message.includes(closedMsgAr) || latestIncoming.message.includes(closedMsgEn);
            if (isClosure) {
                // إخفِ الودجت عند إغلاق المحادثة من قبل الإدارة
                setShowChat(false);
                setActiveAdminId(null);
            } else {
                setActiveAdminId(latestIncoming.fromUserId);
                setShowChat(true);
            }
            setChatMessages(prev => prev.map(m => (m.fromUserId === latestIncoming.fromUserId && m.toUserId === user.id) ? { ...m, read: true } : m));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [chatMessages, user.id, allUsers]);

    const sendEmployeeMessage = () => {
        const text = employeeChatInput.trim();
        if (!text || !activeAdminId) return;
        const msgsForAdmin = [...chatMessages]
          .filter(m => ((m.fromUserId === activeAdminId && m.toUserId === user.id) || (m.fromUserId === user.id && m.toUserId === activeAdminId)))
          .sort((a,b)=> new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        const last = msgsForAdmin.slice(-1)[0];
        const closedMsgAr = I18N.ar.adminChatClosed;
        const closedMsgEn = I18N.en.adminChatClosed;
        const closed = last && (last.message.includes(closedMsgAr) || last.message.includes(closedMsgEn));
        if (closed) {
            showToast(t('cannotSendChatClosed'), 'warning');
            return;
        }
        setChatMessages(prev => ([
            ...prev,
            {
                id: Date.now(),
                fromUserId: user.id,
                toUserId: activeAdminId,
                message: text,
                timestamp: new Date().toISOString(),
                read: false,
            }
        ]));
        setEmployeeChatInput('');
    };
    
    return (
        <div>
            {showMandatoryExcuseModal && (
                <Modal title="سبب إلزامي للتأخير" onClose={() => setShowMandatoryExcuseModal(false)}>
                    <form onSubmit={(e) => { e.preventDefault(); handleMandatoryExcuseSubmit(new FormData(e.currentTarget).get('reason') as string); }}>
                        <p className="mb-4">لقد تجاوزت الحد المسموح به للتأخير هذا الشهر. يرجى إدخال سبب التأخير للمتابعة.</p>
                        <textarea name="reason" rows={4} className="w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700 dark:border-gray-600" required></textarea>
                        <div className="mt-4 flex justify-end gap-3">
                            <button type="button" onClick={() => setShowMandatoryExcuseModal(false)} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500">إلغاء</button>
                            <button type="submit" className="px-4 py-2 rounded-md bg-gradient-to-r from-emerald-600 to-green-500 text-white hover:from-emerald-700 hover:to-green-600">إرسال وتسجيل الحضور</button>
                        </div>
                    </form>
                </Modal>
            )}
            {/* ودجت الدردشة للموظف */}
            {(() => {
                const adminIds = allUsers.filter(u => u.role === UserRole.ADMIN).map(u => u.id);
                const targetAdminId = activeAdminId || ((): number | null => {
                    const msgs = [...chatMessages]
                      .filter(m => (adminIds.includes(m.fromUserId) && m.toUserId === user.id) || (m.fromUserId === user.id && adminIds.includes(m.toUserId)))
                      .sort((a,b)=> new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
                    const last = msgs.slice(-1)[0];
                    if (!last) return null;
                    return adminIds.includes(last.fromUserId) ? last.fromUserId : last.toUserId;
                })();
                const msgsCurrent = targetAdminId ? [...chatMessages]
                  .filter(m => (m.fromUserId === targetAdminId && m.toUserId === user.id) || (m.fromUserId === user.id && m.toUserId === targetAdminId))
                  .sort((a,b)=> new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()) : [];
                const isClosed = msgsCurrent.length > 0 && (() => { const msg = msgsCurrent[msgsCurrent.length - 1].message; return msg.includes(I18N.ar.adminChatClosed) || msg.includes(I18N.en.adminChatClosed); })();
                const unreadCount = chatMessages.filter(m => adminIds.includes(m.fromUserId) && m.toUserId === user.id && !m.read).length;
                const adminUser = allUsers.find(u => u.id === targetAdminId);
                if (!targetAdminId || isClosed) {
                  return null; // إخفاء ودجت الدردشة إن كانت المحادثة مغلقة
                }
                return (
                  <div className="fixed bottom-4 left-4 z-50">
                    <div className="w-[22rem] max-w-[90vw] rounded-xl shadow-lg ring-1 ring-gray-200/60 dark:ring-gray-700/60 bg-white/90 dark:bg-gray-900/90 backdrop-blur">
                      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200/60 dark:border-gray-700/60">
                          <div className="flex items-center gap-2">
                            <ChatBubbleLeftRightIcon className="w-5 h-5 text-indigo-600" />
                          <div className="text-sm font-semibold">{t('chatWithAdmin')}</div>
                          {unreadCount > 0 && <span className="ml-1 text-xs bg-red-500 text-white px-2 py-0.5 rounded-full">{unreadCount}</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs ${isClosed ? 'text-amber-600' : 'text-emerald-600'}`}>{isClosed ? t('closed') : t('open')}</span>
                          <button onClick={() => setShowChat(v => !v)} className="text-xs px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600">
                            {showChat ? t('hide') : t('show')}
                          </button>
                        </div>
                      </div>
                      {showChat && (
                        <div className="p-3">
                          <div className="flex items-center gap-2 mb-2 text-xs text-gray-600 dark:text-gray-300">
                            <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-800 text-indigo-700 dark:text-indigo-100 flex items-center justify-center font-bold">
                              {(adminUser?.name || t('admin')).charAt(0)}
                            </div>
                            <div>{adminUser?.name || t('admin')}</div>
                          </div>
                          <div className="h-64 overflow-y-auto space-y-2 p-2 bg-gray-50 dark:bg-gray-800 rounded-md">
                            {msgsCurrent.map(m => {
                              const isAdmin = adminIds.includes(m.fromUserId);
                              return (
                                <div key={m.id} className={`flex ${isAdmin ? 'justify-start' : 'justify-end'}`}>
                                  <div className={`max-w-[75%] px-3 py-2 rounded-lg text-sm ${isAdmin ? 'bg-gray-900 text-white dark:bg-gray-900' : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100'}`}>
                                    <div className="text-xs opacity-70 mb-1">{isAdmin ? t('admin') : t('me')}</div>
                                    <div>{m.message}</div>
                                    <div className="text-[10px] opacity-60 mt-1 text-right">{new Date(m.timestamp).toLocaleString(locale)}</div>
                                  </div>
                                </div>
                              );
                            })}
                            {msgsCurrent.length === 0 && (
                              <div className="text-xs text-gray-500 dark:text-gray-300">{t('chatWillAppear')}</div>
                            )}
                          </div>
                          <div className="mt-3 flex items-center gap-2">
                            <input
                              type="text"
                              value={employeeChatInput}
                              onChange={(e)=>setEmployeeChatInput(e.target.value)}
                              placeholder={isClosed ? t('chatClosedPlaceholder') : t('typeMessage')}
                              className="flex-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                              disabled={isClosed || !targetAdminId}
                            />
                            <button onClick={sendEmployeeMessage} disabled={isClosed || !employeeChatInput.trim() || !targetAdminId} className={`text-sm px-3 py-2 rounded-md ${isClosed || !employeeChatInput.trim() || !targetAdminId ? 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}>{t('send')}</button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
            })()}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
        <h2 className="text-2xl font-bold mb-4">{t('attendanceStatusToday')}</h2>
                        <div className="h-1 w-24 mb-6 rounded-full bg-gradient-to-r from-indigo-500 via-blue-500 to-cyan-500"></div>
                        <div className="text-center">
                             <div className="text-5xl font-extrabold mb-4 text-gray-800 dark:text-gray-100 tracking-wider">
                                {currentTime.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
                            </div>
                            <div className="my-6 space-y-4">
                                { !todayRecord ? (
                                    <button onClick={handleCheckInClick} disabled={isCheckingIn} className="w-full px-6 py-4 rounded-lg shadow-sm bg-gradient-to-r from-emerald-600 to-green-500 text-white hover:from-emerald-700 hover:to-green-600 transition-colors disabled:bg-gray-400 disabled:cursor-wait flex items-center justify-center gap-3">
                                        <LocationMarkerIcon className="w-6 h-6" />
                                        {isCheckingIn ? checkInProgressMessage : t('checkIn')}
                                    </button>
                                ) : !todayRecord.checkOut ? (
                                   <button onClick={handleCheckOut} disabled={todayRecord.source === 'جهاز البصمة'} className="w-full px-6 py-4 rounded-lg shadow-sm bg-gradient-to-r from-rose-600 to-red-500 text-white hover:from-rose-700 hover:to-red-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-3">
                                        <ClockIcon className="w-6 h-6" />
                                        {t('checkOut')}
                                   </button>
                                ) : (
                                     <div className="p-4 rounded-lg ring-1 ring-blue-300 text-blue-800 dark:text-blue-200 bg-transparent dark:ring-blue-700/60">
                                         <p className="font-semibold">{t('dayComplete')}</p>
                                     </div>
                                )}
                            </div>
                             { !todayRecord ? (
                                <div className="p-4 rounded-lg bg-transparent ring-1 ring-yellow-300 text-yellow-800 dark:text-yellow-200 dark:ring-yellow-700/60">
                                    <p className="font-semibold">{t('notCheckedInYet')}</p>
                                </div>
                            ) : !todayRecord.checkOut ? (
                               <div className="p-4 rounded-lg bg-transparent ring-1 ring-emerald-300 text-emerald-700 dark:text-emerald-200 dark:ring-emerald-700/60">
                                    <p className="font-semibold">{t('checkedInAt')} {new Date(todayRecord.checkIn).toLocaleTimeString(locale, { hour12: true })} (من {todayRecord.source})</p>
                                    {todayRecord.isLate && <p className="text-sm text-red-500">{t('lateByMinutes').replace('{n}', String(todayRecord.lateMinutes))}</p>}
                                    {todayRecord.source === 'جهاز البصمة' && <p className="text-xs mt-1 text-gray-500">{t('mustCheckoutViaDevice')}</p>}
                               </div>
                            ) : (
                                 <div className="space-y-2">
                                   <div className="p-4 rounded-lg bg-transparent ring-1 ring-emerald-300 text-emerald-700 dark:text-emerald-200 dark:ring-emerald-700/60">
                                     <p className="font-semibold">{t('checkedInAt')} {new Date(todayRecord.checkIn).toLocaleTimeString(locale, { hour12: true })} (من {todayRecord.source})</p>
                                   </div>
                                   <div className="p-4 rounded-lg bg-transparent ring-1 ring-red-300 text-red-700 dark:text-red-200 dark:ring-red-700/60">
                                     <p className="font-semibold">{t('checkedOutAt')} {new Date(todayRecord.checkOut!).toLocaleTimeString(locale, { hour12: true })}</p>
                                   </div>
                                 </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
                        <h2 className="text-2xl font-bold mb-4">{t('submitRequests')}</h2>
                        <div className="h-1 w-24 mb-6 rounded-full bg-gradient-to-r from-indigo-500 via-blue-500 to-cyan-500"></div>
                        <div className="border-b border-gray-200 dark:border-gray-700 mb-4">
                            <nav className="-mb-px flex space-x-4" aria-label="Tabs">
                                <button onClick={() => setRequestType(RequestType.LEAVE)} className={`${requestType === RequestType.LEAVE ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}>
                                    {t('leaveRequest')}
                                </button>
                                <button onClick={() => setRequestType(RequestType.EXCUSE)} className={`${requestType === RequestType.EXCUSE ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}>
                                    {t('excuseRequest')}
                                </button>
                            </nav>
                        </div>
                        <form onSubmit={handleRequestSubmit} className="space-y-4">
                            {requestType === RequestType.LEAVE ? (
                              <>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="space-y-1">
                                    <label className="text-sm">{t('startDate')}</label>
                                    <input type="date" name="date" required className="p-2 border rounded-md bg-gray-50 dark:bg-gray-700 dark:border-gray-600 w-full" />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-sm">{t('daysCount')}</label>
                                    <input type="number" name="duration" min="1" placeholder={t('daysPlaceholder')} required className="p-2 border rounded-md bg-gray-50 dark:bg-gray-700 dark:border-gray-600 w-full" />
                                  </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="space-y-1">
                                    <label className="text-sm">{t('leaveTypeLabel')}</label>
                                    <select name="leaveType" className="p-2 border rounded-md bg-gray-50 dark:bg-gray-700 dark:border-gray-600 w-full">
                                      <option value="سنوية">{t('leaveAnnual')}</option>
                                      <option value="مرضية">{t('leaveSick')}</option>
                                      <option value="طارئة">{t('leaveEmergency')}</option>
                                      <option value="بدون راتب">{t('leaveUnpaid')}</option>
                                    </select>
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-sm">{t('reasonOptional')}</label>
                                    <input type="text" name="reason" placeholder={t('leaveReasonPlaceholder')} className="p-2 border rounded-md bg-gray-50 dark:bg-gray-700 dark:border-gray-600 w-full" />
                                  </div>
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="space-y-1">
                                    <label className="text-sm">{t('affectedDate')}</label>
                                    <input type="date" name="date" max={new Date().toISOString().split('T')[0]} required className="p-2 border rounded-md bg-gray-50 dark:bg-gray-700 dark:border-gray-600 w-full" />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-sm">{t('excuseTypeLabel')}</label>
                                    <select name="excuseType" required className="p-2 border rounded-md bg-gray-50 dark:bg-gray-700 dark:border-gray-600 w-full">
                                      <option value="تأخير">{t('excuseLate')}</option>
                                      <option value="غياب">{t('excuseAbsent')}</option>
                                    </select>
                                  </div>
                                </div>
                                <div className="space-y-1">
                                  <label className="text-sm">{t('reason')}</label>
                                  <textarea name="reason" placeholder={t('excuseReasonPlaceholder')} required rows={4} className="p-2 border rounded-md bg-gray-50 dark:bg-gray-700 dark:border-gray-600 w-full"></textarea>
                                </div>
                              </>
                            )}
                            <button type="submit" className="w-full px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-blue-500 text-white hover:from-indigo-700 hover:to-blue-600 transition-colors">{t('sendRequest')}</button>
                        </form>
                    </div>
                </div>

                <div className="space-y-8">
                     <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
                        <h3 className="text-xl font-bold mb-4">{t('attendanceLog')}</h3>
                        <div className="h-1 w-20 mb-6 rounded-full bg-gradient-to-r from-indigo-500 via-blue-500 to-cyan-500"></div>
                        <ul className="space-y-3 max-h-60 overflow-y-auto">
                            {attendance.filter(a => a.userId === user.id).slice().reverse().map(rec => (
                                <li key={rec.id} className="text-sm p-2 rounded-md bg-white/60 dark:bg-gray-800/60 ring-1 ring-gray-200/60 dark:ring-gray-700/60 transition-colors hover:bg-gradient-to-r hover:from-indigo-50 hover:via-blue-50 hover:to-cyan-50 dark:hover:from-indigo-900/30 dark:hover:via-blue-900/30 dark:hover:to-cyan-900/30">
                                    <p><strong>{t('date')}:</strong> {new Date(rec.checkIn).toLocaleDateString(locale)}</p>
                                    <p><strong>{t('checkInLabel')}:</strong> {new Date(rec.checkIn).toLocaleTimeString(locale)} <span className="text-xs text-gray-500">({rec.source})</span></p>
                                    {rec.checkOut && <p><strong>{t('checkOutLabel')}:</strong> {new Date(rec.checkOut).toLocaleTimeString(locale)}</p>}
                                    {rec.isLate && <p className="text-red-500"><strong>{t('tardiness')}:</strong> {t('lateByMinutes').replace('{n}', String(rec.lateMinutes))}</p>}
                                </li>
                            ))}
                        </ul>
                    </div>
                     <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
                        <h3 className="text-xl font-bold mb-4">{t('myRequests')}</h3>
                        <div className="h-1 w-20 mb-6 rounded-full bg-gradient-to-r from-indigo-500 via-blue-500 to-cyan-500"></div>
                        <ul className="space-y-3 max-h-60 overflow-y-auto">
                            {requests.filter(r => r.userId === user.id).slice().reverse().map(req => (
                                 <li key={req.id} className="text-sm p-2 rounded-md bg-white/60 dark:bg-gray-800/60 ring-1 ring-gray-200/60 dark:ring-gray-700/60 transition-colors hover:bg-gradient-to-r hover:from-indigo-50 hover:via-blue-50 hover:to-cyan-50 dark:hover:from-indigo-900/30 dark:hover:via-blue-900/30 dark:hover:to-cyan-900/30">
                                     <p><strong>{t('type')}:</strong> {(req.type === RequestType.LEAVE ? t('leave') : t('excuse'))} - {new Date(req.date).toLocaleDateString(locale)}</p>
                                     <p className="flex items-center gap-2">
                                       <strong>{t('status')}:</strong>
                                       {req.status === RequestStatus.PENDING && (
                                         <span title={t('pendingReview')} className="inline-flex items-center justify-center">
                                           <ClockIcon className="w-5 h-5 text-amber-500" />
                                         </span>
                                       )}
                                       {req.status === RequestStatus.APPROVED && (
                                         <span title={t('approved')} className="inline-flex items-center justify-center">
                                           <CheckCircleIcon className="w-5 h-5 text-green-500" />
                                         </span>
                                       )}
                                       {req.status === RequestStatus.REJECTED && (
                                         <span title={t('rejected')} className="inline-flex items-center justify-center">
                                           <XCircleIcon className="w-5 h-5 text-rose-500" />
                                         </span>
                                       )}
                                     </p>
                                 </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

interface AdminDashboardProps {
    users: User[];
    setUsers: React.Dispatch<React.SetStateAction<User[]>>;
    attendance: AttendanceRecord[];
    requests: Request[];
    setRequests: React.Dispatch<React.SetStateAction<Request[]>>;
    locations: ApprovedLocation[];
    setLocations: React.Dispatch<React.SetStateAction<ApprovedLocation[]>>;
    notifications: Notification[];
    setNotifications: React.Dispatch<React.SetStateAction<Notification[]>>;
    chatMessages: ChatMessage[];
    setChatMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
    showToast: (message: string, type: 'success' | 'error' | 'warning') => void;
    currentUser: User;
    setCurrentUser: React.Dispatch<React.SetStateAction<User | null>>;
    settings: SystemSettings;
    saveSettings: (next: Partial<SystemSettings>) => void;
    lang: Lang;
}

const HeatmapCalendar: React.FC<{ absenceData: Map<string, number>; lang: Lang }> = ({ absenceData, lang }) => {
    const t = useI18n(lang);
    const locale = lang === 'ar' ? 'ar-EG' : 'en-US';
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const monthName = today.toLocaleDateString(locale, { month: 'long' });
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    // FIX: Explicitly type the accumulator `max` as a number to prevent TypeScript from inferring it as `unknown`.
    const maxAbsences = Array.from(absenceData.values()).reduce((max: number, count) => Math.max(max, count), 1);

    const getDayColor = (day: number) => {
        const count = absenceData.get(new Date(year, month, day).toDateString()) || 0;
        if (count === 0) return 'bg-gray-100 dark:bg-gray-700';
        const opacity = Math.min(1, (count / maxAbsences) * 0.8 + 0.2);
        return `bg-red-500 text-white`;
    };

    const weekdayNames = Array.from({ length: 7 }, (_, i) => new Date(2021, 7, 1 + i).toLocaleDateString(locale, { weekday: 'long' }));
    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
            <h3 className="text-xl font-bold mb-4">{t('absenceHeatmapTitle').replace('{month}', monthName).replace('{year}', String(year))}</h3>
            <div className="grid grid-cols-7 gap-1 text-center text-sm">
                {weekdayNames.map(day => (
                    <div key={day} className="font-semibold p-2 text-gray-600 dark:text-gray-300">{day}</div>
                ))}
                {Array.from({ length: firstDayOfMonth }).map((_, i) => <div key={`empty-${i}`}></div>)}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const count = absenceData.get(new Date(year, month, day).toDateString()) || 0;
                    return (
                        <div key={day} className={`relative p-2 rounded-md ${getDayColor(day)} h-16 flex items-center justify-center transition-all duration-300`}>
                            <span className="font-bold">{day}</span>
                            {count > 0 && <div className="absolute bottom-1 right-1 text-xs px-1.5 py-0.5 bg-black bg-opacity-20 rounded-full">{count}</div>}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const AdminDashboard: React.FC<AdminDashboardProps> = (props) => {
    const { users, setUsers, attendance, requests, setRequests, locations, setLocations, notifications, setNotifications, chatMessages, setChatMessages, showToast, currentUser, setCurrentUser, settings, saveSettings, lang } = props;
    const t = useI18n(lang);
    const locale = lang === 'ar' ? 'ar-EG' : 'en-US';
    const [activeTab, setActiveTab] = useState('summary');
    const [selectedReportEmployees, setSelectedReportEmployees] = useState<string[]>([]);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [reportStartDate, setReportStartDate] = useState('');
    const [reportEndDate, setReportEndDate] = useState('');
    const [generatedReport, setGeneratedReport] = useState<any>(null);

    // Settings drafts
    const [attDraft, setAttDraft] = useState<{ attendanceStartTime: string; latestAllowedTime: string; allowedLatenessPerMonthBeforeReason: number; }>({
      attendanceStartTime: settings.attendanceStartTime,
      latestAllowedTime: settings.latestAllowedTime,
      allowedLatenessPerMonthBeforeReason: settings.allowedLatenessPerMonthBeforeReason,
    });
    const [notifDraft, setNotifDraft] = useState<{ morningReminderEnabled: boolean; morningReminderTime: string; instantLateNotificationEnabled: boolean; instantLateMessageTemplate: string; autoRequestReasonEnabled: boolean; autoRequestMessageTemplate: string; }>({
      morningReminderEnabled: settings.morningReminderEnabled,
      morningReminderTime: settings.morningReminderTime,
      instantLateNotificationEnabled: settings.instantLateNotificationEnabled,
      instantLateMessageTemplate: settings.instantLateMessageTemplate,
      autoRequestReasonEnabled: settings.autoRequestReasonEnabled,
      autoRequestMessageTemplate: settings.autoRequestMessageTemplate,
    });
    const [reportDraft, setReportDraft] = useState<{ autoReportDay: number; reportIncludeLateList: boolean; reportIncludeTotalLateHours: boolean; reportIncludeUnexcusedAbsences: boolean; reportIncludeLeaveAndExcuseSummary: boolean; reportIncludeDepartmentComparison: boolean; exportPdf: boolean; exportExcel: boolean; }>({
      autoReportDay: settings.autoReportDay,
      reportIncludeLateList: settings.reportIncludeLateList,
      reportIncludeTotalLateHours: settings.reportIncludeTotalLateHours,
      reportIncludeUnexcusedAbsences: settings.reportIncludeUnexcusedAbsences,
      reportIncludeLeaveAndExcuseSummary: settings.reportIncludeLeaveAndExcuseSummary,
      reportIncludeDepartmentComparison: settings.reportIncludeDepartmentComparison,
      exportPdf: settings.exportPdf,
      exportExcel: settings.exportExcel,
    });
    const [fpDraft, setFpDraft] = useState<{ fingerprintApiUrl: string; username: string; password: string; }>({
      fingerprintApiUrl: settings.fingerprintApiUrl,
      username: settings.fingerprintUsername,
      password: settings.fingerprintPassword,
    });
    const [showAddLoc, setShowAddLoc] = useState(false);
    const [newLoc, setNewLoc] = useState<ApprovedLocation>({ id: 0, name: '', latitude: 24.7136, longitude: 46.6753, radius: 500 });
    const [editingLocId, setEditingLocId] = useState<number | null>(null);

    // Collapsible states for Settings sections
    const [collapseAttendance, setCollapseAttendance] = useState(false);
    const [collapseLocations, setCollapseLocations] = useState(false);
    const [collapseNotifications, setCollapseNotifications] = useState(false);
    const [collapseReports, setCollapseReports] = useState(false);
    const [collapseFingerprint, setCollapseFingerprint] = useState(false);
    const [collapseUsers, setCollapseUsers] = useState(false);

    // New user forms
    const [newAdminName, setNewAdminName] = useState('');
    const [newAdminUsername, setNewAdminUsername] = useState('');
    const [newAdminPassword, setNewAdminPassword] = useState('');
    const [newAdminDepartment, setNewAdminDepartment] = useState('');
    const [newEmpName, setNewEmpName] = useState('');
    const [newEmpUsername, setNewEmpUsername] = useState('');
    const [newEmpPassword, setNewEmpPassword] = useState('');
    const [newEmpDepartment, setNewEmpDepartment] = useState('');

    const createUser = async (role: 'admin'|'employee', payload: { name: string; username: string; password: string; department?: string; }) => {
      try {
        const res = await api.post('/users', { ...payload, role });
        const mapped = { id: res.id, name: res.name, role: (res.role === 'admin' ? UserRole.ADMIN : UserRole.EMPLOYEE), department: res.department || '' } as User;
        setUsers(prev => [...prev, mapped]);
        showToast(t('accountCreatedToast'), 'success');
      } catch {
        showToast(t('accountSaveFailedToast'), 'error');
      }
    };

    // Chat sessions state
    const [chatSessions, setChatSessions] = useState<{ id: number; employeeId: number; isOpen: boolean; createdAt: string; closedAt?: string; }[]>([]);
    const [activeChatEmployeeId, setActiveChatEmployeeId] = useState<number | null>(null);
    const [chatInput, setChatInput] = useState<string>('');
    const [isEmployeePickerOpen, setIsEmployeePickerOpen] = useState<boolean>(false);
    const [employeePickerQuery, setEmployeePickerQuery] = useState<string>('');
    const [chatHistoryFilter, setChatHistoryFilter] = useState<'ALL'|'OPEN'|'CLOSED'>('ALL');
    const [chatHistoryQuery, setChatHistoryQuery] = useState<string>('');

    const markSessionMessagesRead = (employeeId: number) => {
      setChatMessages(prev => prev.map(m =>
        (m.toUserId === currentUser.id && m.fromUserId === employeeId) ? { ...m, read: true } : m
      ));
    };
    const activeChatSession = activeChatEmployeeId != null
      ? chatSessions.find(s => s.employeeId === activeChatEmployeeId && s.isOpen) || null
      : null;
    const openChatWith = (employeeId: number) => {
      setActiveChatEmployeeId(employeeId);
      const existsOpen = chatSessions.some(s => s.employeeId === employeeId && s.isOpen);
      if (!existsOpen) {
        const newSession = {
          id: Date.now(),
          employeeId,
          isOpen: true,
          createdAt: new Date().toISOString(),
        };
        setChatSessions(prev => [...prev, newSession]);
        // أرسل رسالة بدء للمحادثة وإشعار للموظف لفتح الصندوق عنده
        setChatMessages(prev => ([
          ...prev,
          {
            id: Date.now() + 1,
            fromUserId: currentUser.id,
            toUserId: employeeId,
            message: t('adminChatStarted'),
            timestamp: new Date().toISOString(),
            read: false,
          }
        ]));
        setNotifications(prev => ([
          ...prev,
          {
            id: Date.now() + 2,
            title: t('newChat'),
            message: t('adminStartedChatTapToOpen'),
            timestamp: new Date().toISOString(),
            read: false,
            targetUserIds: [employeeId]
          }
        ]));
      }
    };
    const closeActiveChat = () => {
      if (activeChatEmployeeId == null) return;
      setChatSessions(prev => prev.map(s => s.employeeId === activeChatEmployeeId && s.isOpen
        ? { ...s, isOpen: false, closedAt: new Date().toISOString() }
        : s
      ));
      // Add closure message by admin
      setChatMessages(prev => ([
        ...prev,
        {
          id: Date.now(),
          fromUserId: currentUser.id,
          toUserId: activeChatEmployeeId!,
          message: t('adminChatClosed'),
          timestamp: new Date().toISOString(),
          read: false,
}

      ]));
    };
    const sendChatMessage = () => {
      if (!activeChatEmployeeId) return;
      const text = chatInput.trim();
      if (!text) return;
      if (!activeChatSession) {
        // Session closed; block sending
        showToast(t('cannotSendChatClosed'), 'warning');
        return;
      }
      setChatMessages(prev => ([
        ...prev,
        {
          id: Date.now(),
          fromUserId: currentUser.id,
          toUserId: activeChatEmployeeId,
          message: text,
          timestamp: new Date().toISOString(),
          read: false,
        }
      ]));
      setChatInput('');
    };

    const employeeUsers = users.filter(u => u.role === UserRole.EMPLOYEE);
    
    // Summary calculations
    const todayString = new Date().toDateString();
    const totalAttendanceToday = attendance.filter(a => new Date(a.checkIn).toDateString() === todayString).length;
    const absentToday = employeeUsers.length - totalAttendanceToday;
    const totalLateToday = attendance.filter(a => a.isLate && new Date(a.checkIn).toDateString() === todayString).length;

    // Analytics datasets (last 14 days)
    const last14Days = Array.from({ length: 14 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (13 - i));
        d.setHours(0, 0, 0, 0);
        return d;
    });
    const analyticsDaily = last14Days.map(d => {
        const dayStr = d.toDateString();
        const recs = attendance.filter(a => new Date(a.checkIn).toDateString() === dayStr);
        const attendanceCount = recs.length;
        const lateMinutesSum = recs.reduce((sum, a) => sum + (a.isLate ? a.lateMinutes : 0), 0);
        const lateCount = recs.filter(a => a.isLate).length;
        const absentCount = Math.max(employeeUsers.length - attendanceCount, 0);
        return {
            name: d.toLocaleDateString(locale, { month: '2-digit', day: '2-digit' }),
            [t('present')]: attendanceCount,
            [t('absent')]: absentCount,
            minutes: lateMinutesSum,
            [t('dailyLatenessCount')]: lateCount,
        };
    });
    const chartAttendanceAbsence = analyticsDaily.map(d => ({ name: d.name, [t('present')]: (d as any)[t('present')], [t('absent')]: (d as any)[t('absent')] }));
    const chartLatenessMinutes = analyticsDaily.map(d => ({ name: d.name, minutes: d.minutes }));
    const chartLatenessCount = analyticsDaily.map(d => ({ name: d.name, [t('dailyLatenessCount')]: (d as any)[t('dailyLatenessCount')] }));
    const pieAttendanceAbsence = [
        { name: t('present'), value: chartAttendanceAbsence.reduce((sum, d) => sum + ((d as any)[t('present')] || 0), 0) },
        { name: t('absent'), value: chartAttendanceAbsence.reduce((sum, d) => sum + ((d as any)[t('absent')] || 0), 0) },
    ];

    // Requests management state and helpers
    const [requestFilter, setRequestFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
    const [requestSearch, setRequestSearch] = useState('');
    const [selectedRequestIds, setSelectedRequestIds] = useState<number[]>([]);
    const pendingCount = requests.filter(r => r.status === RequestStatus.PENDING).length;
    const approvedCount = requests.filter(r => r.status === RequestStatus.APPROVED).length;
    const rejectedCount = requests.filter(r => r.status === RequestStatus.REJECTED).length;
    const filteredRequests = requests.filter(r => {
        const statusMap: Record<'PENDING'|'APPROVED'|'REJECTED', RequestStatus> = {
          PENDING: RequestStatus.PENDING,
          APPROVED: RequestStatus.APPROVED,
          REJECTED: RequestStatus.REJECTED,
        };
        const statusPass = requestFilter === 'ALL' || r.status === statusMap[requestFilter];
        const userName = users.find(u => u.id === r.userId)?.name || '';
        const hay = `${userName} ${r.reason || ''} ${r.type || ''}`.toLowerCase();
        const needle = requestSearch.toLowerCase();
        const searchPass = !needle || hay.includes(needle);
        return statusPass && searchPass;
    });
    const toggleSelectAll = (checked: boolean) => {
        setSelectedRequestIds(checked ? filteredRequests.map(r => r.id) : []);
    };
    const toggleSelectOne = (id: number, checked: boolean) => {
        setSelectedRequestIds(prev => checked ? [...new Set([...prev, id])] : prev.filter(x => x !== id));
    };
    const approveSelected = () => {
        selectedRequestIds.forEach(id => handleRequestStatus(id, RequestStatus.APPROVED));
        setSelectedRequestIds([]);
    };
    const rejectSelected = () => {
        selectedRequestIds.forEach(id => handleRequestStatus(id, RequestStatus.REJECTED));
        setSelectedRequestIds([]);
    };

    // Reports filters
    const [reportScope, setReportScope] = useState<'ALL' | 'ONE' | 'MULTI'>('ALL');
    const [reportEmployeeId, setReportEmployeeId] = useState<number | null>(null);
    const [reportEmployeeIds, setReportEmployeeIds] = useState<number[]>([]);
    const [reportEmployeeQuery, setReportEmployeeQuery] = useState<string>('');
    const [reportType, setReportType] = useState<'LATE_HOURS'|'LATE_MINUTES'|'ATTENDANCE_TIMES'|'ABSENCES'|'EXCUSES'|null>(null);
    const selectedIds: number[] = reportScope === 'ALL' ? employeeUsers.map(u => u.id) : reportScope === 'ONE' ? (reportEmployeeId ? [reportEmployeeId] : []) : reportEmployeeIds;
    const exportReportCSV = () => {
      const rows: string[][] = [];
      const fmtDate = (d: Date | string) => new Date(d).toLocaleDateString(locale);
      const fmtTime = (d?: string) => d ? new Date(d).toLocaleTimeString(locale) : '-';
      const safe = (s?: string) => (s || '').replace(/\r|\n|\t/g, ' ').trim();
      const usersById = new Map(employeeUsers.map(u => [u.id, u.name] as const));

      const addHeader = (cols: string[]) => rows.push(cols);
      const add = (...cols: (string | number)[]) => rows.push(cols.map(c => String(c)));

      const inRange = (dateStr: string) => {
        return inDateRange(dateStr);
      };

      if (reportType === 'LATE_HOURS') {
        addHeader([t('date'), t('employeeLabel2'), t('lateHours')]);
        employeeUsers.filter(u=>selectedIds.includes(u.id)).forEach(u => {
          dayList.forEach(d => {
            const key = `${u.id}-${d.toDateString()}`;
            const recs = byUserDay.get(key) || [];
            const mins = recs.reduce((sum,r)=>sum+(r.isLate?r.lateMinutes:0),0);
            const hours = (mins/60).toFixed(2);
            add(fmtDate(d), u.name, hours);
          });
        });
      } else if (reportType === 'LATE_MINUTES') {
        addHeader([t('date'), t('employeeLabel2'), t('lateMinutes')]);
        employeeUsers.filter(u=>selectedIds.includes(u.id)).forEach(u => {
          dayList.forEach(d => {
            const key = `${u.id}-${d.toDateString()}`;
            const recs = byUserDay.get(key) || [];
            const mins = recs.reduce((sum,r)=>sum+(r.isLate?r.lateMinutes:0),0);
            add(fmtDate(d), u.name, mins);
          });
        });
      } else if (reportType === 'ATTENDANCE_TIMES') {
        addHeader([t('date'), t('employeeLabel2'), t('checkInTime'), t('checkOutTime'), t('totalHours'), t('dayStatus')]);
        employeeUsers.filter(u=>selectedIds.includes(u.id)).forEach(u => {
          dayList.forEach(d => {
            const key = `${u.id}-${d.toDateString()}`;
            const recs = byUserDay.get(key) || [];
            const first = recs.slice().sort((a,b)=>new Date(a.checkIn).getTime()-new Date(b.checkIn).getTime())[0];
            const last = recs.slice().sort((a,b)=>new Date(a.checkOut||a.checkIn).getTime()-new Date(b.checkOut||b.checkIn).getTime()).slice(-1)[0];
            const tot = totalHours(first?.checkIn, last?.checkOut);
            const st = statusForDay(u.id, d);
            add(fmtDate(d), u.name, fmtTime(first?.checkIn), fmtTime(last?.checkOut), tot, st);
          });
        });
      } else if (reportType === 'ABSENCES') {
        addHeader([t('date'), t('employeeLabel2'), t('absenceType')]);
        employeeUsers.filter(u=>selectedIds.includes(u.id)).forEach(u => {
          dayList.forEach(d => {
            const code = dayStatusCode(u.id, d);
            if (code === 'PRESENT' || code === 'LATE') return;
            add(fmtDate(d), u.name, statusForDay(u.id, d));
          });
        });
      } else if (reportType === 'EXCUSES') {
        addHeader([t('date'), t('employeeLabel2'), t('reasonCol'), t('status'), t('adminNote')]);
        requests.filter(r => r.type === RequestType.EXCUSE && selectedIds.includes(r.userId) && inRange(r.date)).forEach(r => {
          const name = usersById.get(r.userId) || '—';
          const note = (r as any).adminNote || '';
          add(fmtDate(r.date), name, safe(r.reason), r.status, safe(note));
        });
      }

      const csv = rows.map(r => r.map(cell => {
        const needsQuotes = /[",\n]/.test(cell);
        const escaped = cell.replace(/"/g,'""');
        return needsQuotes ? `"${escaped}"` : escaped;
      }).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const fileNameMap: Record<typeof reportType,string> = {
        LATE_HOURS: 'late_hours_daily.csv',
        LATE_MINUTES: 'late_minutes_daily.csv',
        ATTENDANCE_TIMES: 'attendance_times_daily.csv',
        ABSENCES: 'absences_daily.csv',
        EXCUSES: 'official_excuses.csv',
      };
      a.href = url;
      a.download = fileNameMap[reportType];
      a.click();
      URL.revokeObjectURL(url);
    };
    const exportReportExcel = () => {
      if (!reportType) return;
      const escapeHtml = (s: any) => String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      const headers: string[] = [];
      const rows: string[][] = [];

      if (reportType === 'LATE_HOURS') {
        headers.push(t('date'), t('employeeLabel2'), t('lateHours'));
        employeeUsers.filter(u=>selectedIds.includes(u.id)).forEach(u => {
          dayList.forEach(d => {
            const key = `${u.id}-${d.toDateString()}`;
            const recs = byUserDay.get(key) || [];
            const mins = recs.reduce((sum,r)=>sum+(r.isLate?r.lateMinutes:0),0);
            rows.push([d.toLocaleDateString(locale), u.name, formatHm(mins)]);
          });
        });
      } else if (reportType === 'LATE_MINUTES') {
        headers.push(t('date'), t('employeeLabel2'), t('lateMinutes'));
        employeeUsers.filter(u=>selectedIds.includes(u.id)).forEach(u => {
          dayList.forEach(d => {
            const key = `${u.id}-${d.toDateString()}`;
            const recs = byUserDay.get(key) || [];
            const mins = recs.reduce((sum,r)=>sum+(r.isLate?r.lateMinutes:0),0);
            rows.push([d.toLocaleDateString(locale), u.name, `${mins} ${t('minutesLabel')}`]);
          });
        });
      } else if (reportType === 'ATTENDANCE_TIMES') {
        headers.push(t('date'), t('employeeLabel2'), t('checkInTime'), t('checkOutTime'), t('totalHours'), t('dayStatus'));
        employeeUsers.filter(u=>selectedIds.includes(u.id)).forEach(u => {
          dayList.forEach(d => {
            const key = `${u.id}-${d.toDateString()}`;
            const recs = byUserDay.get(key) || [];
            const first = recs.slice().sort((a,b)=>new Date(a.checkIn).getTime()-new Date(b.checkIn).getTime())[0];
            const last = recs.slice().sort((a,b)=>new Date(a.checkOut||a.checkIn).getTime()-new Date(b.checkOut||b.checkIn).getTime()).slice(-1)[0];
            const ci = first?.checkIn ? new Date(first.checkIn).toLocaleTimeString(locale) : '-';
            const co = last?.checkOut ? new Date(last.checkOut).toLocaleTimeString(locale) : '-';
            const tot = totalHours(first?.checkIn, last?.checkOut);
            const st = statusForDay(u.id, d);
            rows.push([d.toLocaleDateString(locale), u.name, ci, co, tot, st]);
          });
        });
      } else if (reportType === 'ABSENCES') {
        headers.push(t('date'), t('employeeLabel2'), t('absenceType'));
        employeeUsers.filter(u=>selectedIds.includes(u.id)).forEach(u => {
          dayList.forEach(d => {
            const code = dayStatusCode(u.id, d);
            if (code === 'PRESENT' || code === 'LATE') return;
            rows.push([d.toLocaleDateString(locale), u.name, statusForDay(u.id, d)]);
          });
        });
      } else if (reportType === 'EXCUSES') {
        headers.push(t('date'), t('employeeLabel2'), t('reasonCol'), t('status'), t('adminNote'));
        requests.filter(r => r.type === RequestType.EXCUSE && selectedIds.includes(r.userId) && inDateRange(r.date)).forEach(r => {
          const u = users.find(u => u.id === r.userId);
          const note = (r as any).adminNote || '-';
          rows.push([new Date(r.date).toLocaleDateString(locale), u?.name || '—', r.reason, r.status, note]);
        });
      }

      const thead = `<thead><tr>${headers.map(h=>`<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>`;
      const tbody = `<tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${escapeHtml(c)}</td>`).join('')}</tr>`).join('')}</tbody>`;
      const tableHtml = `<table>${thead}${tbody}</table>`;
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${tableHtml}</body></html>`;
      const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report-${reportType}-${new Date().toISOString().slice(0,10)}.xls`;
      a.click();
      URL.revokeObjectURL(url);
    };
    const exportMonthlyReportExcel = () => {
      if (!generatedReport) return;
      const { data, title } = generatedReport;
      const { lateEmployeesData, summary } = data;
      const escapeHtml = (s: any) => String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      const tables: string[] = [];
      // 1) Summary table
      const summaryHeaders = ['العنصر','القيمة'];
      const summaryRows = [
        ['عنوان التقرير', title],
        ['إجمالي أيام التأخير', String(summary.totalLateness ?? '-')],
        ['نسبة الحضور', String(summary.attendanceRate ?? '-')],
        ['الغياب غير المبرر', String(summary.unjustifiedAbsences ?? '-')],
        ['أعلى قسم تأخيراً', String(summary.highestDept ?? '-')],
      ];
      const summaryThead = `<thead><tr>${summaryHeaders.map(h=>`<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>`;
      const summaryTbody = `<tbody>${summaryRows.map(r=>`<tr>${r.map(c=>`<td>${escapeHtml(c)}</td>`).join('')}</tr>`).join('')}</tbody>`;
      tables.push(`<table>${summaryThead}${summaryTbody}</table>`);

      // 2) Employees monthly summary
      const empHeaders = ['الموظف','أيام التأخير','إجمالي ساعات التأخير','متوسط دقائق التأخير'];
      const empRows = (lateEmployeesData || []).map((d:any) => [
        d.name,
        String(d.lateDays ?? 0),
        String(d.totalLateHours ?? '-'),
        String(d.avgLateMinutes ?? '-')
      ]);
      const empThead = `<thead><tr>${empHeaders.map(h=>`<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>`;
      const empTbody = `<tbody>${empRows.map(r=>`<tr>${r.map(c=>`<td>${escapeHtml(c)}</td>`).join('')}</tr>`).join('')}</tbody>`;
      tables.push(`<table>${empThead}${empTbody}</table>`);

      // 3) Employees daily lateness details
      const detHeaders = ['الموظف','التاريخ','دقائق التأخير'];
      const detRows: string[][] = [];
      (lateEmployeesData || []).forEach((d:any) => {
        (d.details || []).forEach((item:any) => {
          detRows.push([d.name, String(item.date), String(item.minutes)]);
        });
      });
      const detThead = `<thead><tr>${detHeaders.map(h=>`<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>`;
      const detTbody = `<tbody>${detRows.map(r=>`<tr>${r.map(c=>`<td>${escapeHtml(c)}</td>`).join('')}</tr>`).join('')}</tbody>`;
      tables.push(`<table>${detThead}${detTbody}</table>`);

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${tables.join('<br/>')}</body></html>`;
      const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `monthly_report_${new Date().toISOString().slice(0,7)}.xls`;
      a.click();
      URL.revokeObjectURL(url);
    };
    const inDateRange = (isoDate: string) => {
      const d = new Date(isoDate);
      const startOk = !reportStartDate || d >= new Date(reportStartDate);
      const endOk = !reportEndDate || d <= new Date(reportEndDate);
      return startOk && endOk;
    };
    const attFiltered = attendance.filter(a => selectedIds.includes(a.userId) && inDateRange(a.checkIn));
    const byUserDay = (() => {
      const map = new Map<string, AttendanceRecord[]>();
      attFiltered.forEach(a => {
        const key = `${a.userId}-${new Date(a.checkIn).toDateString()}`;
        const arr = map.get(key) || [];
        arr.push(a);
        map.set(key, arr);
      });
      return map;
    })();
    const dayList = (() => {
      const out: Date[] = [];
      const start = reportStartDate ? new Date(reportStartDate) : null;
      const end = reportEndDate ? new Date(reportEndDate) : null;
      const baseDays = last14Days; // fallback window
      if (!start || !end) return baseDays;
      const cur = new Date(start);
      cur.setHours(0,0,0,0);
      const e = new Date(end);
      e.setHours(0,0,0,0);
      while (cur <= e) { out.push(new Date(cur)); cur.setDate(cur.getDate()+1); }
      return out;
    })();
    const formatHm = (mins: number) => `${(mins/60).toFixed(1)} ${t('hoursLabel')}`;
    const totalHours = (checkIn?: string, checkOut?: string) => {
      if (!checkIn || !checkOut) return '-';
      const diffMs = new Date(checkOut).getTime() - new Date(checkIn).getTime();
      if (diffMs <= 0) return '-';
      const hours = diffMs / (1000*60*60);
      return `${hours.toFixed(2)} ${lang==='ar'?'س':'h'}`;
    };
    const dayStatusCode = (userId: number, d: Date): 'PRESENT'|'LATE'|'ON_LEAVE'|'EXCUSE_APPROVED'|'EXCUSE_REJECTED'|'PENDING'|'UNJUSTIFIED' => {
      const dayStr = d.toDateString();
      const hasAtt = attendance.some(a => a.userId === userId && new Date(a.checkIn).toDateString() === dayStr);
      if (hasAtt) {
        const recs = attendance.filter(a => a.userId === userId && new Date(a.checkIn).toDateString() === dayStr);
        const wasLate = recs.some(r => r.isLate);
        return wasLate ? 'LATE' : 'PRESENT';
      }
      const dayRequests = requests.filter(r => r.userId === userId && new Date(r.date).toDateString() === dayStr);
      const leave = dayRequests.find(r => r.type === RequestType.LEAVE);
      if (leave) return 'ON_LEAVE';
      const excuse = dayRequests.find(r => r.type === RequestType.EXCUSE);
      if (excuse) {
        if (excuse.status === RequestStatus.APPROVED) return 'EXCUSE_APPROVED';
        if (excuse.status === RequestStatus.REJECTED) return 'EXCUSE_REJECTED';
        return 'PENDING';
      }
      return 'UNJUSTIFIED';
    };
    const statusForDay = (userId: number, d: Date): string => {
      const code = dayStatusCode(userId, d);
      const map: Record<ReturnType<typeof dayStatusCode>, string> = {
        PRESENT: t('presentStatus'),
        LATE: t('lateStatus'),
        ON_LEAVE: t('onLeaveStatus'),
        EXCUSE_APPROVED: t('excuseAcceptedStatus'),
        EXCUSE_REJECTED: t('excuseRejectedStatus'),
        PENDING: t('underReviewStatus'),
        UNJUSTIFIED: t('unjustifiedStatus'),
      };
      return map[code];
    };

    useEffect(() => {
      const today = new Date();
      if (today.getDate() === 25) {
        // عرض التقرير الشهري تلقائياً في يوم 25
        handleGenerateMonthlyReport();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    
    const handleRequestStatus = (id: number, status: RequestStatus) => {
        setRequests(prev => prev.map(req => req.id === id ? {...req, status} : req));
        showToast(status === RequestStatus.APPROVED ? 'تم قبول الطلب' : 'تم رفض الطلب', 'success');
        // إنشاء تنبيه للمستخدم صاحب الطلب
        const req = requests.find(r => r.id === id);
        if (req) {
          const employeeId = req.userId;
          const employeeName = users.find(u => u.id === employeeId)?.name || 'الموظف';
          const title = status === RequestStatus.APPROVED ? 'تم اعتماد الطلب' : 'تم رفض الطلب';
          const message = status === RequestStatus.APPROVED
            ? `تم اعتماد طلب ${req.type} من ${req.date}`
            : `تم رفض طلب ${req.type}. السبب: (أدخل الإداري سبب الرفض)`;
          const category = status === RequestStatus.APPROVED ? 'success' : 'warning';
    const notif = { id: Date.now() + 5, title, message, timestamp: new Date().toISOString(), read: false, targetUserIds: [employeeId] };
          setNotifications(prev => [notif, ...prev]);
          api.post('/notifications', { title, message, targetUserIds: [employeeId], category }).catch(()=>{});
        }
    };

    const handleGenerateMonthlyReport = () => {
        // الشهر الماضي
        const lastMonth = new Date();
        lastMonth.setMonth(lastMonth.getMonth() - 1);
        const year = lastMonth.getFullYear();
        const month = lastMonth.getMonth();
        const startDate = new Date(year, month, 1);
        const endDate = new Date(year, month + 1, 0);

        // بيانات التأخير لكل موظف من السجلات الفعلية
        const lateEmployeesData = employeeUsers.map(user => {
            const userLateRecords = attendance.filter(a =>
                a.userId === user.id && a.isLate &&
                new Date(a.checkIn) >= startDate && new Date(a.checkIn) <= endDate
            );
            if (userLateRecords.length === 0) return null;
            const totalLateMinutes = userLateRecords.reduce((sum, rec) => sum + rec.lateMinutes, 0);
            return {
                name: user.name,
                lateDays: userLateRecords.length,
                totalLateHours: formatMinutesToHoursAndMinutes(totalLateMinutes),
                avgLateMinutes: (totalLateMinutes / userLateRecords.length).toFixed(1),
                details: userLateRecords.map(r => ({date: new Date(r.checkIn).toLocaleDateString('ar-EG'), minutes: r.lateMinutes})),
            };
        }).filter(Boolean);

        // حسابات الملخص الفعلية
        const daysInMonth = endDate.getDate();
        const allDays: Date[] = Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1));
        const totalEmployees = employeeUsers.length;
        let totalPresent = 0;
        let totalAbsences = 0;

        const deptLateMinutes = new Map<string, number>();
        const userById = new Map(employeeUsers.map(u => [u.id, u] as const));

        allDays.forEach(d => {
            const dayStr = d.toDateString();
            const dayRecs = attendance.filter(a => new Date(a.checkIn).toDateString() === dayStr);
            const presentCount = dayRecs.length;
            totalPresent += presentCount;
            totalAbsences += Math.max(totalEmployees - presentCount, 0);
            // دقائق التأخير لكل قسم
            dayRecs.forEach(r => {
                if (r.isLate) {
                    const u = userById.get(r.userId);
                    const dept = u?.department || 'غير محدد';
                    const cur = deptLateMinutes.get(dept) || 0;
                    deptLateMinutes.set(dept, cur + (r.lateMinutes || 0));
                }
            });
        });

        const attendanceRatePct = totalEmployees > 0 && allDays.length > 0
          ? Math.round((totalPresent / (totalEmployees * allDays.length)) * 100)
          : 0;

        let highestDept = '—';
        let highestVal = -1;
        for (const [dept, mins] of deptLateMinutes.entries()) {
          if (mins > highestVal) { highestVal = mins; highestDept = dept; }
        }

        const summary = {
            totalLateness: lateEmployeesData.reduce((sum, u) => sum + (u?.lateDays || 0), 0),
            highestDept,
            attendanceRate: `${attendanceRatePct}%`,
            unjustifiedAbsences: totalAbsences,
        };

        setGeneratedReport({
            title: `التقرير الشهري (بيانات فعلية) لشهر ${lastMonth.toLocaleDateString('ar-EG', {month: 'long'})}`,
            data: { lateEmployeesData, summary }
        });
        setActiveTab('reports');
    };

    const TabButton: React.FC<{tabName: string; icon: React.ReactNode; children: React.ReactNode; variant?: 'emerald'|'violet'|'amber'|'blue'|'teal'|'rose'|'gray'}> = ({ tabName, icon, children, variant = 'emerald' }) => {
        const variants: Record<string, { active: string; hover: string; }> = {
          emerald: { active: 'bg-gradient-to-r from-emerald-600 to-emerald-500 text-white ring-1 ring-emerald-300/60 dark:ring-emerald-700/60', hover: 'hover:bg-gradient-to-r hover:from-emerald-50 hover:to-teal-50 dark:hover:bg-gray-700/40' },
          violet:  { active: 'bg-gradient-to-r from-violet-600 to-indigo-500 text-white ring-1 ring-violet-300/60 dark:ring-violet-700/60',   hover: 'hover:bg-gradient-to-r hover:from-violet-50 hover:to-indigo-50 dark:hover:bg-gray-700/40' },
          amber:   { active: 'bg-gradient-to-r from-amber-500 to-orange-500 text-white ring-1 ring-amber-300/60 dark:ring-amber-700/60',      hover: 'hover:bg-gradient-to-r hover:from-amber-50 hover:to-orange-50 dark:hover:bg-gray-700/40' },
          blue:    { active: 'bg-gradient-to-r from-blue-600 to-indigo-500 text-white ring-1 ring-blue-300/60 dark:ring-blue-700/60',         hover: 'hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 dark:hover:bg-gray-700/40' },
          teal:    { active: 'bg-gradient-to-r from-teal-600 to-emerald-500 text-white ring-1 ring-teal-300/60 dark:ring-teal-700/60',         hover: 'hover:bg-gradient-to-r hover:from-teal-50 hover:to-emerald-50 dark:hover:bg-gray-700/40' },
          rose:    { active: 'bg-gradient-to-r from-rose-600 to-pink-500 text-white ring-1 ring-rose-300/60 dark:ring-rose-700/60',           hover: 'hover:bg-gradient-to-r hover:from-rose-50 hover:to-pink-50 dark:hover:bg-gray-700/40' },
          gray:    { active: 'bg-gradient-to-r from-gray-700 to-gray-600 text-white ring-1 ring-gray-300/60 dark:ring-gray-700/60',           hover: 'hover:bg-gray-100 dark:hover:bg-gray-700/40' },
        };
        const stateClasses = activeTab === tabName ? variants[variant].active + ' shadow-sm' : 'text-gray-700 dark:text-gray-300 ring-1 ring-transparent ' + variants[variant].hover;
        return (
          <button
            onClick={() => setActiveTab(tabName)}
            className={`group w-full flex items-center ${isSidebarCollapsed ? 'justify-center' : ''} gap-3 ${isSidebarCollapsed ? 'px-2' : 'px-4'} py-2 font-medium text-sm rounded-xl backdrop-blur transition ${stateClasses}`}
            aria-current={activeTab === tabName ? 'page' : undefined}
          >
              {icon}
              {!isSidebarCollapsed && children}
          </button>
        );
    };

    const StatCard: React.FC<{ title: string; value: string | number; icon: React.ReactNode; onClick?: () => void; variant?: 'emerald' | 'amber' | 'rose' }> = ({ title, value, icon, onClick, variant = 'emerald' }) => {
        const borderGrad = variant === 'emerald'
          ? 'from-emerald-400 via-teal-400 to-cyan-400'
          : variant === 'amber'
          ? 'from-amber-400 via-orange-400 to-yellow-400'
          : 'from-rose-400 via-pink-400 to-fuchsia-400';
        const hoverBg = variant === 'emerald'
          ? 'hover:bg-emerald-50/60 dark:hover:bg-emerald-900/20'
          : variant === 'amber'
          ? 'hover:bg-amber-50/60 dark:hover:bg-amber-900/20'
          : 'hover:bg-rose-50/60 dark:hover:bg-rose-900/20';
        return (
          <button
            type="button"
            onClick={onClick}
            className={`w-full text-left relative bg-white/70 dark:bg-gray-800/70 backdrop-blur p-6 rounded-xl shadow-md flex items-start justify-between ring-1 ring-gray-200/60 dark:ring-gray-700/60 transition ${hoverBg}`}
          >
            <span className={`absolute inset-0 -z-0 rounded-xl pointer-events-none`}
              aria-hidden="true"
            >
              <span className={`absolute inset-0 rounded-xl p-[1px] bg-gradient-to-r ${borderGrad}`}></span>
            </span>
            <div className="relative z-10">
                <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
                <p className="text-3xl font-bold text-gray-800 dark:text-white">{value}</p>
            </div>
            <div className="relative z-10 p-3.5 rounded-full bg-gradient-to-br from-white/50 to-transparent dark:from-gray-900/30 ring-1 ring-gray-200/50 dark:ring-gray-700/50">{icon}</div>
          </button>
        );
    };
    
    return (
        <div className="grid grid-cols-12 gap-6">
            <aside className={`col-span-12 ${isSidebarCollapsed ? 'lg:col-span-1' : 'lg:col-span-3'}`}>
                <div className={`bg-white/60 dark:bg-gray-800/60 backdrop-blur rounded-2xl shadow-md ${isSidebarCollapsed ? 'p-2' : 'p-3'} ring-1 ring-emerald-100/60 dark:ring-emerald-800/40 sticky top-20`}
                >
                    <div className={`flex items-center justify-between mb-2 ${isSidebarCollapsed ? 'px-1' : 'px-2'}`}>
                        {!isSidebarCollapsed && <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">القائمة</span>}
                        <button
                          onClick={() => setIsSidebarCollapsed(v => !v)}
                          className="p-1.5 rounded-md bg-white/60 dark:bg-gray-800/60 text-emerald-700 dark:text-emerald-300 hover:bg-white/80 dark:hover:bg-gray-700/80 transition ring-1 ring-emerald-200/50"
                          aria-label="Toggle sidebar"
                        >
                            {isSidebarCollapsed ? (
                              <ChevronRightIcon className="w-4 h-4" />
                            ) : (
                              <ChevronLeftIcon className="w-4 h-4" />
                            )}
                        </button>
                    </div>
                    <div className="space-y-2">
                        <TabButton tabName="summary"    variant="emerald" icon={<HomeIcon className="w-6 h-6" />}>{t('execSummary')}</TabButton>
                        <TabButton tabName="analytics"  variant="violet"  icon={<ChartBarIcon className="w-6 h-6" />}>{t('analyticsTab')}</TabButton>
                        <TabButton tabName="requests"   variant="amber"   icon={<ClipboardListIcon className="w-6 h-6" />}>{t('requestsManagement')}</TabButton>
                        <TabButton tabName="reports"    variant="blue"    icon={<DocumentTextIcon className="w-6 h-6" />}>{t('reportsTab')}</TabButton>
                        <TabButton tabName="chat"       variant="teal"    icon={<ChatBubbleLeftRightIcon className="w-6 h-6" />}>{t('chatsTab')}</TabButton>
                        <TabButton tabName="notifications" variant="rose"  icon={<BellIcon className="w-6 h-6" />}>{t('sendNotificationTab')}</TabButton>
                        <TabButton tabName="settings"   variant="gray"    icon={<AdjustmentsIcon className="w-6 h-6" />}>{t('settingsTab')}</TabButton>
                    </div>
                </div>
            </aside>

            <main className={`col-span-12 ${isSidebarCollapsed ? 'lg:col-span-11' : 'lg:col-span-9'}`}>
                <div className="transition-opacity duration-300 bg-gradient-to-br from-emerald-50/40 via-indigo-50/30 to-blue-50/40 dark:from-gray-900/20 dark:via-gray-900/10 dark:to-gray-900/20 p-1 rounded-2xl">
                {activeTab === 'summary' && (
                    <div className="space-y-6 animate-fade-in">
                        {/* تفاصيل اليوم - النافذة والنطاق */}
                        {(() => {
                          const presentIds = new Set(detailRecords.map(r => r.userId));
                          const lateIds = new Set(detailRecords.filter(r => r.isLate).map(r => r.userId));
                          const absentList = employeeUsers.filter(u => !presentIds.has(u.id));

                          // واجهة البطاقات القابلة للنقر
                          const Cards = (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                              <StatCard
                                title="إجمالي الحضور اليوم"
                                value={totalAttendanceToday}
                                icon={<CheckBadgeIcon className="w-7 h-7 text-emerald-600 dark:text-emerald-400"/>}
                                variant="emerald"
                                onClick={() => loadDetailsForDay('PRESENT')}
                              />
                              <StatCard
                                title="متأخرون اليوم"
                                value={totalLateToday}
                                icon={<ClockIcon className="w-7 h-7 text-amber-600 dark:text-amber-400"/>}
                                variant="amber"
                                onClick={() => loadDetailsForDay('LATE')}
                              />
                              <StatCard
                                title="غياب اليوم"
                                value={absentToday < 0 ? 0 : absentToday}
                                icon={<UserRemoveIcon className="w-7 h-7 text-rose-600 dark:text-rose-400"/>}
                                variant="rose"
                                onClick={() => loadDetailsForDay('ABSENT')}
                              />
                              <button
                                onClick={() => {
                                  // انتقال لتقرير شهري فعلي بناءً على البيانات من القاعدة
                                  const now = new Date();
                                  const first = new Date(now.getFullYear(), now.getMonth(), 1);
                                  const last = new Date(now.getFullYear(), now.getMonth()+1, 0);
                                  const toIsoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                                  setReportStartDate(toIsoDate(first));
                                  setReportEndDate(toIsoDate(last));
                                  setReportScope('ALL');
                                  setReportType('ATTENDANCE_TIMES');
                                  setActiveTab('reports');
                                }}
                                className="bg-gradient-to-r from-blue-600 to-indigo-500 text-white rounded-xl shadow-md flex flex-col items-center justify-center p-6 hover:from-blue-700 hover:to-indigo-600 transition-colors"
                              >
                                <DocumentTextIcon className="w-8 h-8 mb-2" />
                                <span className="font-bold">عرض التقرير الشهري</span>
                                <span className="text-xs">مباشر من قاعدة البيانات</span>
                              </button>
                            </div>
                          );

                          // واجهة النافذة المنبثقة للتفاصيل اليومية
                          const DetailModal = detailOpen ? (
                            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur p-5 rounded-xl ring-1 ring-gray-200/60 dark:ring-gray-700/60 shadow-md">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                  {detailType === 'PRESENT' && <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-sm bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"><CheckBadgeIcon className="w-4 h-4"/>حضور اليوم</span>}
                                  {detailType === 'LATE' && <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-sm bg-amber-50 text-amber-700 ring-1 ring-amber-200"><ClockIcon className="w-4 h-4"/>متأخرون اليوم</span>}
                                  {detailType === 'ABSENT' && <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-sm bg-rose-50 text-rose-700 ring-1 ring-rose-200"><UserRemoveIcon className="w-4 h-4"/>غياب اليوم</span>}
                                </div>
                                <div className="flex items-center gap-2">
                                  <input type="date" value={detailDateIso} onChange={e=>setDetailDateIso(e.target.value)} className="px-2 py-1 rounded-md bg-white/70 dark:bg-gray-800/60 ring-1 ring-gray-200/60 dark:ring-gray-700/60 text-sm"/>
                                  <button onClick={()=>loadDetailsForDay(detailType as any)} className="px-2.5 py-1.5 rounded-md bg-blue-600 text-white text-sm hover:bg-blue-700">تحديث</button>
                                  <button onClick={()=>setDetailOpen(false)} className="px-2.5 py-1.5 rounded-md bg-gray-200 text-gray-800 text-sm hover:bg-gray-300">إغلاق</button>
                                </div>
                              </div>

                              {detailType !== 'ABSENT' && (
                                <div className="overflow-x-auto">
                                  <table className="w-full text-sm">
                                    <thead className="text-xs text-gray-800 dark:text-gray-100 bg-gradient-to-r from-indigo-50 via-blue-50 to-cyan-50 dark:from-indigo-900/50 dark:via-blue-900/50 dark:to-cyan-900/50">
                                      <tr>
                                        <th className="px-3 py-2">الموظف</th>
                                        <th className="px-3 py-2">وقت الحضور</th>
                                        <th className="px-3 py-2">متأخر؟</th>
                                        <th className="px-3 py-2">دقائق التأخير</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {detailRecords.map(r => {
                                        const u = users.find(u=>u.id===r.userId);
                                        return (
                                          <tr key={r.id} className="border-b dark:border-gray-700 hover:bg-indigo-50/60 dark:hover:bg-indigo-900/20 transition-colors">
                                            <td className="px-3 py-2">{u?.name || `#${r.userId}`}</td>
                                            <td className="px-3 py-2">{formatTime(r.checkIn)}</td>
                                            <td className="px-3 py-2">{r.isLate ? 'نعم' : 'لا'}</td>
                                            <td className="px-3 py-2">{r.isLate ? r.lateMinutes : 0}</td>
                                          </tr>
                                        );
                                      })}
                                      {detailRecords.length === 0 && (
                                        <tr><td className="px-3 py-3 text-center" colSpan={4}>لا توجد بيانات متاحة لليوم المحدد.</td></tr>
                                      )}
                                    </tbody>
                                  </table>
                                </div>
                              )}

                              {detailType === 'ABSENT' && (
                                <div className="flex flex-wrap gap-2">
                                  {absentList.map(u => (
                                    <span key={u.id} className="inline-flex items-center gap-2 px-2 py-1 rounded-full text-xs bg-rose-50 text-rose-700 ring-1 ring-rose-200 dark:bg-rose-900/30 dark:text-rose-200 dark:ring-rose-800">
                                      {u.name}
                                    </span>
                                  ))}
                                  {absentList.length === 0 && <div className="text-sm">لا يوجد غياب في هذا اليوم.</div>}
                                </div>
                              )}
                            </div>
                          ) : null;

                          return (
                            <>
                              {Cards}
                              {DetailModal}
                            </>
                          );
                        })()}
                    </div>
                )}
                {activeTab === 'analytics' && (
                     <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur p-6 rounded-xl shadow-md ring-1 ring-gray-200/60 dark:ring-gray-700/60 animate-fade-in">
                         <h2 className="text-2xl font-bold mb-4">تحليلات الأداء</h2>
                         <div className="h-0.5 bg-gradient-to-r from-indigo-400 via-blue-400 to-cyan-400 dark:from-indigo-500 dark:via-blue-500 dark:to-cyan-500 rounded-full mb-4" />
                         <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                           <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur p-4 rounded-xl ring-1 ring-gray-200/50 dark:ring-gray-700/50">
                             <h3 className="text-lg font-semibold mb-2">الحضور مقابل الغياب (آخر 14 يوم)</h3>
                             <AttendanceBarChart data={chartAttendanceAbsence} />
                           </div>
                           <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur p-4 rounded-xl ring-1 ring-gray-200/50 dark:ring-gray-700/50">
                             <h3 className="text-lg font-semibold mb-2">مجموع دقائق التأخير (آخر 14 يوم)</h3>
                             <LatenessLineChart data={chartLatenessMinutes} />
                           </div>
                           <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur p-4 rounded-xl ring-1 ring-gray-200/50 dark:ring-gray-700/50">
                             <h3 className="text-lg font-semibold mb-2">عدد التأخيرات اليومية</h3>
                             <AttendanceBarChart data={chartLatenessCount} />
                           </div>
                           <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur p-4 rounded-xl ring-1 ring-gray-200/50 dark:ring-gray-700/50">
                             <h3 className="text-lg font-semibold mb-2">نسبة الحضور/الغياب (إجمالي)</h3>
                             <RequestStatusPieChart data={pieAttendanceAbsence} />
                           </div>
                         </div>
                    </div>
                )}
                {activeTab === 'requests' && (
                    <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur p-6 rounded-xl shadow-md ring-1 ring-gray-200/60 dark:ring-gray-700/60 animate-fade-in">
                        <div className="flex items-center justify-between mb-4">
                          <h2 className="text-2xl font-bold">إدارة الطلبات</h2>
                          <div className="flex flex-wrap gap-2">
                            <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-700 ring-1 ring-amber-200">قيد الانتظار: {pendingCount}</span>
                            <span className="px-3 py-1 rounded-full bg-green-100 text-green-700 ring-1 ring-green-200">مقبول: {approvedCount}</span>
                            <span className="px-3 py-1 rounded-full bg-rose-100 text-rose-700 ring-1 ring-rose-200">مرفوض: {rejectedCount}</span>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 mb-4">
                          <div className="flex gap-2">
                            <button onClick={() => setRequestFilter('ALL')} className={`px-3 py-1.5 text-sm rounded-md ring-1 transition ${requestFilter === 'ALL' ? 'bg-gray-800 text-white ring-gray-300 dark:bg-gray-700' : 'bg-white/60 dark:bg-gray-800/60 text-gray-700 dark:text-gray-300 ring-gray-200/60 dark:ring-gray-700/60 hover:bg-white/80 dark:hover:bg-gray-700/80'}`}>الكل</button>
                            <button onClick={() => setRequestFilter('PENDING')} className={`px-3 py-1.5 text-sm rounded-md ring-1 transition ${requestFilter === 'PENDING' ? 'bg-amber-600 text-white ring-amber-300/60' : 'bg-amber-50 text-amber-700 ring-amber-200 hover:bg-amber-100'}`}>قيد الانتظار</button>
                            <button onClick={() => setRequestFilter('APPROVED')} className={`px-3 py-1.5 text-sm rounded-md ring-1 transition ${requestFilter === 'APPROVED' ? 'bg-green-600 text-white ring-green-300/60' : 'bg-green-50 text-green-700 ring-green-200 hover:bg-green-100'}`}>مقبول</button>
                            <button onClick={() => setRequestFilter('REJECTED')} className={`px-3 py-1.5 text-sm rounded-md ring-1 transition ${requestFilter === 'REJECTED' ? 'bg-rose-600 text-white ring-rose-300/60' : 'bg-rose-50 text-rose-700 ring-rose-200 hover:bg-rose-100'}`}>مرفوض</button>
                          </div>
                          <input value={requestSearch} onChange={e => setRequestSearch(e.target.value)} placeholder="بحث بالاسم/السبب/النوع" className="flex-1 min-w-[220px] px-3 py-2 text-sm rounded-md bg-white/60 dark:bg-gray-800/60 ring-1 ring-gray-200/60 dark:ring-gray-700/60 focus:ring-2 focus:ring-amber-300 outline-none" />
                          <label className="flex items-center gap-2 text-sm">
                            <input type="checkbox" className="rounded" onChange={e => toggleSelectAll(e.target.checked)} checked={selectedRequestIds.length > 0 && selectedRequestIds.length === filteredRequests.length && filteredRequests.length > 0} />
                            <span>تحديد الكل</span>
                          </label>
                        </div>

                        {selectedRequestIds.length > 0 && (
                          <div className="flex items-center gap-2 mb-4">
                            <button onClick={approveSelected} className="px-4 py-2 text-sm rounded-md bg-gradient-to-r from-emerald-600 to-green-500 text-white hover:from-emerald-700 hover:to-green-600">اعتماد المحدد</button>
                            <button onClick={rejectSelected} className="px-4 py-2 text-sm rounded-md bg-gradient-to-r from-rose-600 to-pink-500 text-white hover:from-rose-700 hover:to-pink-600">رفض المحدد</button>
                            <span className="text-sm text-gray-500 dark:text-gray-400">المحدد: {selectedRequestIds.length}</span>
                          </div>
                        )}

                        <div className="overflow-x-auto">
                          <table className="w-full text-sm text-left text-gray-600 dark:text-gray-300">
                            <thead className="text-xs text-gray-800 dark:text-gray-100 bg-gradient-to-r from-indigo-50 via-blue-50 to-cyan-50 dark:from-indigo-900/50 dark:via-blue-900/50 dark:to-cyan-900/50">
                              <tr>
                                <th className="px-4 py-3">تحديد</th>
                                <th className="px-4 py-3">الموظف</th>
                                <th className="px-4 py-3">النوع</th>
                                <th className="px-4 py-3">التاريخ</th>
                                <th className="px-4 py-3">السبب</th>
                                <th className="px-4 py-3">الحالة</th>
                                <th className="px-4 py-3">إجراء</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredRequests.map(req => {
                                const userName = users.find(u => u.id === req.userId)?.name || '—';
                                const statusLabel = req.status; // Arabic enum value
                                const statusClass = req.status === RequestStatus.PENDING ? 'bg-amber-100 text-amber-700 ring-amber-200' : req.status === RequestStatus.APPROVED ? 'bg-green-100 text-green-700 ring-green-200' : 'bg-rose-100 text-rose-700 ring-rose-200';
                                const isChecked = selectedRequestIds.includes(req.id);
                                return (
                                  <tr key={req.id} className="bg-white/70 dark:bg-gray-800/60 border-b border-gray-100 dark:border-gray-700 hover:bg-indigo-50/60 dark:hover:bg-indigo-900/20 transition-colors">
                                    <td className="px-4 py-3"><input type="checkbox" className="rounded" checked={isChecked} onChange={e => toggleSelectOne(req.id, e.target.checked)} /></td>
                                    <td className="px-4 py-3">{userName}</td>
                                    <td className="px-4 py-3">{req.type}</td>
                                    <td className="px-4 py-3">{new Date(req.date).toLocaleDateString('ar-EG')}</td>
                                    <td className="px-4 py-3"><span className="inline-block max-w-[28ch] truncate" title={req.reason}>{req.reason}</span></td>
                                    <td className="px-4 py-3">
                                      {req.status === RequestStatus.PENDING && (
                                        <span title="بإنتظار المراجعة" className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-50 text-amber-600 ring-1 ring-amber-200">
                                          <ClockIcon className="w-4 h-4" />
                                        </span>
                                      )}
                                      {req.status === RequestStatus.APPROVED && (
                                        <span title="تمت الموافقة" className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-green-50 text-green-600 ring-1 ring-green-200">
                                          <CheckCircleIcon className="w-4 h-4" />
                                        </span>
                                      )}
                                      {req.status === RequestStatus.REJECTED && (
                                        <span title="مرفوض" className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-rose-50 text-rose-600 ring-1 ring-rose-200">
                                          <XCircleIcon className="w-4 h-4" />
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-4 py-3 flex gap-2">
                                      <button onClick={() => handleRequestStatus(req.id, RequestStatus.APPROVED)} className="p-1.5 rounded-md bg-green-50 ring-1 ring-green-200 text-green-700 hover:bg-green-100"><CheckCircleIcon className="w-5 h-5"/></button>
                                      <button onClick={() => handleRequestStatus(req.id, RequestStatus.REJECTED)} className="p-1.5 rounded-md bg-rose-50 ring-1 ring-rose-200 text-rose-700 hover:bg-rose-100"><XCircleIcon className="w-5 h-5"/></button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                          {filteredRequests.length === 0 && <p className="text-center p-4">لا توجد نتائج مطابقة.</p>}
                        </div>
                    </div>
                )}
                {activeTab === 'reports' && (
                    <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur p-6 rounded-xl shadow-md ring-1 ring-gray-200/60 dark:ring-gray-700/60 animate-fade-in">
                        <div className="flex items-center justify-between mb-4">
                          <h2 className="text-2xl font-bold">نظام التقارير المتقدم</h2>
                          <div className="flex gap-2">
                            <button onClick={handleGenerateMonthlyReport} className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700">توليد التقرير الشهري</button>
                            {generatedReport && <button onClick={() => setGeneratedReport(null)} className="px-4 py-2 rounded-md bg-gray-200 text-gray-800 hover:bg-gray-300">إخفاء الملخص</button>}
                            <button onClick={exportMonthlyReportExcel} disabled={!generatedReport} className={`px-4 py-2 rounded-md text-white ${generatedReport ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-gray-400 cursor-not-allowed'}`}>تصدير التقرير الشهري Excel</button>
                          </div>
                        </div>

                        {/* نوع التقرير والتصدير - أعلى الصفحة لسهولة الوصول */}
                        <div className="mb-4 p-3 rounded-lg bg-white/60 dark:bg-gray-800/60 ring-1 ring-gray-200/60 dark:ring-gray-700/60">
                          <div className="font-semibold mb-2">نوع التقرير والتصدير</div>
                          <select value={reportType ?? ''} onChange={e=>setReportType((e.target.value || null) as any)} className="w-full mb-2 px-3 py-2 rounded-md bg-white/70 dark:bg-gray-800/60 ring-1 ring-gray-200/60 dark:ring-gray-700/60">
                            <option value="">اختر نوع التقرير</option>
                            <option value="LATE_HOURS">ساعات التأخير باليوم</option>
                            <option value="LATE_MINUTES">دقائق التأخير باليوم</option>
                            <option value="ATTENDANCE_TIMES">الحضور والانصراف وإجمالي الساعات</option>
                            <option value="ABSENCES">الغيابات المصنفة</option>
                            <option value="EXCUSES">الاعتذارات الرسمية</option>
                          </select>
                          <button onClick={exportReportExcel} disabled={!reportType} className={`w-full px-3 py-2 rounded-md text-white ${reportType ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-gray-400 cursor-not-allowed'}`}>تصدير Excel</button>
                          {!reportType && (
                            <div className="mt-2 text-xs text-gray-700 dark:text-gray-300">من فضلك اختر نوع التقرير لعرض البيانات.</div>
                          )}
                        </div>

                        {generatedReport && (
                          <div className="mb-6 p-5 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 ring-1 ring-blue-200 dark:from-blue-900/30 dark:to-indigo-900/30 dark:ring-blue-800">
                            <h3 className="text-xl font-bold mb-4">{generatedReport.title}</h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                              <div className="p-3 rounded-lg bg-white/80 dark:bg-gray-800/70 ring-1 ring-gray-200/60 dark:ring-gray-700/60">
                                <div className="text-xs text-gray-500">إجمالي التأخيرات</div>
                                <div className="text-lg font-semibold">{generatedReport.data.summary.totalLateness}</div>
                              </div>
                              <div className="p-3 rounded-lg bg-white/80 dark:bg-gray-800/70 ring-1 ring-gray-200/60 dark:ring-gray-700/60">
                                <div className="text-xs text-gray-500">نسبة الحضور</div>
                                <div className="text-lg font-semibold">{generatedReport.data.summary.attendanceRate}</div>
                                <div className="mt-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden"><div className="h-full bg-emerald-500" style={{width: String(generatedReport.data.summary.attendanceRate).replace('%','')+'%'}} /></div>
                              </div>
                              <div className="p-3 rounded-lg bg-white/80 dark:bg-gray-800/70 ring-1 ring-gray-200/60 dark:ring-gray-700/60">
                                <div className="text-xs text-gray-500">أعلى قسم تأخيراً</div>
                                <div className="text-lg font-semibold">{generatedReport.data.summary.highestDept}</div>
                              </div>
                              <div className="p-3 rounded-lg bg-white/80 dark:bg-gray-800/70 ring-1 ring-gray-200/60 dark:ring-gray-700/60">
                                <div className="text-xs text-gray-500">غير مبرر</div>
                                <div className="text-lg font-semibold">{generatedReport.data.summary.unjustifiedAbsences}</div>
                              </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {generatedReport.data.lateEmployeesData.map((d:any) => (
                                <div key={d.name} className="p-3 bg-white/80 dark:bg-gray-800/70 rounded-lg ring-1 ring-gray-200/60 dark:ring-gray-700/60">
                                  <div className="flex items-center justify-between">
                                    <div className="font-semibold">{d.name}</div>
                                    <div className="text-xs text-gray-500">{d.lateDays} أيام</div>
                                  </div>
                                  <div className="mt-1 text-sm">إجمالي: {d.totalLateHours} | متوسط: {d.avgLateMinutes} د</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="p-3 rounded-lg bg-white/60 dark:bg-gray-800/60 ring-1 ring-gray-200/60 dark:ring-gray-700/60">
                            <div className="font-semibold mb-2">نطاق الموظفين</div>
                            <div className="flex items-center gap-3 mb-3">
                              <label className="flex items-center gap-2 text-sm">
                                <input type="checkbox" checked={reportScope==='ALL'} onChange={e => {
                                  if (e.target.checked) {
                                    setReportScope('ALL');
                                  } else {
                                    // عند إلغاء الكل، نعود لاختيار متعدد بناءً على القائمة الحالية
                                    setReportScope(reportEmployeeIds.length <= 1 ? 'ONE' : 'MULTI');
                                  }
                                }} />
                                <span>الكل</span>
                              </label>
                              <input
                                type="text"
                                placeholder="ابحث بالاسم..."
                                value={reportEmployeeQuery}
                                onChange={e=>setReportEmployeeQuery(e.target.value)}
                                className="flex-1 px-3 py-2 rounded-md bg-white/70 dark:bg-gray-800/60 ring-1 ring-gray-200/60 dark:ring-gray-700/60"
                              />
                              <button
                                type="button"
                                onClick={() => { setReportEmployeeIds([]); setReportScope('ONE'); }}
                                className={`px-2 py-1 rounded-md text-xs ring-1 ${((reportScope !== 'ALL') && ((reportEmployeeId !== null) || (reportEmployeeIds.length > 0))) 
                                  ? 'bg-red-100 text-red-700 ring-red-200 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-200 dark:ring-red-800'
                                  : 'bg-gray-100 text-gray-700 ring-gray-200 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:ring-gray-600'}`}
                              >مسح الاختيار</button>
                            </div>
                            <div className="flex flex-wrap gap-2 mb-2">
                              {reportEmployeeIds.map(id => {
                                const u = employeeUsers.find(e=>e.id===id);
                                if (!u) return null;
                                return (
                                  <span key={id} className="inline-flex items-center gap-2 px-2 py-1 rounded-full text-xs bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:ring-emerald-800">
                                    {u.name}
                                    <button className="text-emerald-700 dark:text-emerald-200" onClick={() => setReportEmployeeIds(prev => prev.filter(x=>x!==id))}>×</button>
                                  </span>
                                );
                              })}
                            </div>
                            {reportScope!=='ALL' && (
                              <div className="max-h-40 overflow-y-auto space-y-1">
                                {employeeUsers.filter(u => u.name.toLowerCase().includes(reportEmployeeQuery.toLowerCase())).map(u => {
                                  const checked = reportEmployeeIds.includes(u.id);
                                  return (
                                    <label key={u.id} className="flex items-center gap-2 text-sm">
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={e => {
                                          setReportEmployeeIds(prev => {
                                            const next = e.target.checked ? [...new Set([...prev,u.id])] : prev.filter(id=>id!==u.id);
                                            // إذا كان واحد فقط فاعتبره موظف واحد، وإلا عدة موظفين
                                            setReportScope(next.length <= 1 ? 'ONE' : 'MULTI');
                                            // حدث أيضًا reportEmployeeId عند حالة الموظف الواحد
                                            if (next.length === 1) {
                                              setReportEmployeeId(next[0]);
                                            }
                                            return next;
                                          });
                                        }}
                                      />
                                      <span>{u.name}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            )}
                            <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">اختر "الكل" أو حدّد موظفاً واحداً أو عدة موظفين مع إمكانية البحث.</div>
                          </div>
                          <div className="p-3 rounded-lg bg-white/60 dark:bg-gray-800/60 ring-1 ring-gray-200/60 dark:ring-gray-700/60">
                            <div className="font-semibold mb-2">نطاق التاريخ</div>
                            <div className="grid grid-cols-2 gap-2">
                              <input type="date" value={reportStartDate} onChange={e=>setReportStartDate(e.target.value)} className="px-3 py-2 rounded-md bg-white/70 dark:bg-gray-800/60 ring-1 ring-gray-200/60 dark:ring-gray-700/60" />
                              <input type="date" value={reportEndDate} onChange={e=>setReportEndDate(e.target.value)} className="px-3 py-2 rounded-md bg-white/70 dark:bg-gray-800/60 ring-1 ring-gray-200/60 dark:ring-gray-700/60" />
                            </div>
                            <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">إن لم تُحدَّد التواريخ، سيُستخدم آخر 14 يوماً.</div>
                          </div>
                        </div>

                        

                        <div className="space-y-6">
                          {!reportType && (
                            <div className="bg-white/60 dark:bg-gray-800/60 rounded-xl p-4 ring-1 ring-gray-200/60 dark:ring-gray-700/60">
                              <h3 className="text-lg font-semibold mb-2">التقارير</h3>
                              <p className="text-sm text-gray-600 dark:text-gray-400">من فضلك اختر نوع التقرير لعرض البيانات.</p>
                            </div>
                          )}
                          {reportType === 'LATE_HOURS' && (
                          <div className="bg-white/60 dark:bg-gray-800/60 rounded-xl p-4 ring-1 ring-gray-200/60 dark:ring-gray-700/60">
                            <h3 className="text-lg font-semibold mb-3">1) ساعات التأخير باليوم</h3>
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead className="text-xs text-gray-800 dark:text-gray-100 bg-gradient-to-r from-indigo-50 via-blue-50 to-cyan-50 dark:from-indigo-900/50 dark:via-blue-900/50 dark:to-cyan-900/50">
                                  <tr>
                                    <th className="px-3 py-2">التاريخ</th>
                                    <th className="px-3 py-2">الموظف</th>
                                    <th className="px-3 py-2">ساعات التأخير</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {employeeUsers.filter(u=>selectedIds.includes(u.id)).flatMap(u => {
                                    return dayList.map(d => {
                                      const key = `${u.id}-${d.toDateString()}`;
                                      const recs = byUserDay.get(key) || [];
                                      const mins = recs.reduce((sum,r)=>sum+(r.isLate?r.lateMinutes:0),0);
                                      return (
                                        <tr key={key} className="border-b dark:border-gray-700 hover:bg-indigo-50/60 dark:hover:bg-indigo-900/20 transition-colors">
                                          <td className="px-3 py-2">{d.toLocaleDateString('ar-EG')}</td>
                                          <td className="px-3 py-2">{u.name}</td>
                                          <td className="px-3 py-2">{formatHm(mins)}</td>
                                        </tr>
                                      );
                                    });
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                          )}

                          {reportType === 'LATE_MINUTES' && (
                          <div className="bg-white/60 dark:bg-gray-800/60 rounded-xl p-4 ring-1 ring-gray-200/60 dark:ring-gray-700/60">
                            <h3 className="text-lg font-semibold mb-3">2) دقائق التأخير باليوم</h3>
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead className="text-xs text-gray-800 dark:text-gray-100 bg-gradient-to-r from-indigo-50 via-blue-50 to-cyan-50 dark:from-indigo-900/50 dark:via-blue-900/50 dark:to-cyan-900/50">
                                  <tr>
                                    <th className="px-3 py-2">التاريخ</th>
                                    <th className="px-3 py-2">الموظف</th>
                                    <th className="px-3 py-2">دقائق التأخير</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {employeeUsers.filter(u=>selectedIds.includes(u.id)).flatMap(u => {
                                    return dayList.map(d => {
                                      const key = `${u.id}-${d.toDateString()}`;
                                      const recs = byUserDay.get(key) || [];
                                      const mins = recs.reduce((sum,r)=>sum+(r.isLate?r.lateMinutes:0),0);
                                      return (
                                        <tr key={key} className="border-b dark:border-gray-700 hover:bg-indigo-50/60 dark:hover:bg-indigo-900/20 transition-colors">
                                          <td className="px-3 py-2">{d.toLocaleDateString('ar-EG')}</td>
                                          <td className="px-3 py-2">{u.name}</td>
                                          <td className="px-3 py-2">{mins} دقيقة</td>
                                        </tr>
                                      );
                                    });
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                          )}

                          {reportType === 'ATTENDANCE_TIMES' && (
                          <div className="bg-white/60 dark:bg-gray-800/60 rounded-xl p-4 ring-1 ring-gray-200/60 dark:ring-gray-700/60">
                            <h3 className="text-lg font-semibold mb-3">3) وقت الحضور والانصراف</h3>
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead className="text-xs text-gray-800 dark:text-gray-100 bg-gradient-to-r from-indigo-50 via-blue-50 to-cyan-50 dark:from-indigo-900/50 dark:via-blue-900/50 dark:to-cyan-900/50">
                                  <tr>
                                    <th className="px-3 py-2">التاريخ</th>
                                    <th className="px-3 py-2">الموظف</th>
                                    <th className="px-3 py-2">وقت الحضور</th>
                                    <th className="px-3 py-2">وقت الانصراف</th>
                                    <th className="px-3 py-2">إجمالي الساعات</th>
                                    <th className="px-3 py-2">حالة اليوم</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {employeeUsers.filter(u=>selectedIds.includes(u.id)).flatMap(u => {
                                    return dayList.map(d => {
                                      const key = `${u.id}-${d.toDateString()}`;
                                      const recs = byUserDay.get(key) || [];
                                      const first = recs.slice().sort((a,b)=>new Date(a.checkIn).getTime()-new Date(b.checkIn).getTime())[0];
                                      const last = recs.slice().sort((a,b)=>new Date(a.checkOut||a.checkIn).getTime()-new Date(b.checkOut||b.checkIn).getTime()).slice(-1)[0];
                                      const ci = first?.checkIn ? new Date(first.checkIn).toLocaleTimeString('ar-EG') : '-';
                                      const co = last?.checkOut ? new Date(last.checkOut).toLocaleTimeString('ar-EG') : '-';
                                      const tot = totalHours(first?.checkIn, last?.checkOut);
                                      const st = statusForDay(u.id, d);
                                      return (
                                        <tr key={key} className="border-b dark:border-gray-700 hover:bg-indigo-50/60 dark:hover:bg-indigo-900/20 transition-colors">
                                          <td className="px-3 py-2">{d.toLocaleDateString('ar-EG')}</td>
                                          <td className="px-3 py-2">{u.name}</td>
                                          <td className="px-3 py-2">{ci}</td>
                                          <td className="px-3 py-2">{co}</td>
                                          <td className="px-3 py-2">{tot}</td>
                                          <td className="px-3 py-2">{st}</td>
                                        </tr>
                                      );
                                    });
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                          )}

                          {reportType === 'ABSENCES' && (
                          <div className="bg-white/60 dark:bg-gray-800/60 rounded-xl p-4 ring-1 ring-gray-200/60 dark:ring-gray-700/60">
                            <h3 className="text-lg font-semibold mb-3">4) الغيابات</h3>
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead className="text-xs text-gray-800 dark:text-gray-100 bg-gradient-to-r from-indigo-50 via-blue-50 to-cyan-50 dark:from-indigo-900/50 dark:via-blue-900/50 dark:to-cyan-900/50">
                                  <tr>
                                    <th className="px-3 py-2">{t('date')}</th>
                                    <th className="px-3 py-2">{t('employeeLabel2')}</th>
                                    <th className="px-3 py-2">{t('absenceType')}</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {employeeUsers.filter(u=>selectedIds.includes(u.id)).flatMap(u => {
                                    return dayList.map(d => {
                                      const st = statusForDay(u.id, d);
                                      const code = ((): 'PRESENT'|'LATE'|string => {
                                        const s = dayStatusCode(u.id, d);
                                        return s;
                                      })();
                                      if (code === 'PRESENT' || code === 'LATE') return null;
                                      return (
                                        <tr key={`${u.id}-abs-${d.toDateString()}`} className="border-b dark:border-gray-700 hover:bg-indigo-50/60 dark:hover:bg-indigo-900/20 transition-colors">
                                          <td className="px-3 py-2">{d.toLocaleDateString(locale)}</td>
                                          <td className="px-3 py-2">{u.name}</td>
                                          <td className="px-3 py-2">{statusForDay(u.id, d)}</td>
                                        </tr>
                                      );
                                    }).filter(Boolean);
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                          )}

                          {reportType === 'EXCUSES' && (
                          <div className="bg-white/60 dark:bg-gray-800/60 rounded-xl p-4 ring-1 ring-gray-200/60 dark:ring-gray-700/60">
                            <h3 className="text-lg font-semibold mb-3">5) {t('officialExcusesTitle')}</h3>
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead className="text-xs text-gray-800 dark:text-gray-100 bg-gradient-to-r from-indigo-50 via-blue-50 to-cyan-50 dark:from-indigo-900/50 dark:via-blue-900/50 dark:to-cyan-900/50">
                                  <tr>
                                    <th className="px-3 py-2">{t('date')}</th>
                                    <th className="px-3 py-2">{t('employeeLabel2')}</th>
                                    <th className="px-3 py-2">{t('reasonCol')}</th>
                                    <th className="px-3 py-2">{t('status')}</th>
                                    <th className="px-3 py-2">{t('adminNote')}</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {requests.filter(r => r.type === RequestType.EXCUSE && selectedIds.includes(r.userId) && inDateRange(r.date)).map(r => {
                                    const u = users.find(u => u.id === r.userId);
                                    const note = (r as any).adminNote || '-';
                                    return (
                                      <tr key={`exc-${r.id}`} className="border-b dark:border-gray-700 hover:bg-indigo-50/60 dark:hover:bg-indigo-900/20 transition-colors">
                                        <td className="px-3 py-2">{new Date(r.date).toLocaleDateString(locale)}</td>
                                        <td className="px-3 py-2">{u?.name || '—'}</td>
                                        <td className="px-3 py-2"><span className="inline-block max-w-[28ch] truncate" title={r.reason}>{r.reason}</span></td>
                                        <td className="px-3 py-2">{r.status}</td>
                                        <td className="px-3 py-2">{note}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                          )}
                        </div>
                    </div>
                )}
                 {activeTab === 'chat' && (
                    <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur p-6 rounded-xl shadow-md ring-1 ring-gray-200/60 dark:ring-gray-700/60 animate-fade-in">
                        <h2 className="text-2xl font-bold mb-4">{t('liveChatsTitle')}</h2>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          <div>
                            <h3 className="text-lg font-semibold mb-3">{t('employeeListTitle')}</h3>
                            <div className="relative">
                              <button
                                onClick={() => setIsEmployeePickerOpen(v => !v)}
                                className="text-sm px-3 py-2 rounded-md bg-gradient-to-r from-indigo-600 to-blue-500 text-white hover:from-indigo-700 hover:to-blue-600"
                              >
                                {t('pickEmployeeToChat')}
                              </button>
                              {isEmployeePickerOpen && (
                                <>
                                  <div
                                    className="fixed inset-0 z-10 bg-black/20 dark:bg-black/40"
                                    onClick={() => setIsEmployeePickerOpen(false)}
                                  />
                                  <div className="absolute z-20 mt-2 w-full max-w-md p-3 rounded-lg bg-white dark:bg-gray-800 shadow-lg ring-1 ring-gray-200/70 dark:ring-gray-700/70">
                                    <div className="flex items-center gap-2 mb-2">
                                      <input
                                        type="text"
                                        value={employeePickerQuery}
                                        onChange={(e)=>setEmployeePickerQuery(e.target.value)}
                                        placeholder={t('searchByNamePlaceholder')}
                                        className="flex-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                                      />
                                      <button onClick={()=>setEmployeePickerQuery('')} className="text-xs px-2 py-1 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200">{t('clear')}</button>
                                    </div>
                                    <div className="max-h-64 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700">
                                      {employeeUsers
                                        .filter(u => !employeePickerQuery || (u.name || '').toLowerCase().includes(employeePickerQuery.toLowerCase()))
                                        .map(u => {
                                          const openSession = chatSessions.find(s => s.employeeId === u.id && s.isOpen);
                                          return (
                                            <button
                                              key={u.id}
                                              onClick={() => { openChatWith(u.id); setIsEmployeePickerOpen(false); setEmployeePickerQuery(''); }}
                                              className="w-full text-right px-2 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-between"
                                            >
                                              <div className="flex items-center gap-3">
                                                <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-800 flex items-center justify-center text-indigo-700 dark:text-indigo-100 text-xs font-bold">
                                                  {u.name?.charAt(0) || t('employeeLabel2').charAt(0)}
                                                </div>
                                                <div>
                                                  <div className="text-base font-medium">{u.name}</div>
                                                  <div className="text-xs text-gray-500 dark:text-gray-300">{openSession ? t('chatOpen') : t('noChatOpen')}</div>
                                                </div>
                                              </div>
                                              <span className={`text-xs px-2 py-0.5 rounded-md ${openSession ? 'bg-green-100 text-green-700 dark:bg-green-200 dark:text-green-900' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200'}`}>{openSession ? t('active') : t('inactive')}</span>
                                            </button>
                                          );
                                        })}
                                      {employeeUsers.filter(u => !employeePickerQuery || (u.name || '').toLowerCase().includes(employeePickerQuery.toLowerCase())).length === 0 && (
                                        <div className="text-xs text-gray-500 dark:text-gray-300 p-2">{t('noResults')}</div>
                                      )}
                                    </div>
                                  </div>
                                </>
                              )}
                            </div>

                            <div className="mt-6 mb-3">
                              <h3 className="text-base sm:text-lg font-semibold text-center text-gray-800 dark:text-gray-100">{t('chatHistoryTitle')}</h3>
                              <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
                                <div className="inline-flex rounded-md ring-1 ring-gray-200/60 dark:ring-gray-700/60 overflow-hidden">
                                  <button
                                    type="button"
                                    onClick={() => setChatHistoryFilter('ALL')}
                                    className={`px-3 py-1.5 text-sm ${chatHistoryFilter === 'ALL' ? 'bg-indigo-600 text-white' : 'bg-white/60 dark:bg-gray-800/60 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                                  >
                                    {t('filterAll')}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setChatHistoryFilter('OPEN')}
                                    className={`px-3 py-1.5 text-sm border-l border-gray-200/60 dark:border-gray-700/60 ${chatHistoryFilter === 'OPEN' ? 'bg-indigo-600 text-white' : 'bg-white/60 dark:bg-gray-800/60 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                                  >
                                    {t('filterOpen')}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setChatHistoryFilter('CLOSED')}
                                    className={`px-3 py-1.5 text-sm border-l border-gray-200/60 dark:border-gray-700/60 ${chatHistoryFilter === 'CLOSED' ? 'bg-indigo-600 text-white' : 'bg-white/60 dark:bg-gray-800/60 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                                  >
                                    {t('filterClosed')}
                                  </button>
                                </div>
                                <input
                                  type="text"
                                  value={chatHistoryQuery}
                                  onChange={(e) => setChatHistoryQuery(e.target.value)}
                                  placeholder={t('searchNameLastMessagePlaceholder')}
                                  className="px-2 py-1.5 text-sm rounded-md ring-1 ring-gray-200/60 dark:ring-gray-700/60 bg-white/60 dark:bg-gray-800/60 text-gray-700 dark:text-gray-200 focus:outline-none w-full sm:w-64 text-center sm:text-right"
                                />
                              </div>
                            </div>
                            <div className="space-y-2">
                              {(() => {
                                const sessionsEnriched = [...chatSessions]
                                  .map(s => {
                                    const emp = users.find(x => x.id === s.employeeId);
                                    const msgs = chatMessages
                                      .filter(m => (m.fromUserId === currentUser.id && m.toUserId === s.employeeId) || (m.toUserId === currentUser.id && m.fromUserId === s.employeeId))
                                      .sort((a,b)=>new Date(a.timestamp).getTime()-new Date(b.timestamp).getTime());
                                    const last = msgs.slice(-1)[0] || null;
                                    const unreadCount = chatMessages.filter(m => m.fromUserId === s.employeeId && m.toUserId === currentUser.id && !m.read).length;
                                    return { s, emp, last, unreadCount };
                                  })
                                  .filter(({ s }) => chatHistoryFilter === 'ALL' ? true : chatHistoryFilter === 'OPEN' ? s.isOpen : !s.isOpen)
                                  .filter(({ emp, last }) => {
                                    const needle = chatHistoryQuery.trim().toLowerCase();
                                    if (!needle) return true;
                                    const hay = `${emp?.name || ''} ${last?.message || ''}`.toLowerCase();
                                    return hay.includes(needle);
                                  })
                                  .sort((a,b) => {
                                    const timeA = a.last ? new Date(a.last.timestamp).getTime() : new Date(a.s.createdAt).getTime();
                                    const timeB = b.last ? new Date(b.last.timestamp).getTime() : new Date(b.s.createdAt).getTime();
                                    return timeB - timeA;
                                  });

                                return (
                                  <>
                                    {sessionsEnriched.map(({ s, emp, last, unreadCount }) => {
                                      const statusBadge = s.isOpen ? 'bg-green-100 text-green-700 dark:bg-green-200 dark:text-green-900' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200';
                                      const isActive = activeChatEmployeeId === s.employeeId;
                                      return (
                                        <button
                                          key={s.id}
                                          type="button"
                                          onClick={() => { setActiveChatEmployeeId(s.employeeId); markSessionMessagesRead(s.employeeId); }}
                                          className={`w-full text-right p-2 rounded-md ring-1 ring-gray-200/60 dark:ring-gray-700/60 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer ${isActive ? 'bg-indigo-50 dark:bg-indigo-900/40' : 'bg-white/60 dark:bg-gray-800/60'}`}
                                        >
                                          <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                              <div className="relative w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-gray-700 dark:text-gray-200 text-xs font-bold">
                                                {emp?.name?.charAt(0) || t('employeeLabel2').charAt(0)}
                                                {unreadCount > 0 && (
                                                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs leading-none px-1 rounded-full">{unreadCount}</span>
                                                )}
                                              </div>
                                              <div>
                                                <div className="text-base font-medium">
                                                  {emp?.name || '—'}
                                                  <span className={`ml-2 text-xs px-2 py-0.5 rounded-md ${statusBadge}`}>{s.isOpen ? t('open') : t('closed')}</span>
                                                  {isActive && <span className="ml-2 text-xs text-indigo-700 dark:text-indigo-300">{t('active')}</span>}
                                                </div>
                                                <div className="text-xs text-gray-500 dark:text-gray-300">{new Date(s.createdAt).toLocaleString(locale)}</div>
                                                {last && (
                                                  <div className="text-sm mt-1 text-gray-700 dark:text-gray-200 truncate max-w-[40ch]">
                                                    {last.fromUserId === currentUser.id ? t('youLabel') : `${emp?.name || t('employeeLabelGeneric')}:`} {last.message}
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                            {!s.isOpen && s.closedAt && (
                                              <div className="text-xs text-gray-500 dark:text-gray-300">{t('closedAt')} {new Date(s.closedAt).toLocaleString(locale)}</div>
                                            )}
                                          </div>
                                        </button>
                                      );
                                    })}
                                    {sessionsEnriched.length === 0 && (
                                      <div className="text-sm text-gray-500 dark:text-gray-300">{t('noHistoryResults')}</div>
                                    )}
                                  </>
                                );
                              })()}
                            </div>
                          </div>

                          {/* Chat sidebar */}
                          <div className="relative">
                            {activeChatEmployeeId ? (
                              <div className="lg:absolute lg:right-0 lg:top-0 lg:bottom-0 lg:w-full bg-white/80 dark:bg-gray-900/80 rounded-xl ring-1 ring-gray-200/60 dark:ring-gray-700/60 p-4">
                                {(() => {
                                  const emp = users.find(u => u.id === activeChatEmployeeId);
                                  const msgs = chatMessages
                                    .filter(m => (m.fromUserId === currentUser.id && m.toUserId === activeChatEmployeeId) || (m.toUserId === currentUser.id && m.fromUserId === activeChatEmployeeId))
                                    .sort((a,b)=>new Date(a.timestamp).getTime()-new Date(b.timestamp).getTime());
                                  return (
                                    <>
                                      <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                          <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-800 flex items-center justify-center text-indigo-700 dark:text-indigo-100 font-bold">
                                            {emp?.name?.charAt(0) || 'م'}
                                          </div>
                                          <div>
                                            <div className="text-lg font-semibold">{emp?.name || '—'}</div>
                                            <div className="text-xs text-gray-500 dark:text-gray-300">{activeChatSession ? t('chatOpen') : t('chatClosedPlaceholder')}</div>
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <button onClick={closeActiveChat} className="text-sm px-3 py-1.5 rounded-md bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-200 dark:text-red-900">{t('closeChat')}</button>
                                          <button onClick={() => setActiveChatEmployeeId(null)} className="text-sm px-3 py-1.5 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200">{t('hide')}</button>
                                          <button onClick={() => emp && setCurrentUser(emp)} className="text-sm px-3 py-1.5 rounded-md bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-200 dark:text-indigo-900">{t('impersonatePrefix')} {emp?.name || t('employeeLabelGeneric')}</button>
                                        </div>
                                      </div>

                                      {!activeChatSession && (
                                        <div className="mb-2 text-sm text-amber-700 bg-amber-100 dark:bg-amber-200 dark:text-amber-900 rounded-md px-3 py-2">{t('chatClosedBanner')}</div>
                                      )}

                                      <div className="h-[50vh] overflow-y-auto space-y-2 p-2 bg-gray-50 dark:bg-gray-800 rounded-md">
                                        {msgs.map(m => {
                                          const isAdmin = m.fromUserId === currentUser.id;
                                          return (
                                            <div key={m.id} className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                                              <div className={`max-w-[70%] px-3 py-2 rounded-lg text-sm ${isAdmin ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100' : 'bg-gray-900 text-white dark:bg-gray-900'}`}>
                                                <div className="text-xs opacity-70 mb-1">{isAdmin ? t('adminLabel2') : emp?.name || t('employeeLabelGeneric')}</div>
                                                <div>{m.message}</div>
                                                <div className="text-xs opacity-60 mt-1 text-right">{new Date(m.timestamp).toLocaleString(locale)}</div>
                                              </div>
                                            </div>
                                          );
                                        })}
                                        {msgs.length === 0 && (
                                          <div className="text-xs text-gray-500 dark:text-gray-300">{t('startChatBySending')}</div>
                                        )}
                                      </div>

                                      <div className="mt-3 flex items-center gap-2">
                                        <input
                                          type="text"
                                          value={chatInput}
                                          onChange={(e)=>setChatInput(e.target.value)}
                                          placeholder={t('typeTextMessagePlaceholder')}
                                          className="flex-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                                          disabled={!activeChatSession}
                                        />
                                        <button onClick={sendChatMessage} disabled={!activeChatSession || !chatInput.trim()} className={`text-sm px-4 py-2 rounded-md ${!activeChatSession || !chatInput.trim() ? 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-indigo-600 to-blue-500 text-white hover:from-indigo-700 hover:to-blue-600'}`}>{t('send')}</button>
                                      </div>
                                    </>
                                  );
                                })()}
                              </div>
                            ) : (
                              <div className="rounded-xl ring-1 ring-gray-200/60 dark:ring-gray-700/60 p-4 bg-white/60 dark:bg-gray-800/60 text-sm text-gray-600 dark:text-gray-300">{t('selectEmployeeToStart')}</div>
                            )}
                          </div>
                        </div>
                    </div>
                 )}
                 {activeTab === 'notifications' && (
                     <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur p-6 rounded-xl shadow-md ring-1 ring-gray-200/60 dark:ring-gray-700/60 animate-fade-in">
                        <h2 className="text-2xl font-bold mb-4">{t('sendNotificationTitle')}</h2>
                        <p className="mb-4 text-sm text-gray-600 dark:text-gray-300">{t('sendNotificationDesc')}</p>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          <div className="p-4 rounded-xl ring-1 ring-gray-200/60 dark:ring-gray-700/60 bg-white/60 dark:bg-gray-800/60">
                            <h3 className="text-lg font-semibold mb-3">{t('notifyEmployeeTitle')}</h3>
                            <EmployeeNotificationForm users={users} onSent={(n)=>setNotifications(prev=>[n,...prev])} />
                          </div>
                          <div className="p-4 rounded-xl ring-1 ring-gray-200/60 dark:ring-gray-700/60 bg-white/60 dark:bg-gray-800/60">
                            <h3 className="text-lg font-semibold mb-3">{t('notifyAllTitle')}</h3>
                            <GeneralNotificationForm onSent={(n)=>setNotifications(prev=>[n,...prev])} />
                          </div>
                        </div>
                    </div>
                 )}
                 {activeTab === 'settings' && (
                     <div className="space-y-6 animate-fade-in">
                     {/* Users Management */}
                     <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur p-6 rounded-xl shadow-md ring-1 ring-gray-200/60 dark:ring-gray-700/60">
                       <div className="flex items-center justify-between mb-4">
                         <h2 className="text-2xl font-bold">{t('usersManagementTitle')}</h2>
                         <button onClick={()=>setCollapseUsers(v=>!v)} aria-label={t('collapseSection')} className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700">
                           <svg className={`w-5 h-5 transition-transform ${collapseUsers ? 'rotate-180' : 'rotate-0'}`} viewBox="0 0 20 20" fill="currentColor"><path d="M5 7l5 5 5-5H5z"/></svg>
                         </button>
                       </div>
                       <div className="h-0.5 bg-gradient-to-r from-violet-400 to-fuchsia-400 rounded-full mb-4" />
                       {!collapseUsers && (
                         <>
                           <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                             <div className="p-4 rounded-xl ring-1 ring-gray-200/60 dark:ring-gray-700/60 bg-white/60 dark:bg-gray-800/60">
                               <h3 className="text-lg font-semibold mb-3">{t('createAdminTitle')}</h3>
                               <div className="space-y-3">
                                 <div>
                                   <label className="block text-sm mb-1">{t('nameLabelGeneric')}</label>
                                   <input value={newAdminName} onChange={e=>setNewAdminName(e.target.value)} className="w-full px-3 py-2 rounded-md bg-white/60 dark:bg-gray-800/60 ring-1 ring-gray-200/60 dark:ring-gray-700/60" />
                                 </div>
                                 <div>
                                   <label className="block text-sm mb-1">{t('usernameLabelGeneric')}</label>
                                   <input value={newAdminUsername} onChange={e=>setNewAdminUsername(e.target.value)} className="w-full px-3 py-2 rounded-md bg-white/60 dark:bg-gray-800/60 ring-1 ring-gray-200/60 dark:ring-gray-700/60" />
                                 </div>
                                 <div>
                                   <label className="block text-sm mb-1">{t('passwordLabelGeneric')}</label>
                                   <input type="password" value={newAdminPassword} onChange={e=>setNewAdminPassword(e.target.value)} className="w-full px-3 py-2 rounded-md bg-white/60 dark:bg-gray-800/60 ring-1 ring-gray-200/60 dark:ring-gray-700/60" />
                                 </div>
                                 <div>
                                   <label className="block text-sm mb-1">{t('departmentLabelGeneric')}</label>
                                   <input value={newAdminDepartment} onChange={e=>setNewAdminDepartment(e.target.value)} className="w-full px-3 py-2 rounded-md bg-white/60 dark:bg-gray-800/60 ring-1 ring-gray-200/60 dark:ring-gray-700/60" />
                                 </div>
                               </div>
                               <div className="mt-4 flex justify-end">
                                 <button onClick={async()=>{ if (!newAdminName.trim() || !newAdminUsername.trim() || !newAdminPassword.trim()) return; await createUser('admin', { name: newAdminName, username: newAdminUsername, password: newAdminPassword, department: newAdminDepartment }); setNewAdminName(''); setNewAdminUsername(''); setNewAdminPassword(''); setNewAdminDepartment(''); }} className="px-4 py-2 rounded-md bg-gradient-to-r from-emerald-600 to-teal-500 text-white hover:from-emerald-700 hover:to-teal-600">{t('createAccountAction')}</button>
                               </div>
                             </div>

                             <div className="p-4 rounded-xl ring-1 ring-gray-200/60 dark:ring-gray-700/60 bg-white/60 dark:bg-gray-800/60">
                               <h3 className="text-lg font-semibold mb-3">{t('createEmployeeTitle')}</h3>
                               <div className="space-y-3">
                                 <div>
                                   <label className="block text-sm mb-1">{t('nameLabelGeneric')}</label>
                                   <input value={newEmpName} onChange={e=>setNewEmpName(e.target.value)} className="w-full px-3 py-2 rounded-md bg-white/60 dark:bg-gray-800/60 ring-1 ring-gray-200/60 dark:ring-gray-700/60" />
                                 </div>
                                 <div>
                                   <label className="block text-sm mb-1">{t('usernameLabelGeneric')}</label>
                                   <input value={newEmpUsername} onChange={e=>setNewEmpUsername(e.target.value)} className="w-full px-3 py-2 rounded-md bg-white/60 dark:bg-gray-800/60 ring-1 ring-gray-200/60 dark:ring-gray-700/60" />
                                 </div>
                                 <div>
                                   <label className="block text-sm mb-1">{t('passwordLabelGeneric')}</label>
                                   <input type="password" value={newEmpPassword} onChange={e=>setNewEmpPassword(e.target.value)} className="w-full px-3 py-2 rounded-md bg-white/60 dark:bg-gray-800/60 ring-1 ring-gray-200/60 dark:ring-gray-700/60" />
                                 </div>
                                 <div>
                                   <label className="block text-sm mb-1">{t('departmentLabelGeneric')}</label>
                                   <input value={newEmpDepartment} onChange={e=>setNewEmpDepartment(e.target.value)} className="w-full px-3 py-2 rounded-md bg-white/60 dark:bg-gray-800/60 ring-1 ring-gray-200/60 dark:ring-gray-700/60" />
                                 </div>
                               </div>
                               <div className="mt-4 flex justify-end">
                                 <button onClick={async()=>{ if (!newEmpName.trim() || !newEmpUsername.trim() || !newEmpPassword.trim()) return; await createUser('employee', { name: newEmpName, username: newEmpUsername, password: newEmpPassword, department: newEmpDepartment }); setNewEmpName(''); setNewEmpUsername(''); setNewEmpPassword(''); setNewEmpDepartment(''); }} className="px-4 py-2 rounded-md bg-gradient-to-r from-indigo-600 to-blue-500 text-white hover:from-indigo-700 hover:to-blue-600">{t('createAccountAction')}</button>
                               </div>
                             </div>
                           </div>

                           <div className="mt-6">
                             <h3 className="text-lg font-semibold mb-3">{t('usersTableTitle')}</h3>
                             <table className="w-full text-sm">
                               <thead className="text-xs text-gray-800 dark:text-gray-100 bg-gradient-to-r from-violet-50 via-fuchsia-50 to-pink-50 dark:from-violet-900/50 dark:via-fuchsia-900/50 dark:to-pink-900/50">
                                 <tr>
                                   <th className="px-3 py-2">{t('nameCol')}</th>
                                   <th className="px-3 py-2">{t('roleColGeneric')}</th>
                                   <th className="px-3 py-2">{t('departmentColGeneric')}</th>
                                   <th className="px-3 py-2">{t('createdAtColGeneric')}</th>
                                   <th className="px-3 py-2">{t('actionsCol')}</th>
                                 </tr>
                               </thead>
                               <tbody>
                                 {users.map(u => (
                                   <tr key={u.id} className="border-b border-gray-100 dark:border-gray-700">
                                     <td className="px-3 py-2">{u.name}</td>
                                     <td className="px-3 py-2">{u.role === UserRole.ADMIN ? t('admin') : t('employee')}</td>
                                     <td className="px-3 py-2">{u.department || '—'}</td>
                                     <td className="px-3 py-2">{'—'}</td>
                                     <td className="px-3 py-2 flex gap-2">
                                       <button onClick={async()=>{ try { await api.delete(`/users/${u.id}`); setUsers(prev => prev.filter(x => x.id !== u.id)); showToast(t('userDeletedToast'), 'success'); } catch { showToast(t('userDeleteFailedToast'), 'error'); } }} className="px-3 py-1 rounded-md bg-gradient-to-r from-rose-600 to-pink-500 text-white hover:from-rose-700 hover:to-pink-600">{t('delete')}</button>
                                     </td>
                                   </tr>
                                 ))}
                               </tbody>
                             </table>
                           </div>
                         </>
                       )}
                     </div>
                      {/* Basic Attendance Settings */}
                      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur p-6 rounded-xl shadow-md ring-1 ring-gray-200/60 dark:ring-gray-700/60">
                        <div className="flex items-center justify-between mb-4">
                          <h2 className="text-2xl font-bold">{t('basicAttendanceSettings')}</h2>
                          <button onClick={()=>setCollapseAttendance(v=>!v)} aria-label={t('collapseSection')} className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700">
                            <svg className={`w-5 h-5 transition-transform ${collapseAttendance ? 'rotate-180' : 'rotate-0'}`} viewBox="0 0 20 20" fill="currentColor"><path d="M5 7l5 5 5-5H5z"/></svg>
                          </button>
                        </div>
                        <div className="h-0.5 bg-gradient-to-r from-emerald-400 to-teal-400 rounded-full mb-4" />
                        {!collapseAttendance && (
                          <>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div>
                                <label className="block text-sm mb-1">{t('workStartTime')}</label>
                                <input type="time" step={900} value={attDraft.attendanceStartTime} onChange={e=>setAttDraft(d=>({...d, attendanceStartTime:e.target.value}))} className="w-full px-3 py-2 rounded-md bg-white/60 dark:bg-gray-800/60 ring-1 ring-gray-200/60 dark:ring-gray-700/60" />
                              </div>
                              <div>
                                <label className="block text-sm mb-1">{t('latestAllowedTimeLabel')}</label>
                                <input type="time" step={900} value={attDraft.latestAllowedTime} onChange={e=>setAttDraft(d=>({...d, latestAllowedTime:e.target.value}))} className="w-full px-3 py-2 rounded-md bg-white/60 dark:bg-gray-800/60 ring-1 ring-gray-200/60 dark:ring-gray-700/60" />
                              </div>
                              <div>
                                <label className="block text-sm mb-1">{t('allowedLatenessPerMonth')}</label>
                                <input type="number" min={1} max={10} value={attDraft.allowedLatenessPerMonthBeforeReason} onChange={e=>setAttDraft(d=>({...d, allowedLatenessPerMonthBeforeReason: Number(e.target.value)}))} className="w-full px-3 py-2 rounded-md bg-white/60 dark:bg-gray-800/60 ring-1 ring-gray-200/60 dark:ring-gray-700/60" />
                              </div>
                            </div>
                            <div className="mt-4 flex justify-end">
                              <button onClick={()=>{ saveSettings(attDraft); }} className="px-4 py-2 rounded-md bg-gradient-to-r from-emerald-600 to-teal-500 text-white hover:from-emerald-700 hover:to-teal-600">{t('saveChanges')}</button>
                            </div>
                          </>
                        )}
                      </div>

                      {/* Approved Attendance Locations Management */}
                      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur p-6 rounded-xl shadow-md ring-1 ring-gray-200/60 dark:ring-gray-700/60">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <h2 className="text-2xl font-bold">{t('approvedLocationsTitle')}</h2>
                          </div>
                          <div className="flex items-center gap-2">
                            {!collapseLocations && (
                              <button onClick={()=>setShowAddLoc(v=>!v)} className="px-4 py-2 rounded-md bg-gradient-to-r from-indigo-600 to-blue-500 text-white hover:from-indigo-700 hover:to-blue-600">{showAddLoc ? t('closeForm') : t('addNewLocation')}</button>
                            )}
                            <button onClick={()=>setCollapseLocations(v=>!v)} aria-label={t('collapseSection')} className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700">
                              <svg className={`w-5 h-5 transition-transform ${collapseLocations ? 'rotate-180' : 'rotate-0'}`} viewBox="0 0 20 20" fill="currentColor"><path d="M5 7l5 5 5-5H5z"/></svg>
                            </button>
                          </div>
                        </div>
                        <div className="h-0.5 bg-gradient-to-r from-indigo-400 to-blue-400 rounded-full mb-4" />
                        {!collapseLocations && showAddLoc && (
                          <div className="p-4 rounded-lg bg-white/60 dark:bg-gray-800/60 ring-1 ring-gray-200/60 dark:ring-gray-700/60 mb-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm mb-1">{t('locationName')}</label>
                                <input value={newLoc.name} onChange={e=>setNewLoc(l=>({...l, name:e.target.value}))} placeholder={t('locationNamePlaceholder')} className="w-full px-3 py-2 rounded-md bg-white/70 dark:bg-gray-800/60 ring-1 ring-gray-200/60 dark:ring-gray-700/60" />
                                <div className="mt-4">
                                  <label className="block text-sm mb-1">{t('radiusMeters')}</label>
                                  <input type="range" min={50} max={2000} value={newLoc.radius} onChange={e=>setNewLoc(l=>({...l, radius:Number(e.target.value)}))} className="w-full" />
                                  <div className="mt-1 text-sm">{t('rangeLabel')} {newLoc.radius} {t('metersUnit')}</div>
                                </div>
                              </div>
                              <div>
                                <label className="block text-sm mb-1">{t('interactiveMap')}</label>
                                <div className="relative h-48 rounded-md bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900 dark:to-blue-800 ring-1 ring-gray-200/60 dark:ring-gray-700/60"
                                     onClick={(e)=>{
                                       const rect = (e.target as HTMLDivElement).getBoundingClientRect();
                                       const relX = (e as any).clientX - rect.left;
                                       const relY = (e as any).clientY - rect.top;
                                       // استخدام الموقع الحالي كمصدر لحسابات تقريبية: نسمح بإدخال يدوي أيضًا
                                       const lat = Number(newLoc.latitude) + ((relY - rect.height/2) / rect.height) * 0.01;
                                       const lon = Number(newLoc.longitude) + ((relX - rect.width/2) / rect.width) * 0.01;
                                       setNewLoc(l=>({ ...l, latitude: Number(lat.toFixed(6)), longitude: Number(lon.toFixed(6)) }));
                                     }}>
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="relative">
                                      <div className="w-3 h-3 rounded-full bg-red-600 shadow ring-2 ring-white/80 dark:ring-gray-900/80 cursor-pointer" title={t('dragToChangePosition')}
                                        draggable
                                        onDrag={(e)=>{
                                          const parent = (e.target as HTMLDivElement).parentElement?.parentElement as HTMLDivElement;
                                          if (!parent) return;
                                          const rect = parent.getBoundingClientRect();
                                          const relX = e.clientX - rect.left;
                                          const relY = e.clientY - rect.top;
                                          const lat = Number(newLoc.latitude) + ((relY - rect.height/2) / rect.height) * 0.01;
                                          const lon = Number(newLoc.longitude) + ((relX - rect.width/2) / rect.width) * 0.01;
                                          setNewLoc(l=>({ ...l, latitude: Number(lat.toFixed(6)), longitude: Number(lon.toFixed(6)) }));
                                        }}
                                      />
                                      <div className="absolute -inset-10 rounded-full" style={{ backgroundColor: `rgba(30, 64, 175, ${Math.min(0.9, 0.2 + newLoc.radius/2000)})` }}></div>
                                    </div>
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2 mt-2">
                                  <input type="number" step="0.000001" value={newLoc.latitude} onChange={e=>setNewLoc(l=>({...l, latitude:Number(e.target.value)}))} className="px-3 py-2 rounded-md bg-white/70 dark:bg-gray-800/60 ring-1 ring-gray-200/60 dark:ring-gray-700/60" placeholder={t('latitude')} />
                                  <input type="number" step="0.000001" value={newLoc.longitude} onChange={e=>setNewLoc(l=>({...l, longitude:Number(e.target.value)}))} className="px-3 py-2 rounded-md bg-white/70 dark:bg-gray-800/60 ring-1 ring-gray-200/60 dark:ring-gray-700/60" placeholder={t('longitude')} />
                                </div>
                                <div className="mt-2">
                                  <button type="button" onClick={()=>{
                                    navigator.geolocation.getCurrentPosition((pos)=>{
                                      setNewLoc(l=>({ ...l, latitude: Number(pos.coords.latitude.toFixed(6)), longitude: Number(pos.coords.longitude.toFixed(6)) }));
                                    }, ()=>showToast(t('geoLocationFailedToast'), 'warning'));
                                  }} className="px-3 py-2 rounded-md bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600">{t('useMyLocation')}</button>
                                </div>
                              </div>
                            </div>
                            <div className="mt-4 flex justify-end">
                              <button onClick={async()=>{
                                if (!newLoc.name.trim()) return showToast(t('enterLocationNameToast'), 'warning');
                                try {
                                  const res = await api.post('/approved-locations', { name: newLoc.name, latitude: newLoc.latitude, longitude: newLoc.longitude, radius: newLoc.radius });
                                  setLocations(prev => [...prev, { id: res.id, name: newLoc.name, latitude: newLoc.latitude, longitude: newLoc.longitude, radius: newLoc.radius }]);
                                  showToast(t('locationSavedToast'), 'success');
                                  setShowAddLoc(false);
                                  setNewLoc({ id: 0, name: '', latitude: 24.7136, longitude: 46.6753, radius: 500 });
                                } catch {
                                  showToast(t('locationSaveFailedToast'), 'error');
                                }
                              }} className="px-4 py-2 rounded-md bg-gradient-to-r from-indigo-600 to-blue-500 text-white hover:from-indigo-700 hover:to-blue-600">{t('saveLocation')}</button>
                            </div>
                          </div>
                        )}
                        {!collapseLocations && (
                        <div>
                          <table className="w-full text-sm">
                            <thead className="text-xs text-gray-800 dark:text-gray-100 bg-gradient-to-r from-indigo-50 via-blue-50 to-cyan-50 dark:from-indigo-900/50 dark:via-blue-900/50 dark:to-cyan-900/50">
                              <tr>
                                <th className="px-3 py-2">{t('nameCol')}</th>
                                <th className="px-3 py-2">{t('latitude')}</th>
                                <th className="px-3 py-2">{t('longitude')}</th>
                                <th className="px-3 py-2">{t('radiusCol')}</th>
                                <th className="px-3 py-2">{t('actionsCol')}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {locations.map(loc => (
                                <tr key={loc.id} className="border-b border-gray-100 dark:border-gray-700">
                                  {editingLocId === loc.id ? (
                                    <>
                                      <td className="px-3 py-2"><input defaultValue={loc.name} onChange={e=>loc.name = e.target.value} className="px-2 py-1 rounded-md bg-white/60 dark:bg-gray-800/60" /></td>
                                      <td className="px-3 py-2"><input type="number" step="0.000001" defaultValue={loc.latitude} onChange={e=>loc.latitude = Number(e.target.value)} className="px-2 py-1 rounded-md bg-white/60 dark:bg-gray-800/60" /></td>
                                      <td className="px-3 py-2"><input type="number" step="0.000001" defaultValue={loc.longitude} onChange={e=>loc.longitude = Number(e.target.value)} className="px-2 py-1 rounded-md bg-white/60 dark:bg-gray-800/60" /></td>
                                      <td className="px-3 py-2"><input type="number" min={50} max={2000} defaultValue={loc.radius} onChange={e=>loc.radius = Number(e.target.value)} className="px-2 py-1 rounded-md bg-white/60 dark:bg-gray-800/60" /></td>
                                      <td className="px-3 py-2 flex gap-2">
                                        <button onClick={async()=>{
                                          try {
                                            await api.put(`/approved-locations/${loc.id}`, { name: loc.name, latitude: loc.latitude, longitude: loc.longitude, radius: loc.radius });
                                            setLocations(prev => prev.map(l => l.id === loc.id ? { ...loc } : l));
                                            showToast(t('locationUpdatedToast'), 'success');
                                            setEditingLocId(null);
                                          } catch { showToast(t('updateFailedToast'), 'error'); }
                                        }} className="px-3 py-1 rounded-md bg-gradient-to-r from-green-600 to-emerald-500 text-white hover:from-green-700 hover:to-emerald-600">{t('save')}</button>
                                        <button onClick={()=>setEditingLocId(null)} className="px-3 py-1 rounded-md bg-gray-300 dark:bg-gray-700">{t('cancel')}</button>
                                      </td>
                                    </>
                                  ) : (
                                    <>
                                      <td className="px-3 py-2">{loc.name}</td>
                                      <td className="px-3 py-2">{loc.latitude}</td>
                                      <td className="px-3 py-2">{loc.longitude}</td>
                                      <td className="px-3 py-2">{loc.radius}</td>
                                      <td className="px-3 py-2 flex gap-2">
                                        <button onClick={()=>setEditingLocId(loc.id)} className="px-3 py-1 rounded-md bg-gradient-to-r from-indigo-600 to-blue-500 text-white hover:from-indigo-700 hover:to-blue-600">{t('edit')}</button>
                                        <button onClick={async()=>{
                                          try {
                                            await api.delete(`/approved-locations/${loc.id}`);
                                            setLocations(prev => prev.filter(l => l.id !== loc.id));
                                            showToast(t('locationDeletedToast'), 'success');
                                          } catch { showToast(t('deleteFailedToast'), 'error'); }
                                        }} className="px-3 py-1 rounded-md bg-gradient-to-r from-rose-600 to-pink-500 text-white hover:from-rose-700 hover:to-pink-600">{t('delete')}</button>
                                      </td>
                                    </>
                                  )}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        )}
                      </div>

                      {/* Notification Settings */}
                      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur p-6 rounded-xl shadow-md ring-1 ring-gray-200/60 dark:ring-gray-700/60">
                        <div className="flex items-center justify-between mb-4">
                          <h2 className="text-2xl font-bold">{t('notificationsSettingsTitle')}</h2>
                          <button onClick={()=>setCollapseNotifications(v=>!v)} aria-label={t('collapseSection')} className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700">
                            <svg className={`w-5 h-5 transition-transform ${collapseNotifications ? 'rotate-180' : 'rotate-0'}`} viewBox="0 0 20 20" fill="currentColor"><path d="M5 7l5 5 5-5H5z"/></svg>
                          </button>
                        </div>
                        <div className="h-0.5 bg-gradient-to-r from-rose-400 to-amber-400 rounded-full mb-4" />
                        {!collapseNotifications && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={notifDraft.morningReminderEnabled} onChange={e=>setNotifDraft(d=>({...d, morningReminderEnabled:e.target.checked}))} /><span>{t('morningReminder')}</span></label>
                            <input type="time" step={900} value={notifDraft.morningReminderTime} onChange={e=>setNotifDraft(d=>({...d, morningReminderTime:e.target.value}))} className="w-full px-3 py-2 rounded-md bg-white/60 dark:bg-gray-800/60 ring-1 ring-gray-200/60 dark:ring-gray-700/60" />
                          </div>
                          <div className="space-y-2">
                            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={notifDraft.instantLateNotificationEnabled} onChange={e=>setNotifDraft(d=>({...d, instantLateNotificationEnabled:e.target.checked}))} /><span>{t('instantLateNotification')}</span></label>
                            <input value={notifDraft.instantLateMessageTemplate} onChange={e=>setNotifDraft(d=>({...d, instantLateMessageTemplate:e.target.value}))} className="w-full px-3 py-2 rounded-md bg-white/60 dark:bg-gray-800/60 ring-1 ring-gray-200/60 dark:ring-gray-700/60" placeholder={t('instantLatePlaceholder')} />
                          </div>
                          <div className="space-y-2">
                            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={notifDraft.autoRequestReasonEnabled} onChange={e=>setNotifDraft(d=>({...d, autoRequestReasonEnabled:e.target.checked}))} /><span>{t('autoRequestReason')}</span></label>
                            <input value={notifDraft.autoRequestMessageTemplate} onChange={e=>setNotifDraft(d=>({...d, autoRequestMessageTemplate:e.target.value}))} className="w-full px-3 py-2 rounded-md bg-white/60 dark:bg-gray-800/60 ring-1 ring-gray-200/60 dark:ring-gray-700/60" placeholder={t('autoRequestPlaceholder')} />
                          </div>
                        </div>
                        )}
                        {!collapseNotifications && (
                          <div className="mt-4 flex justify-end">
                            <button onClick={()=>saveSettings(notifDraft)} className="px-4 py-2 rounded-md bg-gradient-to-r from-emerald-600 to-teal-500 text-white hover:from-emerald-700 hover:to-teal-600">{t('saveChanges')}</button>
                          </div>
                        )}
                      </div>

                      {/* Monthly Report Settings */}
                      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur p-6 rounded-xl shadow-md ring-1 ring-gray-200/60 dark:ring-gray-700/60">
                        <div className="flex items-center justify-between mb-4">
                          <h2 className="text-2xl font-bold">{t('monthlyReportSettingsTitle')}</h2>
                          <button onClick={()=>setCollapseReports(v=>!v)} aria-label={t('collapseSection')} className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700">
                            <svg className={`w-5 h-5 transition-transform ${collapseReports ? 'rotate-180' : 'rotate-0'}`} viewBox="0 0 20 20" fill="currentColor"><path d="M5 7l5 5 5-5H5z"/></svg>
                          </button>
                        </div>
                        <div className="h-0.5 bg-gradient-to-r from-blue-400 to-indigo-400 rounded-full mb-4" />
                        {!collapseReports && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm mb-1">{t('autoGenDate')}</label>
                            <select value={reportDraft.autoReportDay} onChange={e=>setReportDraft(d=>({...d, autoReportDay:Number(e.target.value)}))} className="w-full px-3 py-2 rounded-md bg-white/60 dark:bg-gray-800/60 ring-1 ring-gray-200/60 dark:ring-gray-700/60">
                              {Array.from({length:28}, (_,i)=>i+1).map(n=> <option key={n} value={n}>{n}</option>)}
                            </select>
                          </div>
                          <div className="space-y-2">
                            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={reportDraft.reportIncludeLateList} onChange={e=>setReportDraft(d=>({...d, reportIncludeLateList:e.target.checked}))} /><span>{t('includeLateList')}</span></label>
                            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={reportDraft.reportIncludeTotalLateHours} onChange={e=>setReportDraft(d=>({...d, reportIncludeTotalLateHours:e.target.checked}))} /><span>{t('includeTotalLateHours')}</span></label>
                            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={reportDraft.reportIncludeUnexcusedAbsences} onChange={e=>setReportDraft(d=>({...d, reportIncludeUnexcusedAbsences:e.target.checked}))} /><span>{t('includeUnexcusedAbsences')}</span></label>
                            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={reportDraft.reportIncludeLeaveAndExcuseSummary} onChange={e=>setReportDraft(d=>({...d, reportIncludeLeaveAndExcuseSummary:e.target.checked}))} /><span>{t('includeLeaveExcuseSummary')}</span></label>
                            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={reportDraft.reportIncludeDepartmentComparison} onChange={e=>setReportDraft(d=>({...d, reportIncludeDepartmentComparison:e.target.checked}))} /><span>{t('includeDeptComparison')}</span></label>
                          </div>
                          <div className="space-y-2">
                            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={reportDraft.exportPdf} onChange={e=>setReportDraft(d=>({...d, exportPdf:e.target.checked}))} /><span>{t('exportPdfDefault')}</span></label>
                            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={reportDraft.exportExcel} onChange={e=>setReportDraft(d=>({...d, exportExcel:e.target.checked}))} /><span>{t('enableExcelExport')}</span></label>
                          </div>
                        </div>
                        )}
                        {!collapseReports && (
                          <div className="mt-4 flex justify-end">
                            <button onClick={()=>saveSettings(reportDraft)} className="px-4 py-2 rounded-md bg-gradient-to-r from-emerald-600 to-teal-500 text-white hover:from-emerald-700 hover:to-teal-600">{t('saveChanges')}</button>
                          </div>
                        )}
                      </div>

                      {/* Fingerprint System Integration */}
                      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur p-6 rounded-xl shadow-md ring-1 ring-gray-200/60 dark:ring-gray-700/60">
                        <div className="flex items-center justify-between mb-4">
                          <h2 className="text-2xl font-bold">{t('fingerprintIntegrationTitle')}</h2>
                          <button onClick={()=>setCollapseFingerprint(v=>!v)} aria-label={t('collapseSection')} className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700">
                            <svg className={`w-5 h-5 transition-transform ${collapseFingerprint ? 'rotate-180' : 'rotate-0'}`} viewBox="0 0 20 20" fill="currentColor"><path d="M5 7l5 5 5-5H5z"/></svg>
                          </button>
                        </div>
                        <div className="h-0.5 bg-gradient-to-r from-teal-400 to-cyan-400 rounded-full mb-4" />
                        {!collapseFingerprint && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm mb-1">{t('fingerprintApiUrlLabel')}</label>
                            <input value={fpDraft.fingerprintApiUrl} onChange={e=>setFpDraft(d=>({...d, fingerprintApiUrl:e.target.value}))} className="w-full px-3 py-2 rounded-md bg-white/60 dark:bg-gray-800/60 ring-1 ring-gray-200/60 dark:ring-gray-700/60" placeholder={t('fingerprintApiUrlPlaceholder')} />
                          </div>
                          <div>
                            <label className="block text-sm mb-1">{t('fingerprintUsernameLabel')}</label>
                            <input value={fpDraft.username} onChange={e=>setFpDraft(d=>({...d, username:e.target.value}))} className="w-full px-3 py-2 rounded-md bg-white/60 dark:bg-gray-800/60 ring-1 ring-gray-200/60 dark:ring-gray-700/60" placeholder={t('fingerprintUsernamePlaceholder')} />
                          </div>
                          <div>
                            <label className="block text-sm mb-1">{t('fingerprintPasswordLabel')}</label>
                            <input type="password" value={fpDraft.password} onChange={e=>setFpDraft(d=>({...d, password:e.target.value}))} className="w-full px-3 py-2 rounded-md bg-white/60 dark:bg-gray-800/60 ring-1 ring-gray-200/60 dark:ring-gray-700/60" placeholder={t('fingerprintPasswordPlaceholder')} />
                          </div>
                        </div>
                        )}
                        {!collapseFingerprint && (
                          <div className="mt-4 flex items-center gap-2">
                            <button onClick={async()=>{
                              try {
                                const r = await api.post('/test-fingerprint', { url: fpDraft.fingerprintApiUrl, username: fpDraft.username, password: fpDraft.password, authMode: 'basic' });
                                if (r.ok) showToast(t('connectionOk'), 'success'); else showToast(`${t('connectionFailed')} (${r.status})`, 'error');
                              } catch { showToast(t('connectionTestFailed'), 'error'); }
                            }} className="px-4 py-2 rounded-md bg-gradient-to-r from-indigo-600 to-blue-500 text-white hover:from-indigo-700 hover:to-blue-600">{t('testConnection')}</button>
                            <button onClick={()=>saveSettings({ fingerprintApiUrl: fpDraft.fingerprintApiUrl })} className="px-4 py-2 rounded-md bg-gradient-to-r from-emerald-600 to-teal-500 text-white hover:from-emerald-700 hover:to-teal-600">{t('saveUrlOnly')}</button>
                          </div>
                        )}
                        {!collapseFingerprint && (
                          <p className="mt-2 text-xs text-gray-500">{t('fingerprintWarning')}</p>
                        )}
                      </div>

                      
                    </div>
                )}
                </div>
            </main>
        </div>
    );
};

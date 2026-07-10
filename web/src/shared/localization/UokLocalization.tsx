import { createContext, useContext, type ReactNode } from "react";

import type { UokLocale } from "../types";

type UokDirection = "ltr" | "rtl";
type Translate = (key: string, fallback?: string) => string;

const messages: Record<UokLocale, Record<string, string>> = {
  "en-US": {
    "nav.primary": "Primary navigation", "nav.overview": "Overview", "nav.apps": "Apps", "nav.contacts": "Contacts",
    "nav.calendar": "Calendar", "nav.communications": "K Connect", "nav.planning": "Planning", "nav.evidence": "Evidence", "nav.architecture": "Architecture",
    "nav.home": "Home", "nav.expand": "Expand sidebar", "nav.collapse": "Collapse sidebar",
    "account.controls": "Signed in user controls", "account.menu": "Account menu", "account.appearance": "Appearance", "account.language": "Language",
    "account.refresh": "Refresh", "account.logout": "Logout", "account.cancel": "Cancel", "account.endSession": "End this session and return to the login screen?",
    "account.open": "Open account menu for", "account.close": "Close account menu for",
    "planning.gantt": "Planning Gantt chart", "planning.grid": "Planning task grid", "planning.timeline": "Planning timeline",
    "planning.column.wbs": "WBS", "planning.column.task": "Task", "planning.column.start": "Start", "planning.column.end": "End",
    "planning.column.duration": "Dur.", "planning.column.progress": "%", "planning.column.critical": "Critical", "planning.column.assigned": "Assigned", "planning.column.status": "Status",
  },
  ar: {
    "nav.primary": "التنقل الرئيسي", "nav.overview": "نظرة عامة", "nav.apps": "التطبيقات", "nav.contacts": "جهات الاتصال",
    "nav.calendar": "التقويم", "nav.communications": "كي كونكت", "nav.planning": "التخطيط", "nav.evidence": "الأدلة", "nav.architecture": "البنية",
    "nav.home": "الرئيسية", "nav.expand": "توسيع الشريط الجانبي", "nav.collapse": "طي الشريط الجانبي",
    "account.controls": "عناصر تحكم المستخدم", "account.menu": "قائمة الحساب", "account.appearance": "المظهر", "account.language": "اللغة",
    "account.refresh": "تحديث", "account.logout": "تسجيل الخروج", "account.cancel": "إلغاء", "account.endSession": "إنهاء هذه الجلسة والعودة إلى شاشة تسجيل الدخول؟",
    "account.open": "فتح قائمة الحساب لـ", "account.close": "إغلاق قائمة الحساب لـ",
    "planning.gantt": "مخطط جانت للتخطيط", "planning.grid": "شبكة مهام التخطيط", "planning.timeline": "الخط الزمني للتخطيط",
    "planning.column.wbs": "هيكل العمل", "planning.column.task": "المهمة", "planning.column.start": "البدء", "planning.column.end": "الانتهاء",
    "planning.column.duration": "المدة", "planning.column.progress": "٪", "planning.column.critical": "حرجة", "planning.column.assigned": "المسند", "planning.column.status": "الحالة",
  },
};

export const uokLocaleOptions: Array<{ id: UokLocale; label: string; direction: UokDirection }> = [
  { id: "en-US", label: "English", direction: "ltr" },
  { id: "ar", label: "العربية", direction: "rtl" },
];

export function uokLocaleDirection(locale: UokLocale): UokDirection {
  return uokLocaleOptions.find((option) => option.id === locale)?.direction || "ltr";
}

function localizationValue(locale: UokLocale) {
  const t: Translate = (key, fallback) => messages[locale][key] || messages["en-US"][key] || fallback || key;
  const formatLocale = locale === "ar" ? "ar-u-nu-arab" : locale;
  return {
    locale,
    direction: uokLocaleDirection(locale),
    t,
    formatDate: (value: Date | string) => new Intl.DateTimeFormat(formatLocale, { dateStyle: "medium" }).format(value instanceof Date ? value : new Date(value)),
    formatNumber: (value: number) => new Intl.NumberFormat(formatLocale).format(value),
  };
}

type UokLocalizationValue = ReturnType<typeof localizationValue>;
const UokLocalizationContext = createContext<UokLocalizationValue>(localizationValue("en-US"));

export function UokLocalizationProvider({ children, locale }: { children: ReactNode; locale: UokLocale }) {
  return <UokLocalizationContext.Provider value={localizationValue(locale)}>{children}</UokLocalizationContext.Provider>;
}

export function useUokLocalization() {
  return useContext(UokLocalizationContext);
}

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
    "command.query": "query", "command.context": "context", "command.actions": "actions", "command.searchOptions": "Search options",
    "command.filters": "Filters", "command.sort": "Sort", "command.sectionBy": "Section by", "command.savedSearches": "Saved searches",
    "command.searchName": "Search name", "command.savedSearchName": "Saved search name", "command.nameThisSearch": "Name this search", "command.saveSearch": "Save search", "command.apply": "Apply",
    "command.delete": "Delete", "command.close": "Close", "command.moveDialog": "Move", "command.moveDialogHint": "Drag to move. Use Arrow keys to move, Shift plus Arrow for a larger step, and Home or double-click to return to the opening position.", "command.workspaceEditor": "Workspace editor", "command.noSavedSearches": "No saved searches yet.", "command.clearAll": "Clear all", "command.done": "Done",
    "command.order": "Order", "command.sortAscending": "Sort ascending", "command.sortDescending": "Sort descending",
    "command.ascendingTitle": "Ascending. Click for descending.", "command.descendingTitle": "Descending. Click for ascending.",
    "command.refinementSearch": "Search", "command.refinementSort": "Sort", "command.refinementSection": "Section", "command.refinements": "refinements", "command.activeRefinements": "Active search refinements", "command.filterSuffix": "filter", "command.ascending": "ascending", "command.descending": "descending",
    "pagination.pageSize": "Page size", "pagination.rows": "Rows", "pagination.previous": "Previous", "pagination.next": "Next", "pagination.noRecords": "No records",
    "pagination.showingRecords": "Showing records", "pagination.through": "through", "pagination.of": "of",
    "contacts.paging": "Contact paging", "contacts.pageSize": "Contacts page size", "contacts.noRecords": "No contact records",
    "planning.gantt": "Planning Gantt chart", "planning.grid": "Planning task grid", "planning.timeline": "Planning timeline",
    "planning.column.wbs": "WBS", "planning.column.task": "Task", "planning.column.start": "Start", "planning.column.end": "End",
    "planning.column.duration": "Dur.", "planning.column.progress": "%", "planning.column.critical": "Critical", "planning.column.assigned": "Assigned", "planning.column.status": "Status",
    "planning.scope": "Planning scope", "planning.projectSchedule": "Project schedule", "planning.portfolio": "Portfolio", "planning.portfolio.eyebrow": "Planning", "planning.portfolio.summary": "Monitor delivery, risk, gates, and schedule windows across projects.",
    "planning.portfolio.search": "Search projects", "planning.portfolio.status": "Project status", "planning.portfolio.allStatuses": "All statuses", "planning.portfolio.draft": "Draft", "planning.portfolio.active": "Active",
    "planning.portfolio.commands": "Portfolio commands", "planning.portfolio.paging": "Portfolio paging", "planning.portfolio.pageSize": "Portfolio page size", "planning.portfolio.noProjects": "No projects", "planning.portfolio.showingProjects": "Showing projects",
    "planning.portfolio.onHold": "On hold", "planning.portfolio.complete": "Complete", "planning.portfolio.completed": "Completed", "planning.portfolio.archived": "Archived", "planning.portfolio.apply": "Apply filters", "planning.portfolio.projects": "Projects",
    "planning.portfolio.tasks": "Tasks", "planning.portfolio.atRisk": "At risk", "planning.portfolio.overdue": "Overdue tasks", "planning.portfolio.gates": "Gate blockers",
    "planning.portfolio.project": "Project", "planning.portfolio.health": "Health", "planning.portfolio.issues": "Issues", "planning.portfolio.open": "Open project",
    "planning.portfolio.onTrack": "On track", "planning.portfolio.attention": "Attention", "planning.portfolio.blocked": "Blocked", "planning.portfolio.empty": "No projects match these filters.",
    "planning.portfolio.loading": "Loading portfolio", "planning.portfolio.metrics": "Portfolio metrics", "planning.portfolio.diagnostics": "Bounded aggregate", "planning.portfolio.queries": "queries",
    "planning.portfolio.pageMetrics": "Current portfolio page metrics",
    "planning.portfolio.table": "Multi-project delivery portfolio", "planning.portfolio.actions": "Actions", "planning.portfolio.error": "Portfolio could not be loaded.",
    "planning.portfolio.compatibilityHorizon": "Compatibility horizon", "planning.portfolio.targetFinish": "Target finish", "planning.portfolio.calculatedFinish": "Calculated finish", "planning.portfolio.latestTaskFinish": "Latest task finish", "planning.portfolio.scheduleHorizon": "Schedule horizon",
    "planning.gantt.projectStart": "Project start", "planning.gantt.compatibilityHorizon": "Compatibility horizon", "planning.gantt.targetFinish": "Target finish", "planning.gantt.calculatedFinish": "Calculated finish",
    "planning.review.archived": "Archived project is read-only; restore it to active before editing.", "planning.review.permissions": "Server permissions allow review only; write controls are disabled.",
    "planning.projectCreate.action": "New project", "planning.projectCreate.dialogLabel": "New project", "planning.projectCreate.title": "Create project",
    "planning.projectCreate.description": "Start with the project commitment. Tasks and dependencies can be added after the validated schedule opens.",
    "planning.projectCreate.formLabel": "New project form", "planning.projectCreate.hint": "Target finish is the committed date; Planning calculates schedule finish separately.",
    "planning.projectCreate.name": "Project name", "planning.projectCreate.start": "Start date", "planning.projectCreate.finish": "Target finish", "planning.projectCreate.timezone": "Time zone",
    "planning.projectCreate.timezoneHint": "Use an IANA time zone such as UTC or Asia/Kolkata.", "planning.projectCreate.create": "Create project", "planning.projectCreate.cancel": "Cancel",
    "planning.projectCreate.error.name": "Enter a project name with at least 2 characters.", "planning.projectCreate.error.start": "Choose a project start date.",
    "planning.projectCreate.error.finishRequired": "Choose a target finish date.", "planning.projectCreate.error.finishOrder": "Target finish must be on or after the start date.",
    "planning.projectCreate.error.timezone": "Enter the project time zone.", "planning.projectCreate.error.generic": "Project could not be created.",
    "planning.projectCreate.reloadFailed.label": "Created project needs loading", "planning.projectCreate.reloadFailed.title": "Project created", "planning.projectCreate.reloadFailed.named": "was created.",
    "planning.projectCreate.reloadFailed.description": "The project was saved successfully, but Planning could not load its schedule. Retry loading it instead of creating it again.", "planning.projectCreate.reloadFailed.retry": "Retry loading",
    "planning.noProject.summary": "Create a project to begin a validated schedule, or load the optional sample plan.", "planning.noProject.title": "No projects",
    "planning.noProject.empty": "Create a project to open its validated Gantt schedule. The sample plan remains optional.", "planning.noProject.sampleAction": "New sample plan",
  },
  ar: {
    "nav.primary": "التنقل الرئيسي", "nav.overview": "نظرة عامة", "nav.apps": "التطبيقات", "nav.contacts": "جهات الاتصال",
    "nav.calendar": "التقويم", "nav.communications": "كي كونكت", "nav.planning": "التخطيط", "nav.evidence": "الأدلة", "nav.architecture": "البنية",
    "nav.home": "الرئيسية", "nav.expand": "توسيع الشريط الجانبي", "nav.collapse": "طي الشريط الجانبي",
    "account.controls": "عناصر تحكم المستخدم", "account.menu": "قائمة الحساب", "account.appearance": "المظهر", "account.language": "اللغة",
    "account.refresh": "تحديث", "account.logout": "تسجيل الخروج", "account.cancel": "إلغاء", "account.endSession": "إنهاء هذه الجلسة والعودة إلى شاشة تسجيل الدخول؟",
    "account.open": "فتح قائمة الحساب لـ", "account.close": "إغلاق قائمة الحساب لـ",
    "command.query": "البحث", "command.context": "السياق", "command.actions": "الإجراءات", "command.searchOptions": "خيارات البحث",
    "command.filters": "عوامل التصفية", "command.sort": "الترتيب", "command.sectionBy": "التقسيم حسب", "command.savedSearches": "عمليات البحث المحفوظة",
    "command.searchName": "اسم البحث", "command.savedSearchName": "اسم البحث المحفوظ", "command.nameThisSearch": "سم هذا البحث", "command.saveSearch": "حفظ البحث", "command.apply": "تطبيق",
    "command.delete": "حذف", "command.close": "إغلاق", "command.moveDialog": "نقل", "command.moveDialogHint": "اسحب للتحريك. استخدم مفاتيح الأسهم للتحريك، وShift مع سهم لخطوة أكبر، وHome أو النقر المزدوج للعودة إلى موضع الفتح.", "command.workspaceEditor": "محرر مساحة العمل", "command.noSavedSearches": "لا توجد عمليات بحث محفوظة بعد.", "command.clearAll": "مسح الكل", "command.done": "تم",
    "command.order": "الاتجاه", "command.sortAscending": "ترتيب تصاعدي", "command.sortDescending": "ترتيب تنازلي",
    "command.ascendingTitle": "تصاعدي. انقر للترتيب التنازلي.", "command.descendingTitle": "تنازلي. انقر للترتيب التصاعدي.",
    "command.refinementSearch": "بحث", "command.refinementSort": "ترتيب", "command.refinementSection": "تقسيم", "command.refinements": "تحسينات", "command.activeRefinements": "تحسينات البحث النشطة", "command.filterSuffix": "عامل تصفية", "command.ascending": "تصاعدي", "command.descending": "تنازلي",
    "pagination.pageSize": "حجم الصفحة", "pagination.rows": "الصفوف", "pagination.previous": "السابق", "pagination.next": "التالي", "pagination.noRecords": "لا توجد سجلات",
    "pagination.showingRecords": "عرض السجلات", "pagination.through": "إلى", "pagination.of": "من",
    "contacts.paging": "ترقيم صفحات جهات الاتصال", "contacts.pageSize": "حجم صفحة جهات الاتصال", "contacts.noRecords": "لا توجد سجلات جهات اتصال",
    "planning.gantt": "مخطط جانت للتخطيط", "planning.grid": "شبكة مهام التخطيط", "planning.timeline": "الخط الزمني للتخطيط",
    "planning.column.wbs": "هيكل العمل", "planning.column.task": "المهمة", "planning.column.start": "البدء", "planning.column.end": "الانتهاء",
    "planning.column.duration": "المدة", "planning.column.progress": "٪", "planning.column.critical": "حرجة", "planning.column.assigned": "المسند", "planning.column.status": "الحالة",
    "planning.scope": "نطاق التخطيط", "planning.projectSchedule": "جدول المشروع", "planning.portfolio": "المحفظة", "planning.portfolio.eyebrow": "التخطيط", "planning.portfolio.summary": "مراقبة التسليم والمخاطر والبوابات والجداول الزمنية عبر المشاريع.",
    "planning.portfolio.search": "البحث في المشاريع", "planning.portfolio.status": "حالة المشروع", "planning.portfolio.allStatuses": "كل الحالات", "planning.portfolio.draft": "مسودة", "planning.portfolio.active": "نشط",
    "planning.portfolio.commands": "أوامر المحفظة", "planning.portfolio.paging": "ترقيم صفحات المحفظة", "planning.portfolio.pageSize": "حجم صفحة المحفظة", "planning.portfolio.noProjects": "لا توجد مشاريع", "planning.portfolio.showingProjects": "عرض المشاريع",
    "planning.portfolio.onHold": "معلّق", "planning.portfolio.complete": "مكتمل", "planning.portfolio.completed": "مكتمل", "planning.portfolio.archived": "مؤرشف", "planning.portfolio.apply": "تطبيق عوامل التصفية", "planning.portfolio.projects": "المشاريع",
    "planning.portfolio.tasks": "المهام", "planning.portfolio.atRisk": "معرض للخطر", "planning.portfolio.overdue": "المهام المتأخرة", "planning.portfolio.gates": "عوائق البوابات",
    "planning.portfolio.project": "المشروع", "planning.portfolio.health": "الصحة", "planning.portfolio.issues": "المشكلات", "planning.portfolio.open": "فتح المشروع",
    "planning.portfolio.onTrack": "على المسار", "planning.portfolio.attention": "يحتاج انتباها", "planning.portfolio.blocked": "محظور", "planning.portfolio.empty": "لا توجد مشاريع مطابقة.",
    "planning.portfolio.loading": "جارٍ تحميل المحفظة", "planning.portfolio.metrics": "مقاييس المحفظة", "planning.portfolio.diagnostics": "تجميع محدود", "planning.portfolio.queries": "استعلامات",
    "planning.portfolio.pageMetrics": "مقاييس صفحة المحفظة الحالية",
    "planning.portfolio.table": "محفظة تسليم متعددة المشاريع", "planning.portfolio.actions": "الإجراءات", "planning.portfolio.error": "تعذر تحميل المحفظة.",
    "planning.portfolio.compatibilityHorizon": "أفق التوافق", "planning.portfolio.targetFinish": "الانتهاء المستهدف", "planning.portfolio.calculatedFinish": "الانتهاء المحسوب", "planning.portfolio.latestTaskFinish": "آخر انتهاء للمهام", "planning.portfolio.scheduleHorizon": "أفق الجدول",
    "planning.gantt.projectStart": "بدء المشروع", "planning.gantt.compatibilityHorizon": "أفق التوافق", "planning.gantt.targetFinish": "الانتهاء المستهدف", "planning.gantt.calculatedFinish": "الانتهاء المحسوب",
    "planning.review.archived": "المشروع المؤرشف للقراءة فقط؛ أعده إلى الحالة النشطة قبل التحرير.", "planning.review.permissions": "تسمح أذونات الخادم بالمراجعة فقط؛ تم تعطيل عناصر التحكم في الكتابة.",
    "planning.projectCreate.action": "مشروع جديد", "planning.projectCreate.dialogLabel": "مشروع جديد", "planning.projectCreate.title": "إنشاء مشروع",
    "planning.projectCreate.description": "ابدأ بالتزام المشروع. يمكن إضافة المهام والتبعيات بعد فتح الجدول المتحقق منه.",
    "planning.projectCreate.formLabel": "نموذج مشروع جديد", "planning.projectCreate.hint": "الانتهاء المستهدف هو التاريخ الملتزم به؛ يحسب التخطيط انتهاء الجدول بشكل منفصل.",
    "planning.projectCreate.name": "اسم المشروع", "planning.projectCreate.start": "تاريخ البدء", "planning.projectCreate.finish": "الانتهاء المستهدف", "planning.projectCreate.timezone": "المنطقة الزمنية",
    "planning.projectCreate.timezoneHint": "استخدم منطقة زمنية من قاعدة IANA مثل UTC أو Asia/Kolkata.", "planning.projectCreate.create": "إنشاء مشروع", "planning.projectCreate.cancel": "إلغاء",
    "planning.projectCreate.error.name": "أدخل اسم مشروع مكونا من حرفين على الأقل.", "planning.projectCreate.error.start": "اختر تاريخ بدء المشروع.",
    "planning.projectCreate.error.finishRequired": "اختر تاريخ الانتهاء المستهدف.", "planning.projectCreate.error.finishOrder": "يجب أن يكون الانتهاء المستهدف في تاريخ البدء أو بعده.",
    "planning.projectCreate.error.timezone": "أدخل المنطقة الزمنية للمشروع.", "planning.projectCreate.error.generic": "تعذر إنشاء المشروع.",
    "planning.projectCreate.reloadFailed.label": "المشروع المنشأ يحتاج إلى تحميل", "planning.projectCreate.reloadFailed.title": "تم إنشاء المشروع", "planning.projectCreate.reloadFailed.named": "تم إنشاؤه.",
    "planning.projectCreate.reloadFailed.description": "تم حفظ المشروع بنجاح، لكن تعذر على التخطيط تحميل جدوله. أعد محاولة تحميله بدلا من إنشائه مرة أخرى.", "planning.projectCreate.reloadFailed.retry": "إعادة محاولة التحميل",
    "planning.noProject.summary": "أنشئ مشروعا لبدء جدول متحقق منه، أو حمّل الخطة النموذجية الاختيارية.", "planning.noProject.title": "لا توجد مشاريع",
    "planning.noProject.empty": "أنشئ مشروعا لفتح جدول جانت المتحقق منه. تبقى الخطة النموذجية اختيارية.", "planning.noProject.sampleAction": "خطة نموذجية جديدة",
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
    formatDate: (value: Date | string) => new Intl.DateTimeFormat(formatLocale, { dateStyle: "medium" }).format(localizedDate(value)),
    formatNumber: (value: number) => new Intl.NumberFormat(formatLocale).format(value),
  };
}

function localizedDate(value: Date | string) {
  if (value instanceof Date) return value;
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!dateOnly) return new Date(value);
  return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]), 12);
}

type UokLocalizationValue = ReturnType<typeof localizationValue>;
const UokLocalizationContext = createContext<UokLocalizationValue>(localizationValue("en-US"));

export function UokLocalizationProvider({ children, locale }: { children: ReactNode; locale: UokLocale }) {
  return <UokLocalizationContext.Provider value={localizationValue(locale)}>{children}</UokLocalizationContext.Provider>;
}

export function useUokLocalization() {
  return useContext(UokLocalizationContext);
}

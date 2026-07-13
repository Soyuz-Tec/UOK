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
    "command.open": "Open", "command.close": "Close", "command.create": "Create", "command.delete": "Delete", "command.edit": "Edit", "command.save": "Save", "command.cancel": "Cancel", "command.search": "Search", "command.export": "Export", "command.print": "Print", "command.refresh": "Refresh", "command.working": "Working", "command.more": "More", "command.moreActions": "More actions", "command.view": "View",
    "command.newEvent": "New event", "command.exportIcs": "Export ICS", "command.newThread": "New thread", "command.createThread": "Create thread", "command.newContact": "New contact", "command.newTask": "New task", "command.saveTask": "Save task", "command.addTask": "Add task", "command.exportCsv": "Export CSV", "command.importTemplate": "Template", "command.projectJson": "Project JSON", "command.timelineSvg": "Timeline SVG", "command.document": "Document",
    "command.moveDialog": "Move", "command.moveDialogHint": "Drag to move. Use Arrow keys to move, Shift plus Arrow for a larger step, and Home or double-click to return to the opening position.", "command.workspaceEditor": "Workspace editor", "command.noSavedSearches": "No saved searches yet.", "command.clearAll": "Clear all", "command.done": "Done",
    "command.order": "Order", "command.sortAscending": "Sort ascending", "command.sortDescending": "Sort descending",
    "command.ascendingTitle": "Ascending. Click for descending.", "command.descendingTitle": "Descending. Click for ascending.",
    "command.refinementSearch": "Search", "command.refinementSort": "Sort", "command.refinementSection": "Section", "command.refinements": "refinements", "command.activeRefinements": "Active search refinements", "command.filterSuffix": "filter", "command.ascending": "ascending", "command.descending": "descending",
    "pagination.pageSize": "Page size", "pagination.rows": "Rows", "pagination.previous": "Previous", "pagination.next": "Next", "pagination.noRecords": "No records",
    "pagination.showingRecords": "Showing records", "pagination.through": "through", "pagination.of": "of",
    "contacts.paging": "Contact paging", "contacts.pageSize": "Contacts page size", "contacts.noRecords": "No contact records",
    "planning.gantt": "Planning Gantt chart", "planning.grid": "Planning task grid", "planning.timeline": "Planning timeline",
    "planning.view.label": "Planning view", "planning.view.ganttChart": "Gantt chart", "planning.view.board": "Board", "planning.view.list": "List", "planning.view.calendar": "Calendar", "planning.view.workload": "Workload", "planning.view.people": "People", "planning.view.dashboard": "Dashboard",
    "planning.fieldPreset.logic": "Logic",
    "planning.split.label": "Resize task grid and timeline", "planning.split.hint": "Drag to resize. Use arrow keys, Home, or End. Double-click to reset.", "planning.split.value": "{grid}% task grid, {timeline}% timeline",
    "planning.column.wbs": "WBS", "planning.column.task": "Task", "planning.column.start": "Start", "planning.column.end": "End",
    "planning.column.duration": "Dur.", "planning.column.progress": "%", "planning.column.critical": "Critical", "planning.column.assigned": "Assigned", "planning.column.status": "Status",
    "planning.column.owner": "Owner", "planning.column.predecessors": "Predecessors", "planning.column.successors": "Successors", "planning.column.totalFloat": "Total float", "planning.column.readiness": "Readiness",
    "planning.owner.unavailable": "Owner unavailable", "planning.owner.state.unavailable": "unavailable", "planning.owner.restricted": "Restricted owner", "planning.owner.missing": "Missing owner",
    "planning.readiness.notAssessed": "Not assessed", "planning.readiness.ready": "Ready", "planning.readiness.noGates": "No gates", "planning.readiness.blocked": "Blocked ({count})", "planning.duration.dayShort": "d",
    "planning.dependency.type.finish_to_start": "Finish to start", "planning.dependency.type.start_to_start": "Start to start", "planning.dependency.type.finish_to_finish": "Finish to finish", "planning.dependency.type.start_to_finish": "Start to finish",
    "planning.dependency.label": "Dependency", "planning.dependency.from": "from", "planning.dependency.to": "to", "planning.dependency.lag.none": "No lag", "planning.dependency.lag.positive": "Lag", "planning.dependency.lag.negative": "Lead", "planning.dependency.day": "day", "planning.dependency.days": "days", "planning.dependency.selectedChain": "Selected dependency chain",
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
    "planning.health.title": "Schedule health", "planning.health.open": "Open schedule health", "planning.health.source": "Validated schedule read-model facts",
    "planning.health.state.invalid": "Invalid", "planning.health.state.attention": "Needs attention", "planning.health.state.partial": "Partial evidence", "planning.health.state.ready": "On track",
    "planning.health.finish": "Calculated / target finish", "planning.health.notCalculated": "Variance not calculated", "planning.health.onTarget": "On target", "planning.health.days": "days", "planning.health.late": "late", "planning.health.early": "early", "planning.health.aligned": "aligned",
    "planning.health.critical": "Critical path", "planning.health.criticalDetail": "Server-calculated task flags", "planning.health.criticalTask.one": "critical task", "planning.health.criticalTask.many": "critical tasks",
    "planning.health.readiness": "Readiness", "planning.health.notReported": "Not reported", "planning.health.blocker.one": "blocker", "planning.health.blocker.many": "blockers", "planning.health.taskNotReady.one": "task not ready", "planning.health.taskNotReady.many": "tasks not ready", "planning.health.readinessUnavailable": "No readiness rollup",
    "planning.health.capacity": "Resource capacity", "planning.health.overloadedPoint.one": "overloaded point", "planning.health.overloadedPoint.many": "overloaded points", "planning.health.notCalculatedShort": "Not calculated", "planning.health.noResources": "No resources", "planning.health.capacityUnavailable": "Validated capacity result unavailable", "planning.health.capacityDetail": "Validated resource-day overloads",
    "planning.health.baseline": "Baseline variance", "planning.health.baselineCaptured.one": "baseline captured", "planning.health.baselineCaptured.many": "baselines captured", "planning.health.noBaseline": "No baseline captured", "planning.health.noBaselineShort": "No baseline",
    "planning.health.workingState": "Working state", "planning.health.working.serverReviewOnly": "Server review-only", "planning.health.working.review": "Review mode", "planning.health.working.edit": "Edit mode", "planning.health.updated": "Updated", "planning.health.revision": "Revision", "planning.health.authority": "Python remains scheduling authority; this popup does not recalculate the plan.",
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
    "calendar.selector.label": "Calendars", "calendar.selector.search": "Find calendars", "calendar.selector.display": "Calendar display", "calendar.selector.all": "All calendars", "calendar.selector.overlay": "Overlay every visible calendar", "calendar.selector.empty": "No matching calendars", "calendar.selector.none": "No calendars available", "calendar.selector.new": "New calendar",
    "calendar.navigator.label": "Date navigator", "calendar.navigator.open": "Choose date", "calendar.navigator.previousMonth": "Previous month", "calendar.navigator.nextMonth": "Next month",
    "calendar.status.event.one": "event", "calendar.status.event.many": "events", "calendar.status.busyBlock.one": "busy block", "calendar.status.busyBlock.many": "busy blocks",
    "calendar.event.edit": "Edit event", "calendar.event.editSeries": "Edit recurring series", "calendar.event.new": "New event", "calendar.event.editorDescription": "Set the calendar, timing, availability, participants, and recurrence.", "calendar.event.seriesDescription": "Changes, cancellation, and restoration apply to the entire recurring series.", "calendar.event.calendar": "Calendar", "calendar.event.title": "Title", "calendar.event.location": "Location", "calendar.event.starts": "Starts", "calendar.event.ends": "Ends", "calendar.event.timezone": "Time zone",
    "calendar.event.allDay": "All day", "calendar.event.showAs": "Show as", "calendar.event.busy": "Busy", "calendar.event.free": "Free", "calendar.event.repeat": "Repeat", "calendar.event.repeatUntil": "Repeat until", "calendar.event.recurrenceDefaultLimit": "Without a repeat-until date, UOK limits this series to 366 occurrences.", "calendar.event.reminderMinutes": "Reminder minutes", "calendar.event.participantName": "Participant name", "calendar.event.participantEmail": "Participant email", "calendar.event.description": "Description",
    "calendar.event.advancedRecurrence": "Advanced recurrence details are preserved while the frequency remains unchanged.", "calendar.event.savedReminder": "saved reminder", "calendar.event.savedReminders": "saved reminders", "calendar.event.reminderDeliveryNote": "calendar export includes alarms; UOK delivery is not enabled yet", "calendar.event.save": "Save changes", "calendar.event.create": "Create event", "calendar.event.cancel": "Cancel event", "calendar.event.restore": "Restore event", "calendar.event.cancelSeries": "Cancel series", "calendar.event.restoreSeries": "Restore series", "calendar.event.cancelSeriesConfirm": "Cancel this entire recurring series? Every occurrence will be canceled.", "calendar.event.restoreSeriesConfirm": "Restore this entire recurring series? Every occurrence will be restored.", "calendar.event.createOn": "Create event on", "calendar.event.at": "at", "calendar.event.status.label": "Status", "calendar.event.status.canceled": "Canceled", "calendar.event.status.tentative": "Tentative",
    "calendar.recurrence.none": "Does not repeat", "calendar.recurrence.daily": "Daily", "calendar.recurrence.weekly": "Weekly", "calendar.recurrence.monthly": "Monthly", "calendar.recurrence.yearly": "Yearly",
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
    "command.open": "فتح", "command.close": "إغلاق", "command.create": "إنشاء", "command.delete": "حذف", "command.edit": "تحرير", "command.save": "حفظ", "command.cancel": "إلغاء", "command.search": "بحث", "command.export": "تصدير", "command.print": "طباعة", "command.refresh": "تحديث", "command.working": "جارٍ العمل", "command.more": "المزيد", "command.moreActions": "مزيد من الإجراءات", "command.view": "عرض",
    "command.newEvent": "حدث جديد", "command.exportIcs": "تصدير ICS", "command.newThread": "محادثة جديدة", "command.createThread": "إنشاء محادثة", "command.newContact": "جهة اتصال جديدة", "command.newTask": "مهمة جديدة", "command.saveTask": "حفظ المهمة", "command.addTask": "إضافة مهمة", "command.exportCsv": "تصدير CSV", "command.importTemplate": "قالب", "command.projectJson": "JSON المشروع", "command.timelineSvg": "SVG المخطط الزمني", "command.document": "مستند",
    "command.moveDialog": "نقل", "command.moveDialogHint": "اسحب للتحريك. استخدم مفاتيح الأسهم للتحريك، وShift مع سهم لخطوة أكبر، وHome أو النقر المزدوج للعودة إلى موضع الفتح.", "command.workspaceEditor": "محرر مساحة العمل", "command.noSavedSearches": "لا توجد عمليات بحث محفوظة بعد.", "command.clearAll": "مسح الكل", "command.done": "تم",
    "command.order": "الاتجاه", "command.sortAscending": "ترتيب تصاعدي", "command.sortDescending": "ترتيب تنازلي",
    "command.ascendingTitle": "تصاعدي. انقر للترتيب التنازلي.", "command.descendingTitle": "تنازلي. انقر للترتيب التصاعدي.",
    "command.refinementSearch": "بحث", "command.refinementSort": "ترتيب", "command.refinementSection": "تقسيم", "command.refinements": "تحسينات", "command.activeRefinements": "تحسينات البحث النشطة", "command.filterSuffix": "عامل تصفية", "command.ascending": "تصاعدي", "command.descending": "تنازلي",
    "pagination.pageSize": "حجم الصفحة", "pagination.rows": "الصفوف", "pagination.previous": "السابق", "pagination.next": "التالي", "pagination.noRecords": "لا توجد سجلات",
    "pagination.showingRecords": "عرض السجلات", "pagination.through": "إلى", "pagination.of": "من",
    "contacts.paging": "ترقيم صفحات جهات الاتصال", "contacts.pageSize": "حجم صفحة جهات الاتصال", "contacts.noRecords": "لا توجد سجلات جهات اتصال",
    "planning.gantt": "مخطط جانت للتخطيط", "planning.grid": "شبكة مهام التخطيط", "planning.timeline": "الخط الزمني للتخطيط",
    "planning.view.label": "عرض التخطيط", "planning.view.ganttChart": "مخطط جانت", "planning.view.board": "اللوحة", "planning.view.list": "القائمة", "planning.view.calendar": "التقويم", "planning.view.workload": "عبء العمل", "planning.view.people": "الأشخاص", "planning.view.dashboard": "لوحة المعلومات",
    "planning.fieldPreset.logic": "منطق الجدولة",
    "planning.split.label": "تغيير حجم شبكة المهام والخط الزمني", "planning.split.hint": "اسحب لتغيير الحجم. استخدم مفاتيح الأسهم أو Home أو End، وانقر نقرا مزدوجا لإعادة الضبط.", "planning.split.value": "شبكة المهام بنسبة {grid}٪، والخط الزمني بنسبة {timeline}٪",
    "planning.column.wbs": "هيكل العمل", "planning.column.task": "المهمة", "planning.column.start": "البدء", "planning.column.end": "الانتهاء",
    "planning.column.duration": "المدة", "planning.column.progress": "٪", "planning.column.critical": "حرجة", "planning.column.assigned": "المسند", "planning.column.status": "الحالة",
    "planning.column.owner": "المالك", "planning.column.predecessors": "المهام السابقة", "planning.column.successors": "المهام اللاحقة", "planning.column.totalFloat": "السماح الكلي", "planning.column.readiness": "الجاهزية",
    "planning.owner.unavailable": "المالك غير متاح", "planning.owner.state.unavailable": "غير متاح", "planning.owner.restricted": "مالك مقيّد", "planning.owner.missing": "لم يُحدد المالك",
    "planning.readiness.notAssessed": "لم تُقيّم", "planning.readiness.ready": "جاهزة", "planning.readiness.noGates": "لا توجد بوابات", "planning.readiness.blocked": "محظورة ({count})", "planning.duration.dayShort": "ي",
    "planning.dependency.type.finish_to_start": "من الانتهاء إلى البدء", "planning.dependency.type.start_to_start": "من البدء إلى البدء", "planning.dependency.type.finish_to_finish": "من الانتهاء إلى الانتهاء", "planning.dependency.type.start_to_finish": "من البدء إلى الانتهاء",
    "planning.dependency.label": "تبعية", "planning.dependency.from": "من", "planning.dependency.to": "إلى", "planning.dependency.lag.none": "بدون إزاحة", "planning.dependency.lag.positive": "تأخير", "planning.dependency.lag.negative": "تقديم", "planning.dependency.day": "يوم", "planning.dependency.days": "أيام", "planning.dependency.selectedChain": "سلسلة التبعية المحددة",
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
    "planning.health.title": "صحة الجدول", "planning.health.open": "فتح صحة الجدول", "planning.health.source": "حقائق نموذج قراءة الجدول المتحقق منها",
    "planning.health.state.invalid": "غير صالح", "planning.health.state.attention": "يحتاج إلى انتباه", "planning.health.state.partial": "أدلة جزئية", "planning.health.state.ready": "على المسار",
    "planning.health.finish": "الانتهاء المحسوب / المستهدف", "planning.health.notCalculated": "لم يُحسب الانحراف", "planning.health.onTarget": "ضمن الهدف", "planning.health.days": "أيام", "planning.health.late": "متأخر", "planning.health.early": "مبكر", "planning.health.aligned": "مطابق",
    "planning.health.critical": "المسار الحرج", "planning.health.criticalDetail": "علامات مهام محسوبة على الخادم", "planning.health.criticalTask.one": "مهمة حرجة", "planning.health.criticalTask.many": "مهام حرجة",
    "planning.health.readiness": "الجاهزية", "planning.health.notReported": "غير مبلّغ", "planning.health.blocker.one": "عائق", "planning.health.blocker.many": "عوائق", "planning.health.taskNotReady.one": "مهمة غير جاهزة", "planning.health.taskNotReady.many": "مهام غير جاهزة", "planning.health.readinessUnavailable": "لا يوجد ملخص للجاهزية",
    "planning.health.capacity": "سعة الموارد", "planning.health.overloadedPoint.one": "نقطة تحميل زائد", "planning.health.overloadedPoint.many": "نقاط تحميل زائد", "planning.health.notCalculatedShort": "غير محسوب", "planning.health.noResources": "لا توجد موارد", "planning.health.capacityUnavailable": "نتيجة السعة المتحققة غير متاحة", "planning.health.capacityDetail": "حالات تحميل زائد متحققة لكل مورد ويوم",
    "planning.health.baseline": "انحراف خط الأساس", "planning.health.baselineCaptured.one": "خط أساس محفوظ", "planning.health.baselineCaptured.many": "خطوط أساس محفوظة", "planning.health.noBaseline": "لم يُحفظ خط أساس", "planning.health.noBaselineShort": "لا يوجد خط أساس",
    "planning.health.workingState": "حالة العمل", "planning.health.working.serverReviewOnly": "مراجعة فقط حسب الخادم", "planning.health.working.review": "وضع المراجعة", "planning.health.working.edit": "وضع التحرير", "planning.health.updated": "محدّث", "planning.health.revision": "الإصدار", "planning.health.authority": "تبقى بايثون سلطة الجدولة؛ لا تعيد هذه النافذة المنبثقة حساب الخطة.",
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
    "calendar.selector.label": "التقاويم", "calendar.selector.search": "البحث في التقاويم", "calendar.selector.display": "عرض التقويم", "calendar.selector.all": "كل التقاويم", "calendar.selector.overlay": "عرض كل التقاويم المرئية معا", "calendar.selector.empty": "لا توجد تقاويم مطابقة", "calendar.selector.none": "لا توجد تقاويم متاحة", "calendar.selector.new": "تقويم جديد",
    "calendar.navigator.label": "متصفح التاريخ", "calendar.navigator.open": "اختر تاريخا", "calendar.navigator.previousMonth": "الشهر السابق", "calendar.navigator.nextMonth": "الشهر التالي",
    "calendar.status.event.one": "حدث", "calendar.status.event.many": "أحداث", "calendar.status.busyBlock.one": "فترة مشغولة", "calendar.status.busyBlock.many": "فترات مشغولة",
    "calendar.event.edit": "تحرير الحدث", "calendar.event.editSeries": "تحرير السلسلة المتكررة", "calendar.event.new": "حدث جديد", "calendar.event.editorDescription": "حدد التقويم والتوقيت والتوفر والمشاركين والتكرار.", "calendar.event.seriesDescription": "تنطبق التغييرات والإلغاء والاستعادة على السلسلة المتكررة بأكملها.", "calendar.event.calendar": "التقويم", "calendar.event.title": "العنوان", "calendar.event.location": "الموقع", "calendar.event.starts": "يبدأ", "calendar.event.ends": "ينتهي", "calendar.event.timezone": "المنطقة الزمنية",
    "calendar.event.allDay": "طوال اليوم", "calendar.event.showAs": "إظهار كـ", "calendar.event.busy": "مشغول", "calendar.event.free": "متاح", "calendar.event.repeat": "التكرار", "calendar.event.repeatUntil": "التكرار حتى", "calendar.event.recurrenceDefaultLimit": "عند عدم تحديد تاريخ انتهاء للتكرار، يحد UOK هذه السلسلة إلى ٣٦٦ تكرارًا.", "calendar.event.reminderMinutes": "دقائق التذكير", "calendar.event.participantName": "اسم المشارك", "calendar.event.participantEmail": "بريد المشارك", "calendar.event.description": "الوصف",
    "calendar.event.advancedRecurrence": "تُحفظ تفاصيل التكرار المتقدمة ما دام التردد دون تغيير.", "calendar.event.savedReminder": "تذكير محفوظ", "calendar.event.savedReminders": "تذكيرات محفوظة", "calendar.event.reminderDeliveryNote": "يتضمن تصدير التقويم تنبيهات؛ تسليم UOK غير مفعّل بعد", "calendar.event.save": "حفظ التغييرات", "calendar.event.create": "إنشاء الحدث", "calendar.event.cancel": "إلغاء الحدث", "calendar.event.restore": "استعادة الحدث", "calendar.event.cancelSeries": "إلغاء السلسلة", "calendar.event.restoreSeries": "استعادة السلسلة", "calendar.event.cancelSeriesConfirm": "هل تريد إلغاء هذه السلسلة المتكررة بأكملها؟ سيتم إلغاء كل التكرارات.", "calendar.event.restoreSeriesConfirm": "هل تريد استعادة هذه السلسلة المتكررة بأكملها؟ ستتم استعادة كل التكرارات.", "calendar.event.createOn": "إنشاء حدث في", "calendar.event.at": "الساعة", "calendar.event.status.label": "الحالة", "calendar.event.status.canceled": "ملغى", "calendar.event.status.tentative": "مبدئي",
    "calendar.recurrence.none": "لا يتكرر", "calendar.recurrence.daily": "يوميا", "calendar.recurrence.weekly": "أسبوعيا", "calendar.recurrence.monthly": "شهريا", "calendar.recurrence.yearly": "سنويا",
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

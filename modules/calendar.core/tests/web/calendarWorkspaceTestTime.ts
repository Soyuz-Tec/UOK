const visibleEventDate = new Date();
visibleEventDate.setDate(15);
visibleEventDate.setHours(11, 0, 0, 0);
export const visibleEventStart = visibleEventDate.toISOString();
visibleEventDate.setHours(12, 0, 0, 0);
export const visibleEventEnd = visibleEventDate.toISOString();

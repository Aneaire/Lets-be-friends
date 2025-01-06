/**
 * Convert a date to Philippines timezone (UTC+8)
 * @param date - Date to convert (defaults to current date)
 * @returns Date object in Philippines timezone
 */

// console.log(formatPhilippinesDate(new Date()));
// Example output: "January 1, 2024, 02:30 PM"

// console.log(formatPhilippinesDate(new Date(), {
//   weekday: 'long',
//   year: 'numeric',
//   month: 'short',
//   day: 'numeric'
// }));
// Example output: "Monday, Jan 1, 2024"

export const toPhilippinesTime = (date: Date = new Date()): Date => {
  const philippinesDate = date.toLocaleString("en-US", {
    timeZone: "Asia/Manila",
  });
  return new Date(philippinesDate);
};

/**
 * Check if two dates are the same day in Philippines timezone
 * @param dateA - First date to compare
 * @param dateB - Second date to compare
 * @returns boolean indicating if dates are the same day
 */
export const isSameDayPhilippines = (dateA: Date, dateB: Date): boolean => {
  const philDateA = toPhilippinesTime(dateA);
  const philDateB = toPhilippinesTime(dateB);

  return (
    philDateA.getFullYear() === philDateB.getFullYear() &&
    philDateA.getMonth() === philDateB.getMonth() &&
    philDateA.getDate() === philDateB.getDate()
  );
};

/**
 * Get current date in Philippines timezone
 * @returns Current date in Philippines timezone
 */
export const getCurrentPhilippinesDate = (): Date => {
  return toPhilippinesTime();
};

/**
 * Format a date to Philippines timezone string
 * @param date - Date to format
 * @param options - Intl.DateTimeFormatOptions for customizing the output
 * @returns Formatted date string
 */
export const formatPhilippinesDate = (
  date: Date,
  options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }
): string => {
  return date.toLocaleString("en-US", {
    timeZone: "Asia/Manila",
    ...options,
  });
};

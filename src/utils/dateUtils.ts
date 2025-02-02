import { DateTime } from "luxon";

/**
 * Convert a date to Philippines timezone (UTC+8)
 * @param date - Date to convert (defaults to current date)
 * @returns Date object in Philippines timezone
 */
export const toPhilippinesTime = (date: Date = new Date()): Date => {
  return DateTime.fromJSDate(date).setZone("Asia/Manila").toJSDate();
};

/**
 * Check if two dates are the same day in Philippines timezone
 * @param dateA - First date to compare
 * @param dateB - Second date to compare
 * @returns boolean indicating if dates are the same day
 */
export const isSameDayPhilippines = (dateA: Date, dateB: Date): boolean => {
  const philDateA = DateTime.fromJSDate(dateA).setZone("Asia/Manila");
  const philDateB = DateTime.fromJSDate(dateB).setZone("Asia/Manila");

  return philDateA.hasSame(philDateB, "day");
};

/**
 * Get current date in Philippines timezone
 * @returns Current date in Philippines timezone
 */
export const getCurrentPhilippinesDate = (): Date => {
  return DateTime.now().setZone("Asia/Manila").toJSDate();
};

/**
 * Format a date to Philippines timezone string using Luxon
 * @param date - Date to format
 * @param format - Custom format (default: "MMMM d, yyyy, hh:mm a")
 * @returns Formatted date string
 */
export const formatPhilippinesDate = (
  date: Date,
  format: string = "MMMM d, yyyy, hh:mm a"
): string => {
  return DateTime.fromJSDate(date).setZone("Asia/Manila").toFormat(format);
};

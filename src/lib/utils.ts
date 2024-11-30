import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const convertFileToUrl = (file: File) => URL.createObjectURL(file);

// MESSAGE EXPIRATION

export function isWithin3Days(dateToCheck: Date) {
  const currentDate = new Date();
  const difference = Math.abs(dateToCheck.getTime() - currentDate.getTime());
  const differenceInDays = Math.ceil(difference / (1000 * 60 * 60 * 24));
  return differenceInDays <= 3;

  // const dateCheck = new Date(createdAt);
  // const within3Days = isWithin3Days(dateToCheck);
}

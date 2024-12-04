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

export function extractOtherId({
  mixedIds,
  knownId,
  delimiter = "_", // Default delimiter if not provided
}: {
  mixedIds: string;
  knownId: string;
  delimiter?: string;
}) {
  if (!mixedIds.includes(knownId)) {
    return ""; // Known ID is not in the mixed string
  }

  // Split the string by the delimiter
  const idsArray = mixedIds.split(delimiter);

  // Find and return the other ID
  return idsArray.find((id) => id !== knownId) || "";
  // Sample : const otherId = extractOtherId({
  //   mixedIds: "674ab6b3003e16b9b760_123456789",
  //   knownId: "123456789",
  // });
}

export const generateColorFromName = (name: string) => {
  if (!name) return "bg-accent-2";

  // Use a simple hash function to generate a consistent color
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    const char = name.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  const colors = [
    "bg-blue-500",
    "bg-green-500",
    "bg-purple-500",
    "bg-pink-500",
    "bg-indigo-500",
    "bg-teal-500",
    "bg-orange-500",
    "bg-rose-500",
    "bg-yellow-500",
    "bg-red-500",
    "bg-cyan-500",
    "bg-lime-500",
    "bg-amber-500",
    "bg-violet-500",
    "bg-fuchsia-500",
    "bg-emerald-500",
  ];

  // Use the hash to consistently select a color
  const colorIndex = Math.abs(hash) % colors.length;
  return colors[colorIndex];
};

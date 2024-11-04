export function formatDate(timestamp: string = ""): string {
  const now: Date = new Date();
  const postTime: Date = new Date(timestamp);
  const timeDifference: number = now.getTime() - postTime.getTime();
  const seconds: number = Math.floor(timeDifference / 1000);
  const minutes: number = Math.floor(seconds / 60);
  const hours: number = Math.floor(minutes / 60);
  const days: number = Math.floor(hours / 24);

  if (seconds < 60) {
    return "Just now";
  } else if (minutes < 60) {
    return `${minutes} minute${minutes > 1 ? "s" : ""} `;
  } else if (hours < 24) {
    return `${hours} hour${hours > 1 ? "s" : ""} `;
  } else if (days === 1) {
    return "Yesterday";
  } else {
    const options: Intl.DateTimeFormatOptions = {
      year: "numeric",
      month: "short",
      day: "numeric",
    };
    return postTime.toLocaleDateString(undefined, options);
  }
}

import { toast } from "sonner";

export const defaultToast = {
  SWW: (message: string = "Something went wrong") => toast.error(message),
  success: toast.success("Task completed successfully"),
};

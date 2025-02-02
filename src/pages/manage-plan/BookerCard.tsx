import { CustomCalendar } from "@/components/shared/CustomCalendar";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import ProfileAvatar from "@/components/user/ProfileAvatar";
import { useExpiredBooking } from "@/lib/react-query/mutation";
import { useGetUserImageAndName } from "@/lib/react-query/queries";
import { cn } from "@/lib/utils";
import useAuthStore from "@/store/userStore";
import { useNavigate } from "@tanstack/react-router";
import { format, isBefore } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useEffect } from "react";
import ChatBlockSkeleton from "../chats/ChatBlockSkeleton";

const BookerCard = ({
  bookerId,
  ownerId,
  date,
  bookingId,
  paid,
  status,
}: {
  bookerId?: string;
  ownerId?: string;
  date: Date;
  bookingId: string;
  paid: boolean;
  status: string;
}) => {
  const owner = useAuthStore.getState().user;
  const whoIsNot = bookerId
    ? bookerId === owner.id
      ? ownerId
      : bookerId
    : ownerId! === owner.id
      ? bookerId
      : ownerId;
  console.log("whoIsNot", whoIsNot);
  const { data: user } = useGetUserImageAndName(whoIsNot!);
  const { mutateAsync: expiredBooking, isPending: expiring } =
    useExpiredBooking(bookingId);
  const navigate = useNavigate({ from: "/manage-plans" });

  const handleRedirect = (e: any) => {
    if (e.target.closest(".popover-trigger")) {
      // Prevent redirect if click was on PopoverTrigger or its children
      return;
    }
    navigate({
      to: `/booking/${bookingId}`,
      search: { userId: bookerId ? bookerId : ownerId! },
    });
  };

  const isExpired: boolean =
    status === "completed" ? false : isBefore(date, new Date());

  useEffect(() => {
    if (isExpired) {
      expiredBooking();
    }
  }, [isExpired]);

  if (!user) return <ChatBlockSkeleton />;
  return (
    <div
      onClick={(e) => handleRedirect(e)}
      className={`cursor-pointer shadow-sm shadow-white/20 flex items-center bg-bgLight w-full gap-4 px-2 lg:px-5 py-1 rounded ${
        expiring ? "animate-pulse" : ""
      }`}
    >
      <ProfileAvatar
        className="md:w-12 md:h-12 w-9 h-9"
        imageId={user.imageId}
        name={user.fullName}
      />
      <div className=" text-content w-full">
        <h3 className=" font-medium">{user.fullName}</h3>
        <div className=" flex items-center justify-between">
          <p className={`text-xs opacity-75 `}>
            <span className={`${paid ? "text-green-500" : ""}`}>
              {paid ? "Paid" : "Unpaid"}
            </span>{" "}
            -{" "}
            <span className={isExpired ? "text-red-500" : ""}>
              {isExpired ? "Expired" : status}
            </span>
          </p>
        </div>
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant={null}
            className={cn(
              "md:w-[240px] text-left font-normal shad-input border border-white/40"
            )}
            onClick={(e) => e.stopPropagation()} // Stop propagation
          >
            <span className="md:block hidden">{format(date, "PPP")}</span>
            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-auto p-0 border-none rounded"
          align="start"
          onClick={(e) => e.stopPropagation()} // Stop propagation
        >
          <CustomCalendar
            mode="single"
            className=" shad-input backdrop-blur-sm text-white/70 accentFont "
            captionLayout="dropdown-buttons"
            selected={new Date(date)}
            toYear={new Date().getFullYear() + 1}
            showOutsideDays
            disabled={[
              {
                before: new Date(Date.now() + 1000 * 60 * 60 * 24),
              },
            ]}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default BookerCard;

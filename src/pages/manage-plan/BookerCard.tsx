import { CustomCalendar } from "@/components/shared/CustomCalendar";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import ProfileAvatar from "@/components/user/ProfileAvatar";
import { useGetUserImageAndName } from "@/lib/react-query/queries";
import { cn } from "@/lib/utils";
import { useNavigate } from "@tanstack/react-router";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import ChatBlockSkeleton from "../chats/ChatBlockSkeleton";

const BookerCard = ({
  bookerId,
  ownerId,
  date,
  bookingId,
  paid,
}: {
  bookerId?: string;
  ownerId?: string;
  date: Date;
  bookingId: string;
  paid: boolean;
}) => {
  const { data: user } = useGetUserImageAndName(bookerId ? bookerId : ownerId!);
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
  if (!user) return <ChatBlockSkeleton />;
  return (
    <div
      onClick={(e) => handleRedirect(e)}
      className=" cursor-pointer shadow-sm shadow-white/20 flex items-center bg-bgLight w-full gap-4 px-2 lg:px-5 py-1 rounded"
    >
      <ProfileAvatar
        className="md:w-12 md:h-12 w-9 h-9"
        imageId={user.imageId}
        name={user.fullName}
      />
      <div className=" text-content w-full">
        <h3 className=" font-medium">{user.fullName}</h3>
        <div className=" flex items-center justify-between">
          <p className={`text-xs opacity-75 ${paid ? "text-green-500" : ""}`}>
            {paid ? "Paid" : "Unpaid"}
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

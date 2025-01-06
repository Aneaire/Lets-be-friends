import LoadingIcon from "@/components/common/LoadingIcon";
import { IBookingType } from "@/lib/appwrite/api";
import { useGetBookerBookings } from "@/lib/react-query/queries";
import { IBooking } from "@/lib/types";
import { useEffect } from "react";
import { useInView } from "react-intersection-observer";
import ChatBlockSkeleton from "../chats/ChatBlockSkeleton";
import Booker from "./BookerCard";

const Bookings = ({ type }: { type: IBookingType }) => {
  const {
    data: bookings,
    isLoading,
    hasNextPage,
    fetchNextPage,
  } = useGetBookerBookings(type);

  const { ref, inView } = useInView();

  useEffect(() => {
    if (inView && hasNextPage) fetchNextPage();
  }, [inView]);

  if (isLoading) {
    return Array.from({ length: 20 }).map((_, index) => (
      <ChatBlockSkeleton key={index} />
    ));
  }

  const uniqueBookings = new Set<string>();
  const uniqueBookingElements = bookings?.pages
    .flatMap((page) =>
      page.documents.sort(
        (a: IBooking, b: IBooking) => Number(b.paid) - Number(a.paid)
      )
    )
    .filter((booking: IBooking) => {
      if (uniqueBookings.has(booking.$id)) {
        return false;
      }
      uniqueBookings.add(booking.$id);
      return true;
    })
    .map((booking: IBooking) => (
      <Booker
        key={booking.$id}
        ownerId={type === "bookings" ? booking.ownerId : undefined}
        bookerId={
          type === "clients" || type === "completed"
            ? booking.bookerId
            : undefined
        }
        date={booking.date}
        bookingId={booking.$id}
        paid={booking.paid}
      />
    ));

  return (
    <section className="w-full space-y-2">
      {uniqueBookingElements}

      {hasNextPage && (
        <div ref={ref} className="w-full flex-center">
          <LoadingIcon size="5" />
        </div>
      )}
    </section>
  );
};

export default Bookings;

import LoadingIcon from "@/components/common/LoadingIcon";
import { useCheckAllBookings } from "@/lib/react-query/queries";
import { IBooking } from "@/lib/types";
import React from "react";

const BookedListCheckerWrapper = ({
  children,
  userId,
  setBookedList,
}: {
  children: React.ReactNode;
  userId: string;
  setBookedList: React.Dispatch<React.SetStateAction<IBooking[]>>;
}) => {
  const { data: bookedList, isLoading, isError } = useCheckAllBookings(userId);

  // Only set the list if it's not already set or if bookedList is updated
  React.useEffect(() => {
    if (bookedList) {
      setBookedList(bookedList);
    }
  }, [bookedList]);

  if (isLoading) return <LoadingIcon />;
  if (isError) return <p>Something went wrong</p>;

  return <>{children}</>;
};

export default BookedListCheckerWrapper;

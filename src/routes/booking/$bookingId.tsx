import LoadingIcon from "@/components/common/LoadingIcon";
import { CustomCalendar } from "@/components/shared/CustomCalendar";
import NotFound from "@/components/shared/NotFound";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import ProfileAvatar from "@/components/user/ProfileAvatar";
import { bookingConfirmationValidation, getBooking } from "@/lib/appwrite/api";
import {
  useAcceptBooking,
  useBookingConfirmationValidation,
  useCancelBooking,
  useCreatePaymentLink,
  useRetrievePaymentFromPaymongo,
} from "@/lib/react-query/mutation";
import { useGetUserImageAndName } from "@/lib/react-query/queries";
import { cn } from "@/lib/utils";
import DisplayReceiptImage from "@/pages/booking/DisplayReceiptImage";
import Receipt from "@/pages/booking/Receipt";
import ReviewPostCard from "@/pages/review/ReviewPostCard";
import {
  getCurrentPhilippinesDate,
  toPhilippinesTime,
} from "@/utils/dateUtils";
import autoAnimate from "@formkit/auto-animate";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createFileRoute,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { format, isBefore } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

export const Route = createFileRoute("/booking/$bookingId")({
  validateSearch: (search: Record<string, unknown>): { userId: string } => {
    return {
      userId: search.userId as string,
    };
  },
  loader: async ({ params }) => {
    const { bookingId } = params; // Extract userId from params
    const booking = await getBooking(bookingId); // Fetch user data directly

    // const imageUrl = await getFilePreview(
    //   booking?.confirmationImageId!,
    //   "booking"
    // );

    // await new Promise((resolve) => setTimeout(resolve, 5000));
    // Loading state later
    return booking;

    // return { ...booking, confirmationImage: imageUrl }; // Return user data
  },
  component: () => {
    const booking = Route.useLoaderData();
    const router = useRouter();
    const { userId } = Route.useSearch();
    const { data: user } = useGetUserImageAndName(userId!);
    const [showTerms, setShowTerms] = useState(false);
    const parent = useRef(null);
    const navigate = useNavigate();

    const amIBooker = booking?.bookerId !== userId;

    const { mutateAsync: sendConfirmation, isPending } =
      useBookingConfirmationValidation();

    useEffect(() => {
      parent.current && autoAnimate(parent.current);
    }, [parent]);

    const form = useForm<z.infer<typeof bookingConfirmationValidation>>({
      resolver: zodResolver(bookingConfirmationValidation),
      defaultValues: {
        bookingId: booking?.$id,
        feedback: booking?.feedback ? booking?.feedback : "",
      },
    });

    const onSubmit = async (
      data: z.infer<typeof bookingConfirmationValidation>
    ) => {
      if (booking != undefined) {
        await sendConfirmation(data).then(() => {
          toast.success("Write a review for " + user?.fullName);
          navigate({
            to:
              `/review/create-review/` +
              booking.ownerId +
              `?bookingId=${booking.$id}`,
          });
        });
      }
    };

    // Accepting and rejecting booking
    const { mutateAsync: acceptBooking, isPending: acceptPending } =
      useAcceptBooking(booking?.$id!);

    const handleAccept = async () => {
      acceptBooking().then(() => router.invalidate());
    };

    // Cancelling booking
    const { mutateAsync: cancelBooking, isPending: cancelPending } =
      useCancelBooking(booking?.$id!);

    const handleCancel = async () => {
      cancelBooking().then(() => router.invalidate());
    };

    // Payment
    const { mutateAsync: createPaymentLink, isPending: creatingPaymentLink } =
      useCreatePaymentLink();
    const {
      mutateAsync: retrievePaymentFromPaymongo,
      isPending: retrievingPayment,
    } = useRetrievePaymentFromPaymongo();

    const createPaymentLinkHandler = async () => {
      await createPaymentLink({
        bookingId: booking?.$id!,
        amount: booking?.price!,
        description: "",
      }).then((res) => {
        if (res?.success) {
          res?.link && window.open(res.link, "_blank");
          router.invalidate();
        } else {
          toast.error("Something went wrong");
        }
      });
    };

    const handlePayment = async () => {
      if (booking?.referenceNumber && booking.paymentLink) {
        booking.paid && window.open(booking.paymentLink, "_blank");
        await retrievePaymentFromPaymongo({
          referenceNumber: booking.referenceNumber,
          bookingId: booking.$id!,
        }).then((res) => {
          if (res?.status === "unpaid") {
            window.open(booking.paymentLink, "_blank");
            return;
          }
          if (res?.status === "paid") {
            router.invalidate();
            return;
          }
          if (res?.status === "expired" || res?.status === "refunded") {
            createPaymentLinkHandler();
          }
        });
        return;
      }

      createPaymentLinkHandler();
    };

    const isBeforeDate = isBefore(
      getCurrentPhilippinesDate(),
      toPhilippinesTime(new Date(booking?.date!))
    );

    const hasNotUploadedReceiptYet = !booking?.receipt?.end;

    if (booking === undefined || user === undefined) return <NotFound />;

    return (
      <div className="flex flex-1 text-content pb-5">
        <div className="home-container">
          <div className="home-posts">
            <div className=" w-full flex justify-between items-center">
              <span className="flex items-center gap-2 text-dark-1 font-accent text-md md:text-xl px-2 md:px-4 py-1 md:bg-white rounded-full">
                <ProfileAvatar imageId={user.imageId} name={user.fullName} />
                <span className="md:block hidden">{user.fullName}</span>
              </span>
              <button
                className="text-white font-bold text-sm px-4 py-2 bg-blue-600 rounded-full hover:bg-blue-700"
                onClick={() => setShowTerms((prev) => !prev)}
              >
                {showTerms ? "Hide Terms" : "Show Terms"}
              </button>
            </div>

            {/* Content */}
            <section ref={parent} className=" w-full ">
              {showTerms && (
                <div className="mb-5 bg-bgLight rounded-lg p-6">
                  <h2 className="text-2xl font-bold mb-2">
                    Terms and Conditions
                  </h2>
                  <ol className="list-decimal pl-6">
                    <li className="mb-2">
                      You are obligated to pay for any damages or losses
                      incurred during the meetup.
                    </li>
                    <li className="mb-2">
                      In the event of an accident or incident, you agree to
                      report it to the meetup organizer and provide a detailed
                      account of what happened.
                    </li>
                    <li className="mb-2">
                      You agree to pay for any services rendered by the meetup
                      organizer or any third-party providers in the event that
                      the meetup is deemed a success.
                    </li>
                    <li className="mb-2">
                      You are responsible for ensuring that you have the
                      necessary insurance coverage to participate in the meetup.
                    </li>
                    <li className="mb-2">
                      You agree to hold harmless the meetup organizer and any
                      third-party providers for any damages or losses incurred
                      during the meetup.
                    </li>
                    <li>
                      By participating in this meetup, you acknowledge that you
                      have read and understood these terms and conditions and
                      agree to be bound by them.
                    </li>
                  </ol>
                </div>
              )}
              <div className=" bg-bgLight rounded-lg p-6 w-full space-y-0.5 md:space-y-2 mb-2">
                <h2 className=" font-bold text-lg md:text-2xl mb-2">
                  Booking Informations
                </h2>{" "}
                <p>
                  Amount to pay :{" "}
                  <span className=" text-green-600 font-medium">
                    {booking.price}
                  </span>
                </p>
                <p>
                  Status :{" "}
                  <span
                    className={` ${booking.paid ? "text-green-600" : "text-rose-600"}`}
                  >
                    {booking.paid ? "Paid" : "Unpaid"}
                  </span>
                </p>
                <p>Note/Message :</p>
                <Textarea
                  readOnly
                  value={booking?.note}
                  className=" shad-input focus-visible:ring-0"
                />
                <span className=" flex gap-2 flex-wrap">
                  <h4>Scheduled at: </h4>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={null}
                        className={cn(
                          "w-[240px] text-left font-normal shad-input border border-white/40"
                        )}
                      >
                        {format(booking.date, "PPP")}

                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-auto p-0 border-none rounded"
                      align="start"
                    >
                      <CustomCalendar
                        mode="single"
                        className=" shad-input backdrop-blur-sm text-white/70 accentFont "
                        captionLayout="dropdown-buttons"
                        defaultMonth={new Date(booking.date)}
                        selected={new Date(booking.date)}
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
                </span>
              </div>

              {booking.status === "pending" && !amIBooker && (
                <div className=" w-full flex-between mt-5 gap-4">
                  <Button
                    onClick={handleCancel}
                    variant="destructive"
                    className=" gap-1"
                  >
                    Cancel
                  </Button>{" "}
                  <Button
                    onClick={handleAccept}
                    className=" gap-1 bg-green-600"
                  >
                    Accept <span className=" md:block hidden">Booking</span>
                  </Button>
                </div>
              )}

              {booking.status === "accepted" && !amIBooker && !booking.paid && (
                <p className=" w-full text-center my-5">
                  Waiting for the Booker to process the payment
                </p>
              )}

              {booking.paid && booking.receipt != null && (
                <>
                  {booking.receipt.end &&
                    booking.status !== "completed" &&
                    amIBooker && (
                      <p className="pb-2 text-lg">
                        Write a feedback for the user to help them improve
                      </p>
                    )}
                  {booking.status === "completed" && (
                    <h2 className=" font-bold">Documentation : </h2>
                  )}
                  <DisplayReceiptImage receipt={booking.receipt} />
                  {amIBooker && booking.paid ? (
                    <Receipt
                      receipt={booking.receipt!}
                      bookingId={booking.$id}
                      date={booking.date}
                    />
                  ) : (
                    booking.status !== "completed" && (
                      <div className=" my-5 p-2">
                        <h2 className=" font-bold text-accent-2 text-xl font-accent text-center">
                          Reminder
                        </h2>
                        <p>
                          Please remind your friend that after your meetup to
                          write a feedback and end the booking on the app so
                          that you can receive the payment
                        </p>
                      </div>
                    )
                  )}

                  {/* Review */}
                  {booking.review && (
                    <div className=" py-2">
                      <ReviewPostCard
                        type="booking"
                        posts={booking.review as any}
                      />
                    </div>
                  )}

                  {booking.ownerAccepted && (
                    <Form {...form}>
                      <form
                        onSubmit={form.handleSubmit(onSubmit)}
                        className=" pb-5 space-y-2"
                      >
                        <FormField
                          control={form.control}
                          name="feedback"
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Textarea
                                  readOnly={
                                    booking.status === "completed" || !amIBooker
                                  }
                                  className=" text-dark-1 font-medium"
                                  placeholder="Additional Notes/Feedback"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage className="shad-form_message" />
                            </FormItem>
                          )}
                        />
                        <div className=" flex-center gap-2">
                          <Button
                            className=" bg-accent-1 px-5 "
                            type="submit"
                            disabled={
                              isBeforeDate ||
                              hasNotUploadedReceiptYet ||
                              booking.status === "completed"
                            }
                          >
                            {booking.status === "completed"
                              ? "Completed"
                              : isPending
                                ? "Submitting..."
                                : booking.receipt.end
                                  ? "End Booking"
                                  : "Upload Images First"}
                          </Button>
                          {booking.status === "completed" && amIBooker && (
                            <Button
                              onClick={() =>
                                navigate({
                                  to:
                                    `/review/create-review/` +
                                    booking.ownerId +
                                    `?bookingId=${booking.$id}`,
                                })
                              }
                              className="attractButton"
                            >
                              Write a Review
                            </Button>
                          )}
                        </div>
                      </form>
                    </Form>
                  )}
                </>
              )}

              {/* Booker */}
              {booking.status === "cancelled" ? (
                <p className=" text-center text-red">Booking Cancelled</p>
              ) : (
                <>
                  {!booking.paid && amIBooker && (
                    <div className=" w-full flex-between mt-5 gap-4">
                      <Button
                        onClick={handleCancel}
                        variant="destructive"
                        className=" gap-1"
                      >
                        Cancel
                      </Button>

                      {booking.ownerAccepted && (
                        <Button
                          onClick={handlePayment}
                          className=" accentGradient"
                        >
                          {creatingPaymentLink || retrievingPayment
                            ? "Please Wait"
                            : "Pay Booking"}{" "}
                          {retrievingPayment ||
                            (creatingPaymentLink && <LoadingIcon />)}
                        </Button>
                      )}
                    </div>
                  )}
                </>
              )}
            </section>
          </div>
        </div>
      </div>
    );
  },
});

import LoadingScreen from "@/components/common/LoadingScreen";
import { CustomCalendar } from "@/components/shared/CustomCalendar";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useCreateBooking } from "@/lib/react-query/mutation";
import { useCheckIfBooked, useGetSupport } from "@/lib/react-query/queries";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, useParams, useRouter } from "@tanstack/react-router";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

export const ownerInfoValidation = z.object({
  date: z.date(),
});

export const Route = createFileRoute("/profile/schedule/$supportId")({
  component: () => {
    const { supportId } = useParams({ strict: false });
    const { data: support, isLoading } = useGetSupport(supportId!);
    const { mutateAsync: createBooking, isPending: isLoadingCreate } =
      useCreateBooking(supportId!);
    const { data: booked } = useCheckIfBooked({ ownerId: support?.userId! });

    const { history } = useRouter();

    const form = useForm<z.infer<typeof ownerInfoValidation>>({
      resolver: zodResolver(ownerInfoValidation),
      defaultValues: {
        date: booked?.date,
      },
    });

    const onSubmit = (data: z.infer<typeof ownerInfoValidation>) => {
      if (booked) return;
      if (support && data.date)
        createBooking({
          date: data.date,
          price: support.price,
          ownerId: support.userId,
          ownerAccountId: support.user.accountId,
        });
      history.go(-1);
    };
    return (
      <div className="flex flex-1 text-content">
        <div className="home-container">
          <div className="home-posts">
            <div className=" w-full flex justify-between">
              <h2 className="  font-bold text-xl md:text-2xl tracking-wide text-left">
                Booking
              </h2>
            </div>

            {/* Content */}

            {isLoading ? (
              <LoadingScreen set="without-logo" />
            ) : (
              <section className=" w-full ">
                <Form {...form}>
                  <form
                    className=" space-y-3"
                    onSubmit={form.handleSubmit(onSubmit)}
                  >
                    <FormField
                      control={form.control}
                      name="date"
                      render={({ field }) => (
                        <FormItem className=" flex flex-col">
                          <FormLabel className="shad-form_label text-lg">
                            {booked
                              ? "Date Booked"
                              : "Choose a Date when you want to meet :"}
                          </FormLabel>
                          <FormControl>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant={null}
                                    className={cn(
                                      "w-[240px] text-left font-normal shad-input border border-white/40",
                                      !field.value && "text-muted-foreground"
                                    )}
                                  >
                                    {booked ? (
                                      <span>
                                        {format(new Date(booked.date), "PPP")}
                                      </span>
                                    ) : field.value ? (
                                      format(field.value, "PPP")
                                    ) : (
                                      <span>Pick a date</span>
                                    )}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent
                                className="w-auto p-0 border-none rounded"
                                align="start"
                              >
                                <CustomCalendar
                                  mode="single"
                                  className=" shad-input backdrop-blur-sm text-white/70 accentFont "
                                  captionLayout="dropdown-buttons"
                                  selected={
                                    booked ? new Date(booked.date) : field.value
                                  }
                                  onSelect={field.onChange}
                                  toYear={new Date().getFullYear() + 1}
                                  showOutsideDays
                                  disabled={[
                                    {
                                      before: new Date(
                                        Date.now() + 1000 * 60 * 60 * 24
                                      ),
                                    },
                                  ]}
                                />
                              </PopoverContent>
                            </Popover>
                          </FormControl>
                          <FormMessage className="shad-form_message" />
                        </FormItem>
                      )}
                    />
                    {booked && (
                      <p className=" font-medium text-accent-2 text-sm">
                        You already have a booking Please wait for approval
                      </p>
                    )}
                    <Button
                      disabled={!!booked || isLoadingCreate}
                      type="submit"
                      className=" bg-accent-2 mx-auto px-4 mt-4"
                    >
                      Send Request
                    </Button>
                  </form>
                </Form>
              </section>
            )}
          </div>
        </div>
      </div>
    );
  },
});

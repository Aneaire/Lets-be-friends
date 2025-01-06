import FileUploader from "@/components/shared/FileUploader";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { ReceiptUpdateValidation } from "@/lib/appwrite/api";
import { useUpdateReceipt } from "@/lib/react-query/mutation";
import { IReceipt } from "@/lib/types";
import { getCurrentPhilippinesDate } from "@/utils/dateUtils";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "@tanstack/react-router";
import { isAfter, isToday } from "date-fns";
import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const Receipt = ({
  receipt,
  bookingId,
  date,
}: {
  receipt: IReceipt;
  bookingId: string;
  date: Date;
}) => {
  const { mutateAsync: updateReceipt, isPending: updating } =
    useUpdateReceipt();

  const router = useRouter();

  const form = useForm<z.infer<typeof ReceiptUpdateValidation>>({
    resolver: zodResolver(ReceiptUpdateValidation),
    defaultValues: {
      start: [],
      middle: [],
      end: [],
      bookingId: bookingId,
    },
  });

  const onSubmit = (values: z.infer<typeof ReceiptUpdateValidation>) => {
    if (receipt.start === null) {
      if (values.start?.length == 0) {
        return;
      }
    } else if (receipt.middle === null) {
      if (values.middle?.length == 0) {
        return;
      }
    } else if (receipt.end === null) {
      if (values.end?.length == 0) {
        return;
      }
    }

    updateReceipt({
      bookingId,
      start: receipt.start ? receipt.start : values.start,
      middle: receipt.middle ? receipt.middle : values.middle,
      end: receipt.end ? receipt.end : values.end,
    }).then(() => {
      form.reset();
      router.invalidate();
      toast.success("Success");
    });
  };

  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const subscription = form.watch((values) => {
      if (values.start || values.middle || values.end) {
        if (
          isAfter(getCurrentPhilippinesDate(), new Date(date)) ||
          isToday(new Date(date))
        ) {
          button.current?.click();
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);

  if (receipt.end) return;

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className=" pt-2 md:pt-5 space-y-2"
      >
        <h2 className=" font-bold text-xl text-center md:text-start md:text-2xl mb-2">
          Upload Proof
        </h2>
        <p className="text-center md:text-start">
          As the Booker you are obligated to upload your{" "}
          <span className={!receipt.start ? "text-accent-2 font-bold" : ""}>
            START
          </span>
          ,{" "}
          <span
            className={
              receipt.start && !receipt.middle ? "text-accent-2 font-bold" : ""
            }
          >
            MIDDLE
          </span>{" "}
          and{" "}
          <span
            className={
              receipt.middle && !receipt.end ? "text-accent-2 font-bold" : ""
            }
          >
            END
          </span>
        </p>
        {!receipt.start && (
          <FormField
            control={form.control}
            name="start"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <FileUploader
                    fieldChange={field.onChange}
                    // mediaUrl={booking.confirmationImage}
                  />
                </FormControl>
                <FormMessage className="shad-form_message" />
              </FormItem>
            )}
          />
        )}
        {receipt.start && !receipt.middle && (
          <FormField
            control={form.control}
            name="middle"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <FileUploader
                    fieldChange={field.onChange}
                    // mediaUrl={booking.confirmationImage}
                  />
                </FormControl>
                <FormMessage className="shad-form_message" />
              </FormItem>
            )}
          />
        )}
        {receipt.middle && !receipt.end && (
          <FormField
            control={form.control}
            name="end"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <FileUploader
                    fieldChange={field.onChange}
                    // mediaUrl={booking.confirmationImage}
                  />
                </FormControl>
                <FormMessage className="shad-form_message" />
              </FormItem>
            )}
          />
        )}
        <div className=" flex-center">
          <Button
            ref={button}
            className=" bg-accent-1 px-5 hidden"
            type="submit"
          >
            {updating ? "Uploading..." : "Upload Proof"}
          </Button>
        </div>
      </form>
    </Form>
  );
};

export default Receipt;

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
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { useUpdateOwnerinfos } from "@/lib/react-query/mutation";
import { IUser } from "@/lib/types";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

export const ownerInfoValidation = z.object({
  bio: z.string().max(5000).optional(),
  bday: z.date().optional(),
  gender: z.string().max(100).optional(),
});

const EditOwnerInfos = ({ owner }: { owner: IUser }) => {
  const { mutateAsync: updateOwnerInfos } = useUpdateOwnerinfos();

  const form = useForm<z.infer<typeof ownerInfoValidation>>({
    resolver: zodResolver(ownerInfoValidation),
    defaultValues: {
      bio: owner?.bio ? owner?.bio : "",
      bday: owner?.bday ? new Date(owner?.bday) : new Date(2004, 0, 1),
      gender: owner?.gender ? owner?.gender : "",
    },
  });

  const onSubmit = (data: z.infer<typeof ownerInfoValidation>) => {
    console.log(owner);
    updateOwnerInfos({
      bio: data.bio,
      bday: data.bday,
      gender: data.gender,
      userId: owner.$id,
    });
  };
  return (
    <Form {...form}>
      <form className=" space-y-3" onSubmit={form.handleSubmit(onSubmit)}>
        <FormField
          control={form.control}
          name="bio"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="shad-form_label">Bio</FormLabel>
              <FormControl>
                <Textarea
                  className=" shad-textarea custom-scrollbar"
                  placeholder="What's on your mind..."
                  {...field}
                />
              </FormControl>
              <FormMessage className="shad-form_message" />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="gender"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="shad-form_label">Gender</FormLabel>
              <FormControl>
                <Input
                  className=" shad-input "
                  placeholder="Male/Female etc."
                  {...field}
                />
              </FormControl>
              <FormMessage className="shad-form_message" />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="bday"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="shad-form_label">
                Birth Date : {"  "}
              </FormLabel>
              <FormControl>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant={null}
                        className={cn(
                          "w-[240px] pl-3 text-left font-normal shad-input border border-white/40 ml-5",
                          !field.value && "text-muted-foreground"
                        )}
                      >
                        {field.value ? (
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
                      selected={field.value}
                      onSelect={field.onChange}
                      fromYear={1960}
                      toYear={2030}
                    />
                  </PopoverContent>
                </Popover>
              </FormControl>
              <FormMessage className="shad-form_message" />
            </FormItem>
          )}
        />
        <Button type="submit" className=" bg-accent-2 mx-auto px-4 mt-4">
          Save Changes
        </Button>
      </form>
    </Form>
  );
};

export default EditOwnerInfos;

import LoadingIcon from "@/components/common/LoadingIcon";
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
import { icons } from "@/constants/icons";
import { useUpdateSupport } from "@/lib/react-query/mutation";
import { ISupport } from "@/lib/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

const ownerInfoValidation = z.object({
  support1: z.string().max(50).optional(),
  support2: z.string().max(50).optional(),
  support3: z.string().max(50).optional(),
  support4: z.string().max(50).optional(),
  support5: z.string().max(50).optional(),
  support6: z.string().max(50).optional(),
  price: z.number({ coerce: true }),
});

const SupportForm = ({ support }: { support: ISupport }) => {
  const { mutateAsync: updateSupport, isPending } = useUpdateSupport();
  const form = useForm<z.infer<typeof ownerInfoValidation>>({
    resolver: zodResolver(ownerInfoValidation),
    defaultValues: {
      support1: support?.list[0] || "",
      support2: support?.list[1] || "",
      support3: support?.list[2] || "",
      support4: support?.list[3] || "",
      support5: support?.list[4] || "",
      support6: support?.list[5] || "",
      price: support?.price || 2000,
    },
  });

  const onSubmit = (data: z.infer<typeof ownerInfoValidation>) => {
    console.log(data);
    updateSupport({
      price: data.price,
      supportId: support?.$id || null,
      supports: [
        data.support1!,
        data.support2!,
        data.support3!,
        data.support4!,
        data.support5!,
        data.support6!,
      ],
    });
  };

  const placeholder = "Type what you can support";

  return (
    <div className=" w-full pt-7">
      <span className=" flex justify-start items-center mb-4 gap-4">
        {icons.plans(26, "fill-accent-1")}
        <h1 className=" heading">List of things you can support</h1>
      </span>
      <Form {...form}>
        <form className=" space-y-3" onSubmit={form.handleSubmit(onSubmit)}>
          <FormField
            control={form.control}
            name="support1"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Input
                    className=" shad-input "
                    placeholder={placeholder}
                    {...field}
                  />
                </FormControl>
                <FormMessage className="shad-form_message" />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="support2"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Input
                    className=" shad-input "
                    placeholder={placeholder}
                    {...field}
                  />
                </FormControl>
                <FormMessage className="shad-form_message" />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="support3"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Input
                    className=" shad-input "
                    placeholder={placeholder}
                    {...field}
                  />
                </FormControl>
                <FormMessage className="shad-form_message" />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="support4"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Input
                    className=" shad-input "
                    placeholder={placeholder}
                    {...field}
                  />
                </FormControl>
                <FormMessage className="shad-form_message" />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="support5"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Input
                    className=" shad-input "
                    placeholder={placeholder}
                    {...field}
                  />
                </FormControl>
                <FormMessage className="shad-form_message" />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="support6"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Input
                    className=" shad-input "
                    placeholder={placeholder}
                    {...field}
                  />
                </FormControl>
                <FormMessage className="shad-form_message" />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="price"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="shad-form_label">
                  Set your Price :
                </FormLabel>
                <FormControl>
                  <Input
                    className=" shad-input "
                    placeholder={"3000.."}
                    {...field}
                  />
                </FormControl>
                <FormMessage className="shad-form_message" />
              </FormItem>
            )}
          />

          <Button type="submit" className=" bg-accent-2 mx-auto px-4 mt-4">
            {isPending ? (
              <>
                Saving <LoadingIcon />
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </form>
      </Form>
    </div>
  );
};

export default SupportForm;

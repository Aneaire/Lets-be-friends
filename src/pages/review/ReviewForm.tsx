import FileUploader from "@/components/shared/FileUploader";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { useCreatePost, useUpdatePost } from "@/lib/react-query/mutation";
import { IReview } from "@/lib/types";
import useAuthStore from "@/store/userStore";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";

type PostFormProps = {
  post?: IReview;
  action: "Create" | "Update";
};

const ReviewValidation = z.object({
  caption: z.string().max(5000),
  file: z.custom<File[]>(),
  star: z.number().min(1).max(5),
});

const ReviewForm = ({ post, action }: PostFormProps) => {
  const { mutateAsync: createPost, isPending: isLoadingCreate } =
    useCreatePost();
  const { mutateAsync: updatePost, isPending: isLoadingUpdate } =
    useUpdatePost();

  const { user } = useAuthStore();

  const navigate = useNavigate();
  const form = useForm<z.infer<typeof ReviewValidation>>({
    resolver: zodResolver(ReviewValidation),
    defaultValues: {
      caption: post ? post?.caption : "",
      file: [],
      star: post ? post?.star : 0,
    },
  });

  // 2. Define a submit handler.
  async function onSubmit(values: z.infer<typeof ReviewValidation>) {
    if (post && action === "Update") {
      const updatedPost = await updatePost({
        ...values,
        postId: post.$id,
        imageId: post?.imageId,
        imageUrl: post?.imageUrl,
      });
      if (!updatedPost) {
        toast.error("Please try again later");
      }
      return navigate({ to: `/post/${post.$id}` });
    }

    await createPost({
      ...values,
      userId: user.id,
      accountId: user.accountId,
    });

    navigate({ to: "/" });
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className=" flex flex-col gap-9 w-full max-w-5xl md:mb-0 mb-5 "
      >
        <FormField
          control={form.control}
          name="caption"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="shad-form_label">Caption</FormLabel>
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
        {!post?.usedDp && (
          <FormField
            control={form.control}
            name="file"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="shad-form_label ">Add Photos</FormLabel>
                <FormControl>
                  <FileUploader
                    fieldChange={field.onChange}
                    mediaUrl={post?.image}
                  />
                </FormControl>
                <FormMessage className="shad-form_message" />
              </FormItem>
            )}
          />
        )}
        <div className=" flex gap-4 items-center justify-end ">
          <Button
            onClick={() => navigate({ to: "." })}
            className=" bg-dark-1/60 font-[500] regularFont textWhite"
            type="button"
          >
            Cancel
          </Button>
          <Button
            className={`bg-accent-1 ${
              isLoadingCreate || (isLoadingUpdate && "bg-accent-1/80")
            } font-[500] regularFont textWhite`}
            type="submit"
            disabled={isLoadingCreate || isLoadingUpdate}
          >
            {isLoadingCreate || isLoadingUpdate
              ? "Loading..."
              : `${action} Post`}
          </Button>
        </div>
      </form>
    </Form>
  );
};

export default ReviewForm;

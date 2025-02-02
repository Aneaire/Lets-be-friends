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
import { stars } from "@/constants/icons";
import { useCreateReview, useUpdateReview } from "@/lib/react-query/mutation";
import { IReview } from "@/lib/types";
import useAuthStore from "@/store/userStore";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocation, useNavigate, useParams } from "@tanstack/react-router";
import { useState } from "react";
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
  stars: z.number().min(1).max(5),
});

const ReviewForm = ({ post, action }: PostFormProps) => {
  const { mutateAsync: createReview, isPending: isLoadingCreate } =
    useCreateReview();
  const { mutateAsync: updatePost, isPending: isLoadingUpdate } =
    useUpdateReview();

  const { userId: ownerId } = useParams({ strict: false });
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const { search } = useLocation();
  // const queryParams = new URLSearchParams(search);
  const queryParams = new URLSearchParams(
    typeof search === "string"
      ? search
      : Object.entries(search).map(([key, value]) => [key, value.toString()])
  );
  const bookingId = queryParams.get("bookingId");

  const form = useForm<z.infer<typeof ReviewValidation>>({
    resolver: zodResolver(ReviewValidation),
    defaultValues: {
      caption: post ? post?.caption : "",
      file: [],
      stars: post ? post?.star : 0,
    },
  });

  const [selectedStar, setSelectedStar] = useState(post?.star ? post.star : 0);

  async function onSubmit(values: z.infer<typeof ReviewValidation>) {
    if (post && action === "Update") {
      const updatedPost = await updatePost({
        ...values,
        reviewId: post.$id,
        imageId: post?.imageId,
        image: post?.image,
        ownerId: ownerId!,
        userId: user.id,
        accountId: user.accountId,
      });
      if (!updatedPost) {
        toast.error("Please try again later");
      }
      return navigate({ to: `/post/${post.$id}` });
    }

    await createReview({
      ...values,
      ownerId: ownerId!,
      userId: user.id,
      accountId: user.accountId,
      bookingId: bookingId!,
    });

    navigate({ to: "/" });
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-9 w-full max-w-5xl md:mb-0 mb-5"
      >
        <p className=" text-lg font-regular text-start w-full">
          This review will be visible on the profile of the user you are
          reviewing.
        </p>
        <FormField
          control={form.control}
          name="caption"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="shad-form_label">Caption</FormLabel>
              <FormControl>
                <Textarea
                  className="shad-textarea custom-scrollbar"
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
          name="stars"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="shad-form_label">Rating</FormLabel>
              <FormControl>
                <div className="flex space-x-2 shad-input w-fit rounded">
                  {[1, 2, 3, 4, 5].map((starIndex) => (
                    <Button
                      type="button"
                      key={starIndex}
                      onClick={() => {
                        setSelectedStar(starIndex);
                        field.onChange(starIndex); // Update form value
                      }}
                    >
                      {starIndex <= selectedStar ? stars.one : stars.hollow}
                    </Button>
                  ))}
                </div>
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
                <FormLabel className="shad-form_label">Add Photos</FormLabel>
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
        <div className="flex gap-4 items-center justify-end">
          <Button
            onClick={() => navigate({ to: "." })}
            className="bg-dark-1/60 font-[500] regularFont textWhite"
            type="button"
          >
            Cancel
          </Button>
          <Button
            className={`bg-accent-1 ${isLoadingCreate || (isLoadingUpdate && "bg-accent-1/80")} font-[500] regularFont textWhite`}
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

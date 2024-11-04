import PostForm from "@/components/post/form/PostForm";
import { icons } from "@/constants/icons";
import { useGetPost } from "@/lib/react-query/queries";
import { createFileRoute, useParams } from "@tanstack/react-router";

export const Route = createFileRoute("/post/update-post/$postId")({
  component: () => {
    const { postId } = useParams({ strict: false });

    const { data: post, isLoading } = useGetPost(postId ? postId : "");

    return (
      <div className=" flex flex-1 min-h-screen">
        <div className="common-container">
          <div className=" max-w-5xl flex flex-start gap-3 justify-start w-full">
            {icons.addPost(36)}
            <h2 className="heading">Edit Post </h2>
          </div>
          {!post && <div className=" flex-center flex-1">Post not found</div>}
          {!isLoading && post && <PostForm action="Update" post={post} />}
        </div>
      </div>
    );
  },
});

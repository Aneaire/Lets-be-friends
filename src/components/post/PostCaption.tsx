import { icons } from "@/constants/icons";
import { useCreateCaptionPost } from "@/lib/react-query/mutation";
import useAuthStore from "@/store/userStore";
import { useNavigate } from "@tanstack/react-router";
import { ChangeEvent, FormEvent, useState } from "react";
import LoadingIcon from "../common/LoadingIcon";
import CaptionPostSkeleton from "../skeleton/CaptionPostSkeleton";
import { Button } from "../ui/button";
import ProfileAvatar from "../user/ProfileAvatar";

const PostCaption = () => {
  const { user, isLoading: ownerLoading } = useAuthStore();
  const navigate = useNavigate();

  const [textPost, setTextPost] = useState("");

  // Handling Text and posting
  const { mutate: createTextPost, isPending: isUploading } =
    useCreateCaptionPost();

  const handleTextChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setTextPost(e.target.value);
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (textPost.length === 0) return;
    createTextPost({ caption: textPost, creator: user.id });
    setTextPost("");
  };

  if (ownerLoading) return <CaptionPostSkeleton />;

  return (
    <form
      onSubmit={handleSubmit}
      className=" flex items-center w-full gap-4 max-w-section"
    >
      <ProfileAvatar
        className="w-14 h-14 hidden md:block"
        imageId={user.imageId}
        name={user.fullName}
        changeFallbackColor={false}
      />
      <div className=" flex-1">
        <textarea
          onChange={handleTextChange}
          value={textPost}
          className="w-full text-xs md:text-sm rounded h-12 px-2 pt-4 bg-bgLight outline-none text-content "
          placeholder="What's on your mind.."
        />
      </div>

      <Button
        onClick={() =>
          navigate({ to: `/post/create-post?textInputed=${textPost}` })
        }
        className=" px-0"
      >
        {icons.galleryAdd(22)}
      </Button>
      <Button
        disabled={isUploading}
        type="submit"
        className=" bg-accent-1 ml-1"
      >
        {isUploading ? <LoadingIcon /> : icons.send(22)}
      </Button>
    </form>
  );
};

export default PostCaption;

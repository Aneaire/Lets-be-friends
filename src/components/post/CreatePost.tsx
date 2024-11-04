import { icons } from "@/constants/icons";
import PostForm from "./form/PostForm";

const CreatePost = () => {
  return (
    <div className=" flex flex-1 text-content overflow-x-hidden ">
      <div className=" common-container">
        <div className=" max-w-5xl flex-start gap-3 justify-start w-full">
          {icons.galleryAdd(36)}
          <h2 className=" heading">Create Post</h2>
        </div>
        <PostForm action="Create" />
      </div>
    </div>
  );
};

export default CreatePost;

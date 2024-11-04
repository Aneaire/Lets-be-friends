import { icons } from "@/constants/icons";
import {
  useLikePost,
  useSavePost,
  useUnlikePost,
  useUnSavePost,
} from "@/lib/react-query/mutation";
import { useCheckLiked } from "@/lib/react-query/queries";
import autoAnimate from "@formkit/auto-animate";
import { useLayoutEffect } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

const DEBOUNCE_DELAY = 500; // 1 second delay between actions

const PostStats = ({
  postId,
  likes,
  color,
}: {
  postId: string;
  likes: number;
  color: string;
}) => {
  const { data: checkLiked, isLoading: checkingIfLiked } = useCheckLiked({
    postId: postId,
  });

  const likedRef = useRef(!!checkLiked || false);
  const [liked, setLiked] = useState(likedRef.current);
  const [likesCount, setLikesCount] = useState(likes);
  const lastActionTimestamp = useRef<number>(0);
  const isProcessing = useRef<boolean>(false);
  const savedPostIdRef = useRef<string | null>(null);

  useLayoutEffect(() => {
    likedRef.current = !!checkLiked;
    setLiked(likedRef.current);
  }, [checkLiked]);

  const {
    mutateAsync: likePost,
    isPending: liking,
    data: justLiked,
  } = useLikePost({ postId: postId });
  const { mutateAsync: unLikePost, isPending: unLiking } = useUnlikePost({
    postId: postId,
  });
  const {
    mutateAsync: savePost,
    isPending: isSaving,
    data: justSaved,
  } = useSavePost();
  const { mutateAsync: unSavePost, isPending: isUnSaving } = useUnSavePost();
  const [saved, setSaved] = useState(false);

  const canPerformAction = useCallback(() => {
    const now = Date.now();
    if (isProcessing.current) return false;
    if (now - lastActionTimestamp.current < DEBOUNCE_DELAY) {
      toast("Please wait before trying again");
      return false;
    }
    return true;
  }, []);

  const handleLikePost = async (e: any) => {
    e.stopPropagation();
    if (!canPerformAction()) return;
    if (liked) {
      toast("Already liked");
      return;
    }

    try {
      isProcessing.current = true;
      lastActionTimestamp.current = Date.now();
      setLiked(true);
      await likePost({ postId: postId });
      setLikesCount((prev) => prev + 1);
    } catch (error) {
      setLiked(false);
      setLikesCount((prev) => prev - 1);
      toast("Failed to like post");
    } finally {
      isProcessing.current = false;
    }
  };

  const handleUnLikePost = async (e: any) => {
    e.stopPropagation();
    if (!canPerformAction()) return;

    try {
      isProcessing.current = true;
      lastActionTimestamp.current = Date.now();
      setLiked(false);
      setLikesCount((prev) => prev - 1);

      if (justLiked) {
        await unLikePost({ userLikesId: justLiked.$id });
      }
      if (checkLiked) {
        await unLikePost({ userLikesId: checkLiked.$id });
      }
    } catch (error) {
      setLiked(true);
      setLikesCount((prev) => prev + 1);
      toast("Failed to unlike post");
    } finally {
      isProcessing.current = false;
    }
  };

  const handleSavePost = async (e: any) => {
    e.stopPropagation();
    if (!canPerformAction()) return;
    if (saved) {
      return handleUnSavePost(e);
    }

    try {
      isProcessing.current = true;
      lastActionTimestamp.current = Date.now();
      setSaved(true);
      await savePost({ postId: postId });
    } catch (error) {
      setSaved(false);
      toast("Failed to save post");
    } finally {
      isProcessing.current = false;
      if (justSaved) savedPostIdRef.current = justSaved.$id;
    }
  };

  const handleUnSavePost = async (e: any) => {
    e.stopPropagation();
    if (!canPerformAction()) return;

    try {
      isProcessing.current = true;
      lastActionTimestamp.current = Date.now();
      setSaved(false);

      if (savedPostIdRef.current) {
        await unSavePost({ userSavedId: savedPostIdRef.current });
        savedPostIdRef.current = null;
      }
      toast("Post unsaved");
    } catch (error) {
      setSaved(true);
      toast("Failed to unsave post");
    } finally {
      isProcessing.current = false;
    }
  };

  const Loader = () => (
    <div
      className={`animate-spin h-[20px] w-[20px] border-b-2 border-content rounded-full`}
    ></div>
  );

  // animation
  const parent = useRef(null);

  useEffect(() => {
    parent.current && autoAnimate(parent.current);
  }, [parent]);

  return (
    <div className="flex justify-between items-center z-20">
      <div ref={parent} className="flex gap-2 mr-5">
        {!checkingIfLiked ? (
          !unLiking && !liking ? (
            liked ? (
              <button
                className="flex cursor-pointer"
                onClick={handleUnLikePost}
                disabled={isProcessing.current}
              >
                {icons.liked(20)}
              </button>
            ) : (
              <button
                className="flex cursor-pointer"
                onClick={handleLikePost}
                disabled={isProcessing.current}
              >
                {icons.like({ width: 20, height: 20 })}
              </button>
            )
          ) : (
            <Loader />
          )
        ) : (
          icons.like({ width: 20, height: 20 })
        )}
        <p className={`${color} text-sm`}>{likesCount}</p>
      </div>
      <div ref={parent} className="flex">
        {isSaving || isUnSaving ? (
          <Loader />
        ) : (
          <button
            className="cursor-pointer"
            onClick={handleSavePost}
            disabled={isProcessing.current}
          >
            {saved ? icons.saved(20) : icons.save(20)}
          </button>
        )}
      </div>
    </div>
  );
};

export default PostStats;

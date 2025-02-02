import { icons } from "@/constants/icons";
import { useLikeReview, useUnlikeReview } from "@/lib/react-query/mutation";
import { useCheckReviewLiked } from "@/lib/react-query/queries";
import autoAnimate from "@formkit/auto-animate";
import { useLayoutEffect } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

const DEBOUNCE_DELAY = 500; // 1 second delay between actions

const ReviewPostStats = ({
  postId,
  likes,
  color,
}: {
  postId: string;
  likes: number;
  color: string;
}) => {
  const { data: checkLiked, isLoading: checkingIfLiked } = useCheckReviewLiked({
    reviewId: postId,
  });

  const likedRef = useRef(!!checkLiked || false);
  const [liked, setLiked] = useState(likedRef.current);
  const [likesCount, setLikesCount] = useState(likes);
  const lastActionTimestamp = useRef<number>(0);
  const isProcessing = useRef<boolean>(false);

  useLayoutEffect(() => {
    likedRef.current = !!checkLiked;
    setLiked(likedRef.current);
  }, [checkLiked]);

  const {
    mutateAsync: likePost,
    isPending: liking,
    data: justLiked,
  } = useLikeReview({ reviewId: postId });
  const { mutateAsync: unLikePost, isPending: unLiking } = useUnlikeReview({
    reviewId: postId,
  });

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
      await likePost({ reviewId: postId });
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
        await unLikePost({ likesId: justLiked.$id });
      }
      if (checkLiked) {
        await unLikePost({ likesId: checkLiked.$id });
      }
    } catch (error) {
      setLiked(true);
      setLikesCount((prev) => prev + 1);
      toast("Failed to unlike post");
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
    </div>
  );
};

export default ReviewPostStats;

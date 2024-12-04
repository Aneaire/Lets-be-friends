import LoadingIcon from "@/components/common/LoadingIcon";
import PostCaption from "@/components/post/PostCaption";
import PostCard from "@/components/post/PostCard";
import { PostCardSkeletonLooped } from "@/components/post/PostCardSkeleton";
import { useGetRecentInfinitePosts } from "@/lib/react-query/queries";
import autoAnimate from "@formkit/auto-animate";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useInView } from "react-intersection-observer";

export const Route = createFileRoute("/")({
  component: HomeComponent,
});

function HomeComponent() {
  const { ref, inView } = useInView();

  const {
    data: posts,
    fetchNextPage,
    hasNextPage,
    isFetching,
  } = useGetRecentInfinitePosts();
  const parent = useRef(null);

  useEffect(() => {
    parent.current && autoAnimate(parent.current);
  }, [parent]);

  useEffect(() => {
    if (inView && hasNextPage) fetchNextPage();
  }, [inView]);

  return (
    <div className="flex flex-1 text-content">
      <div className="home-container">
        <div className="home-posts">
          <div className=" w-full flex justify-between">
            <h2 className="  font-bold text-xl md:text-2xl tracking-wide text-left">
              HomeFeed
            </h2>

            {/* <Popover>
                <PopoverTrigger>
                  <ul className=" flex flex-col gap-1">
                    <li className=" w-7 h-[2px] bg-content"></li>
                    <li className=" w-7 h-[2px] bg-content"></li>
                    <li className=" w-7 h-[2px] bg-content"></li>
                  </ul>
                </PopoverTrigger>
                <PopoverContent className=" bg-bgLight/50 backdrop-blur-md text-content">
                  {extraLinks.map((link) => (
                    <div key={link.label} className={`leftsidebar-link group `}>
                      <NavLink
                        className={`flex px-4 gap-4 py-5 items-center justify-center font-medium text-lg hover:textWhite `}
                        to={link.route}
                      >
                        {link.label} {link.icon(20)}
                      </NavLink>
                    </div>
                  ))}
                </PopoverContent>
              </Popover> */}
          </div>

          <PostCaption />
          {isFetching && !posts ? (
            <PostCardSkeletonLooped />
          ) : (
            <ul
              ref={parent}
              className=" flex flex-col flex-1 gap-3 md:gap-5 w-full "
            >
              {posts?.pages.map(
                (post: any, index: number) =>
                  post != undefined && <PostCard posts={post} key={index} />
              )}
            </ul>
          )}
          {hasNextPage && (
            <div ref={ref}>
              <LoadingIcon size="5" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

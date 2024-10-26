import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/chats/$accountId")({
  component: () => {
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

            <HomePost />
            {isFetching && !posts ? (
              Array.from({ length: 20 }, (_, index) => (
                <PostCardSkeleton key={index} />
              ))
            ) : (
              <ul className=" flex flex-col flex-1 gap-3 md:gap-5 w-full ">
                {posts?.pages.map(
                  (post: Models.Document, index: number) =>
                    post != undefined && <PostCard posts={post} key={index} />
                )}
              </ul>
            )}
            {/* {hasNextPage && (
              <div ref={ref}>
                <LoadingIcon size="5" />
              </div>
            )} */}
          </div>
        </div>
      </div>
    );
  },
});

import LoadingIcon from "@/components/common/LoadingIcon";
import GridPostContainer from "@/components/post/GridPostContainer";
import GridPostList from "@/components/post/GridPostList";
import SearchResults from "@/components/post/SearchResults";
import { icons } from "@/constants/icons";
import { useGetLatestPosts, useSearchPosts } from "@/lib/react-query/queries";
import { createFileRoute } from "@tanstack/react-router";
import { useDebounce } from "@uidotdev/usehooks";
import { useEffect, useState } from "react";
import { useInView } from "react-intersection-observer";

export const Route = createFileRoute("/explore/")({
  component: () => {
    const { ref, inView } = useInView();
    const { data: posts, fetchNextPage, hasNextPage } = useGetLatestPosts();

    const [searchValue, setSearchValue] = useState("");
    const debounceValue = useDebounce(searchValue, 500);
    const { data: searchPosts, isFetching: isSearchFetching } =
      useSearchPosts(debounceValue);
    useEffect(() => {
      if (inView && !searchValue) fetchNextPage();
    }, [inView, searchValue]);

    if (!posts) {
      return (
        <div className="  flex-center w-full h-full">
          <LoadingIcon size="9" />
        </div>
      );
    }
    const shouldShowSearchResults = searchValue !== "";
    const shouldShowPosts =
      !shouldShowSearchResults &&
      posts.pages.every((item) => item?.documents.length === 0);

    return (
      <div className=" explore-container min-h-screen">
        <div className=" explore-inner_container">
          <h2 className="heading w-full">Search Post</h2>
          <div className=" flex items-center gap-3 w-full rounded-lg dark:bg-dark-1 bg-bgLight">
            <div className=" pl-4">{icons.search(24)}</div>

            <input
              type="text"
              placeholder="Search"
              className="explore-search w-full px-2 focus:ring-0 focus:border-none"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
            />
          </div>
        </div>
        <div className="flex-between w-full max-w-5xl mt-16 mb-7">
          <h3 className="heading-2 text-base">Popular Today</h3>
          <div className="flex-center bg-bgLight rounded-xl px-4 py-2 cursor-pointer">
            <p className="flex-center  gap-3 text-xs md:textbase text-content font-medium tracking-widest ">
              All {icons.filter(16)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-9 w-full max-w-5xl">
          {" "}
          {shouldShowSearchResults ? (
            <GridPostContainer>
              <SearchResults
                isSearchFetching={isSearchFetching}
                searchedPosts={searchPosts}
              />
            </GridPostContainer>
          ) : shouldShowPosts ? (
            <p className=" text-light-1 mt-10 text-center text-content w-full">
              End of Posts
            </p>
          ) : (
            <GridPostContainer>
              {posts.pages.map((item, index) => (
                <GridPostList key={`page-${index}`} posts={item?.documents} />
              ))}
            </GridPostContainer>
          )}
        </div>
        {hasNextPage && !searchValue && (
          <div ref={ref} className="mt-10">
            <LoadingIcon size="9" />
          </div>
        )}
      </div>
    );
  },
});

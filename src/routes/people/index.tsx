import LoadingIcon from "@/components/common/LoadingIcon";
import SearchUsers from "@/components/users/SearchUsers";
import UserCard from "@/components/users/UserCard";
import { icons } from "@/constants/icons";
import { useGetUsers, useSearchUsers } from "@/lib/react-query/queries";
import { createFileRoute } from "@tanstack/react-router";
import { useDebounce } from "@uidotdev/usehooks";
import { useEffect, useState } from "react";
import { useInView } from "react-intersection-observer";

export const Route = createFileRoute("/people/")({
  component: () => {
    const [searchUser, setSearchUser] = useState("");
    const [ref, inView] = useInView();
    const { data: users, fetchNextPage, hasNextPage } = useGetUsers();

    const debounceValue = useDebounce(searchUser, 500);
    const { data: searchUsers, isFetching: isSearchFetching } =
      useSearchUsers(debounceValue);

    useEffect(() => {
      if (inView && !searchUser) fetchNextPage();
    }, [inView]);
    if (!users) {
      return (
        <div className=" flex-center w-full h-full">
          <LoadingIcon size="10" />
        </div>
      );
    }
    const showUsers = users?.pages.every(
      (item) => item?.documents.length === 0
    );

    console.log(searchUsers);

    const shouldShowSearchResults = searchUser !== "";
    return (
      <>
        <div className="flex items-center flex-1 text-content">
          <div className="home-container self-start">
            <div className="w-full max-w-5xl mx-auto">
              <h2 className=" font-bold text-xl md:text-2xl tracking-wide text-left w-full">
                Find Friends
              </h2>
              <div className=" flex items-center gap-3 w-full rounded-lg dark:bg-dark-1 bg-bgLight mt-7 mb-10">
                <div className=" pl-4">{icons.search(24)}</div>

                <input
                  type="text"
                  placeholder="Search"
                  className="explore-search w-full px-2 focus:ring-transparent  "
                  value={searchUser}
                  onChange={(e) => setSearchUser(e.target.value)}
                />
              </div>
              <div className="cards-container">
                <div className=" w-full">
                  {shouldShowSearchResults ? (
                    <div className=" flex place-content-center flex-wrap gap-4 py-2">
                      <SearchUsers
                        isSearchFetching={isSearchFetching}
                        searchedUsers={searchUsers}
                      />
                    </div>
                  ) : showUsers ? (
                    <p className=" text-light-1 mt-10 text-center w-full">
                      End of Posts
                    </p>
                  ) : (
                    <div className=" flex place-content-center flex-wrap gap-4 py-2">
                      {users.pages.length > 0 &&
                        users?.pages.map((item) =>
                          item.documents.map((doc: any) => (
                            <UserCard key={doc.$id} user={doc} />
                          ))
                        )}
                    </div>
                  )}
                </div>

                {hasNextPage && !searchUser && (
                  <div ref={ref}>
                    <LoadingIcon size="9" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </>
    );
  },
});

import { Models } from "appwrite";

import LoadingIcon from "../common/LoadingIcon";
import UserCard from "./UserCard";

type SearchResultsProps = {
  isSearchFetching: boolean;
  searchedUsers?: Models.DocumentList<Models.Document>;
};

const SearchUsers = ({
  isSearchFetching,
  searchedUsers,
}: SearchResultsProps) => {
  if (isSearchFetching) return <LoadingIcon size="9" />;

  if (searchedUsers && searchedUsers?.documents.length > 0) {
    // return <AddUsers users={searchedUsers?.documents} />;
    return (
      <>
        {searchedUsers.documents.map((user: any) => (
          <UserCard key={user.$id} user={user} />
        ))}
      </>
    );
  }
  return (
    <p className=" text-textLight text-center w-full mt-10">SearchResults</p>
  );
};

export default SearchUsers;

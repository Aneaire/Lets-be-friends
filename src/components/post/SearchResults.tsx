import { Models } from "appwrite";
import LoadingIcon from "../common/LoadingIcon";
import GridPostList from "./GridPostList";

type SearchResultsProps = {
  isSearchFetching: boolean;
  searchedPosts?: Models.DocumentList<Models.Document>;
};

const SearchResults = ({
  isSearchFetching,
  searchedPosts,
}: SearchResultsProps) => {
  if (isSearchFetching) return <LoadingIcon size={"9"} />;

  if (searchedPosts && searchedPosts.documents.length > 0) {
    return <GridPostList posts={searchedPosts.documents} />;
  }
  return (
    <p className=" text-textLight text-center w-full mt-10">SearchResults</p>
  );
};

export default SearchResults;

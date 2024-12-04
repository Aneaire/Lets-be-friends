import { useGetProfileImage } from "@/lib/react-query/queries";
import { IUser } from "@/lib/types";
import { Link } from "@tanstack/react-router";
import { Skeleton } from "../ui/skeleton";

const UserCard = ({ user }: { user: IUser }) => {
  const { data: profilePicture, isLoading } = useGetProfileImage({
    imageId: user.imageId,
    quality: 25,
  });

  return (
    <>
      <Link to={`/profile/${user.$id}`}>
        <div className="normal_cards-size bg-gradient-to-tr from-accent-1 to-bgLight aspect-[1/1.2]">
          {!isLoading ? (
            <img
              className="w-full h-full object-cover"
              src={
                profilePicture
                  ? profilePicture
                  : "/images/profile-placeholder.svg"
              }
              alt="profile-image"
              draggable={false}
            />
          ) : (
            <Skeleton className="w-full h-full bg-bg" />
          )}
          <div className="absolute bottom-0 left-0 bg-dark-1/60 dark:bg-bgLight/60 z-10 w-full px-2 pt-1 pb-1">
            <div className=" space-y-0 text-content">
              <h3 className=" leading-3 whitespace-nowrap textWhite text-xs md:text-sm font-bold lg:text-base ">
                {user.fullName}
              </h3>

              <p className=" text-[10px] md:text-xs textWhite tracking-tight ">
                {user.bio != null ? (
                  user.bio.length > 41 ? (
                    user.bio.slice(0, 41) + ".."
                  ) : (
                    user.bio
                  )
                ) : (
                  <span className="leading-3 text-xs text-white/50">
                    @{user.username}
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
      </Link>
    </>
  );
};

export default UserCard;

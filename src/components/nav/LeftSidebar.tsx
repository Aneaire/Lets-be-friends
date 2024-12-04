import { INavLink, sidebarLinks } from "@/constants";
import { icons } from "@/constants/icons";
import { useSignOutAccount } from "@/lib/react-query/mutation";
import useAuthStore from "@/store/userStore";
import { Link, useLocation } from "@tanstack/react-router";
import { Button } from "../ui/button";
import ProfileAvatar from "../user/ProfileAvatar";

const LeftSidebar = () => {
  const { user } = useAuthStore();
  const { pathname } = useLocation();
  const { mutate: signOut } = useSignOutAccount();

  return (
    <nav
      className="leftsidebar top-0 rounded-br-2xl h-screen "
      style={{ position: "sticky" }}
    >
      <div className=" flex flex-col  gap-11">
        <Link className=" mx-auto" to={"/"}>
          <img src="/logo.svg" width={170} height={36} alt="logo" />
        </Link>

        <Link
          to={"/profile/$userId"}
          params={{ userId: user.id }}
          className=" flex gap-3 items-center"
        >
          <ProfileAvatar
            className=" w-14 h-14"
            imageId={user.imageId}
            name={user.fullName}
            changeFallbackColor={false}
          />
          <div className=" flex flex-col">
            <p className="font-bold text-base text-content ">
              {user?.fullName || "User"}
            </p>
            <p className=" text-xs text-textLight">
              @{user?.username || "User0125"}
            </p>
          </div>
        </Link>
        <ul className=" flex flex-col gap-6">
          {sidebarLinks.map((link: INavLink) => {
            const isActive = pathname === link.route;
            return (
              <li
                key={link.label}
                className={`leftsidebar-link group ${
                  isActive && "bg-accent-1"
                }`}
              >
                <Link
                  className={`flex gap-4 p-4 items-center hover:textWhite ${
                    isActive && "textWhite "
                  }`}
                  to={link.route}
                >
                  {link.icon({ size: 24, isActive: isActive })}
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
      <Button
        className=" justify-self-start self-start gap-4"
        variant="ghost"
        onClick={() => signOut()}
      >
        {icons.logout(21)}
        <p className=" text-content">Log out</p>
      </Button>
    </nav>
  );
};

export default LeftSidebar;

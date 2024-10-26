import { icons } from "@/constants/icons";
import { useAuthContext } from "@/context/AuthContext";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import ProfileAvatar from "../user/ProfileAvatar";

const Topbar = () => {
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const { pathname } = useLocation();

  if (pathname.includes("/conversation-receipt/")) return null;
  return (
    <section className={`topbar top-0 bg-bg/70 backdrop-blur-md shadow-sm `}>
      <div className="flex-between py-1 px-3">
        <Link to="/" className="flex gap-3 itemsCenter">
          <img src="/logo.svg" alt="logo" width={130} height={225} />
        </Link>

        <div className="flex-center gap-3">
          <Link to="/chats/$accountId" params={{ accountId: "asd" }}>
            {icons.message(35)}
          </Link>
          <Link to={`/profile/${user.id}`} className="flexCenter gap-3">
            <ProfileAvatar
              className="w-8 h-8"
              imageId={user.imageId}
              name={user.fullName}
            />
          </Link>
        </div>
      </div>
    </section>
  );
};

export default Topbar;

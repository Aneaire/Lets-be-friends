import { bottombarLinks, INavLink } from "@/constants";
import { Link, useLocation } from "@tanstack/react-router";

const Bottombar = () => {
  const { pathname } = useLocation();

  return (
    <section className="bottombar">
      {bottombarLinks.map((link: INavLink) => {
        const isActive = pathname === link.route;
        return (
          <Link
            key={link.label}
            className={`${
              isActive && "bg-accent-1 rounded-[10px]"
            } flexCenter flex-col  gap-1 p-2 transition ease-out`}
            to={link.route}
          >
            {link.icon({ size: 23, isActive: isActive })}
          </Link>
        );
      })}
    </section>
  );
};

export default Bottombar;

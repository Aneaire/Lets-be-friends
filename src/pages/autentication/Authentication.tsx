import React from "react";
import Login from "./Login";
import SignUp from "./SignUp";

const Authentication = () => {
  const [showLogin, setShowLogin] = React.useState(true);
  const toggleForm = () => setShowLogin(!showLogin);
  return (
    <div className=" flex">
      <section className="flex flex-1 justify-center items-center flex-col">
        {showLogin ? (
          <Login toggleForm={toggleForm} />
        ) : (
          <SignUp toggleForm={toggleForm} />
        )}
      </section>
      <img
        src="/images/AuthBg.png"
        alt="logo"
        className="hidden xl:block h-screen w-1/2 object-cover bg-no-repeat"
      />
    </div>
  );
};

export default Authentication;

import React from "react";
import Login from "./Login";
import SignUp from "./SignUp";

const Authentication = () => {
  const [showLogin, setShowLogin] = React.useState(true);
  return (
    <div className=" flex h-screen padding">
      <section className="flex flex-1 justify-center items-center flex-col py-10">
        <div className=" max-w-md w-full">
          <img
            src="/images/screen-logo.svg"
            alt="logo"
            className="w-full h-28 object-contain"
          />
          {showLogin ? <Login /> : <SignUp />}
        </div>
        {/* Toggle Form */}
        <p className=" text-sm mt-2 ">
          {showLogin ? "Don't have an account?" : "Already have an account?"}
          <button
            className=" text-accent-1 ml-2"
            onClick={() => setShowLogin(!showLogin)}
          >
            {showLogin ? "Sign Up" : "Sign In"}
          </button>
        </p>
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

import React from "react";
import Login from "./Login";
import SignUp from "./SignUp";

const Authentication = () => {
  const [showLogin, setShowLogin] = React.useState(true);
  return (
    <div>
      {showLogin ? <Login /> : <SignUp />}
      <button onClick={() => setShowLogin(!showLogin)}>Toggle</button>
    </div>
  );
};

export default Authentication;

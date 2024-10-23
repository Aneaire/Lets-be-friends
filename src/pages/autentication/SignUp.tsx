const SignUp = ({ toggleForm }: { toggleForm: () => void }) => {
  return (
    <div>
      <h1>Sign Up</h1>
      <p>
        Already have an account?{" "}
        <button onClick={() => toggleForm()}>Sign In</button>
      </p>
    </div>
  );
};

export default SignUp;

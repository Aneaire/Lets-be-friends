const SignUp = ({ toggleForm }: { toggleForm: () => void }) => {
  return (
    <div>
      <h1>Sign Up</h1>
      <p>
        Already have an account?{" "}
        <button className=" text-accent-1" onClick={() => toggleForm()}>
          Sign In
        </button>
      </p>
    </div>
  );
};

export default SignUp;

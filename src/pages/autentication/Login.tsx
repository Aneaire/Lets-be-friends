const Login = ({ toggleForm }: { toggleForm: () => void }) => {
  return (
    <div>
      <h1>Login</h1>
      <p>
        Don't have an account? <button onClick={toggleForm}>Sign Up</button>
      </p>
    </div>
  );
};

export default Login;

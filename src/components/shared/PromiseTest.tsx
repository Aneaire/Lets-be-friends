import { useEffect, useState } from "react";

const PromiseTest = () => {
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setBusy(false);
    }, 3000);

    return () => clearTimeout(timeout);
  }, []);

  return <div>{busy ? "busy" : "not busy"}</div>;
};

export default PromiseTest;

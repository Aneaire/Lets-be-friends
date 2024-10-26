import LoadingIcon from "@/components/common/LoadingIcon";
import { useVerifyAccount } from "@/lib/react-query/mutation";
import {
  createFileRoute,
  useNavigate,
  useParams,
} from "@tanstack/react-router";
import { useRef } from "react";
import { toast } from "sonner";

export type ValidatedParams = {
  username: string;
  accountId: string;
};

export const Route = createFileRoute("/verification/$secret")({
  validateSearch: (search: Record<string, unknown>): ValidatedParams => {
    return {
      username: search.username as string,
      accountId: search.accountId as string,
    };
  },
  component: () => {
    const { secret } = useParams({ strict: false });
    const { username, accountId } = Route.useSearch();
    const navigate = useNavigate({ from: "/verification/$secret" });
    const { mutateAsync, isPending, isSuccess, isError } = useVerifyAccount();

    // Track if verification has already been triggered
    const hasVerified = useRef(false);

    const verifyAccount = async () => {
      if (!hasVerified.current && secret && accountId) {
        hasVerified.current = true; // Prevent further calls
        await mutateAsync({ accountId, secret });
        if (isSuccess) {
          toast.success("Account verified");
          navigate({ to: "/" });
        }
      }
    };

    // Call verifyAccount only once during initial render
    if (secret && accountId) {
      verifyAccount();
    }

    return (
      <section className="flex-center flex-col container">
        <h5 className=" text-3xl mb-2 font-accent text-accent-1">
          Hi there, {username}
        </h5>
        <p>Please wait while we verify your account.</p>
        <span className=" mt-5">
          <LoadingIcon size="10" />
        </span>
        {isError && (
          <p className=" text-red-500 mt-5">
            Something went wrong. Please try again later.
          </p>
        )}
      </section>
    );
  },
});

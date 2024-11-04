import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useSignIn } from "@/lib/react-query/mutation";
import useAuthStore from "@/store/userStore";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { z } from "zod";

const Login = () => {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const { mutateAsync: signIn, data, isPending } = useSignIn();
  // const { refetch } = useAuthContext();
  const LoginSchema = z.object({
    email: z.string(),
    password: z.string().min(6),
  });

  const form = useForm<z.infer<typeof LoginSchema>>({
    resolver: zodResolver(LoginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = (data: z.infer<typeof LoginSchema>) => {
    signIn(data);
  };

  return (
    <Form {...form}>
      <div className=" sm:w-[420px] flex flex-col flexCenter text-content regularFont">
        <h2 className=" text-content text-2xl  font-black mt-4 text-center">
          Welcome Back!
        </h2>
        <p className=" text-textLight text-center text-sm mt-1 mb-4 ">
          Log in to access your account, reconnect with your friends, and
          continue exploring all the amazing features we have in store for you.
        </p>

        <form
          className=" flex flex-col w-full gap-2 p-2"
          onSubmit={form.handleSubmit(onSubmit)}
        >
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    className=" text-dark-1"
                    type="email"
                    autoComplete="email"
                    autoFocus
                    placeholder="Enter your email address"
                    {...field}
                  />
                </FormControl>
                <FormDescription />
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <Input
                    className=" text-dark-1"
                    type="password"
                    placeholder="**********"
                    {...field}
                  />
                </FormControl>
                <FormDescription />
                <FormMessage />
              </FormItem>
            )}
          />
          <Button className=" text-white bg-accent-1 font-accent font-bold text-lg mt-5">
            Sign In
          </Button>
        </form>
      </div>
    </Form>
  );
};

export default Login;

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
import { useCreateAccount } from "@/lib/react-query/mutation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const SignUpSchema = z.object({
  fullName: z
    .string()
    .min(3, { message: "The full name must be at least 3 characters." })
    .max(50, { message: "The full name must be less than 50 characters." }),
  username: z
    .string()
    .min(3, { message: "The username must be at least 3 characters." })
    .max(30, { message: "The username must be less than 30 characters." })
    .regex(/^[a-zA-Z0-9]+$/, {
      message: "The username must only contain letters and numbers.",
    }),
  email: z
    .string()
    .email({ message: "The email must be a valid email address." }),
  password: z
    .string()
    .min(6, { message: "The password must be at least 6 characters." }),
});

const SignUp = () => {
  const { mutateAsync: createAccount, data, isPending } = useCreateAccount();

  const form = useForm<z.infer<typeof SignUpSchema>>({
    resolver: zodResolver(SignUpSchema),
    defaultValues: {
      fullName: "",
      username: "",
      email: "",
      password: "",
    },
  });

  const onSubmit = (data: z.infer<typeof SignUpSchema>) => {
    createAccount({
      ...data,
    }).then(() => {
      toast.success("Account created successfully!");
    });
  };

  return (
    <Form {...form}>
      <div className=" sm:w-[420px] flex flex-col flexCenter text-content regularFont mx-auto">
        <h2 className=" text-content text-2xl  font-black mt-4 text-center">
          Sign Up Now
        </h2>
        <p className=" opacity-70 text-center text-md mt-1 mb-4">
          Join our community and unlock endless possibilities! Discover new
          connections, stay in touch with friends, and explore everything we
          have to offer—all in one place.
        </p>

        <form
          className="flex flex-col w-full gap-2 p-2"
          onSubmit={form.handleSubmit(onSubmit)}
        >
          <FormField
            control={form.control}
            name="fullName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Full Name</FormLabel>
                <FormControl>
                  <Input type="text" placeholder="Martin Smith" {...field} />
                </FormControl>
                <FormDescription />
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="username"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Username</FormLabel>
                <FormControl>
                  <Input type="text" placeholder="martinsmith" {...field} />
                </FormControl>
                <FormDescription />
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    autoComplete="email"
                    autoFocus
                    placeholder="martinsmith@example.com"
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
                  <Input type="password" placeholder="********" {...field} />
                </FormControl>
                <FormDescription />
                <FormMessage />
              </FormItem>
            )}
          />
          <Button
            disabled={isPending || !!data}
            type="submit"
            className="text-white bg-accent-1 font-accent font-bold text-lg mt-5"
          >
            Sign Up
          </Button>
        </form>
      </div>
    </Form>
  );
};

export default SignUp;

import { icons } from "@/constants/icons";
import { Link } from "@tanstack/react-router";
import { Button } from "../ui/button";

const CreateConvo = ({ id }: { id: string }) => {
  return (
    <div className=" flex justify-between mt-2 text-sm">
      <Link
        to={`/profile/plans/${id}`}
        className=" flex textWhite gap-2 px-4 py-2 md:text-sm bg-accent-2 rounded-md w-fit"
      >
        <span className=" hidden md:block">View Plans</span> {icons.plans(20)}
      </Link>
      <Button
        // onClick={() => handleMessageButton()}
        // disabled={isCreating || checking}
        className=" flex gap-6 text-dark-1 dark:textWhite px-4 py-2 mtext-sm bg-accent-1/10 rounded-md w-fit"
      >
        <span className=" hidden md:block">Message</span> {icons.chat(20)}
      </Button>
    </div>
  );
};

export default CreateConvo;

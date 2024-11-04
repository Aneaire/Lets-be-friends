import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { icons } from "@/constants/icons";
import { useDeletePost } from "@/lib/react-query/mutation";
import { IDeletePost } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useNavigate } from "@tanstack/react-router";
import { useMediaQuery } from "@uidotdev/usehooks";

export function DeletePostBtn(values: IDeletePost) {
  const [open, setOpen] = React.useState(false);
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const content = {
    title: "Are you sure?",
    desc: "You will not be able to change it after",
  };

  const btn = <button className={"px-2"}>{icons.delete(24)}</button>;

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>{btn}</DialogTrigger>
        <DialogContent className="sm:max-w-[425px] bg-bg">
          <DialogHeader>
            <DialogTitle className=" text-content regularFont text-center">
              {content.title}
            </DialogTitle>
            <DialogDescription className=" text-content regularFont text-center">
              {content.desc}
            </DialogDescription>
          </DialogHeader>
          <ProfileForm {...values} />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>{btn}</DrawerTrigger>
      <DrawerContent className=" bg-bg">
        <DrawerHeader className="text-left">
          <DrawerTitle className=" text-content regularFont text-center">
            {content.title}
          </DrawerTitle>
          <DrawerDescription className=" text-content regularFont text-center">
            {content.desc}
          </DrawerDescription>
        </DrawerHeader>

        <DrawerFooter className="pt-2 ">
          <DrawerClose asChild>
            <Button className=" regularFont text-content bg-accent-2">
              Cancel
            </Button>
          </DrawerClose>
        </DrawerFooter>
        <ProfileForm {...values} />
      </DrawerContent>
    </Drawer>
  );
}

function ProfileForm(values: IDeletePost) {
  const navigate = useNavigate();

  const { mutate: deletePost, isPending: deleting } = useDeletePost();

  const handleFulfilling = async () => {
    await deletePost({ postId: values.postId, imageId: values.imageId });
    navigate({ to: "/" });
  };

  return (
    <div
      className={cn(
        "grid items-start text-content regularFont gap-4 px-4 mb-4"
      )}
    >
      <Button
        onClick={() => handleFulfilling()}
        variant="ghost"
        className={`post_details-delete_btn bg-rose-600`}
        disabled={deleting}
      >
        Delete
      </Button>
    </div>
  );
}

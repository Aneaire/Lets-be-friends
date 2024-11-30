import LoadingScreen from "@/components/common/LoadingScreen";
import { Separator } from "@/components/ui/separator";
import { useGetOwnerInfosAndSupport } from "@/lib/react-query/queries";
import { ISupport } from "@/lib/types";
import EditOwnerInfos from "./EditOwnerInfos";
import SupportForm from "./SupportForm";

const EditProfileInfos = () => {
  const { data: owner, isLoading } = useGetOwnerInfosAndSupport();

  if (isLoading) return <LoadingScreen set="without-logo" />;

  console.log(owner);

  return (
    <div className=" w-full">
      {/* Bio, bday... */}
      <EditOwnerInfos owner={owner!} />
      <Separator
        orientation="horizontal"
        className=" bg-content mt-4 opacity-30"
      />
      {/* supports */}
      <SupportForm support={owner?.support! as ISupport} />
    </div>
  );
};

export default EditProfileInfos;

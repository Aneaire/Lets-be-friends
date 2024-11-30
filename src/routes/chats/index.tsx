import { Button } from "@/components/ui/button";
import { config, functions } from "@/lib/appwrite/config";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/chats/")({
  component: () => {
    const submit = async () => {
      const promise = functions.createExecution(
        config.createConversationFnId,
        JSON.stringify({
          accountId1: "6746a967000856f82dee",
          accountId2: "6746aa74001d7cbc7dec",
        })
      );

      promise.then(
        function (response: any) {
          console.log(response); // Success
        },
        function (error: any) {
          console.log(error); // Failure
        }
      );
    };
    return (
      <div className="flex flex-1 text-content">
        <div className="home-container">
          <div className="home-posts">
            <div className=" w-full flex justify-between">
              <h2 className="  font-bold text-xl md:text-2xl tracking-wide text-left">
                Chats
              </h2>
            </div>

            {/* Contents */}

            <section className=" w-full space-y-2">
              {/* {Array.from({ length: 10 }, (_, index) => (
              <ChatBlock key={index} />
            ))} */}
              <Button variant={"secondary"} onClick={submit}>
                Create
              </Button>
            </section>
          </div>
        </div>
      </div>
    );
  },
});

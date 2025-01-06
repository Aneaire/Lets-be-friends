import { Button } from "@/components/ui/button";
import Bookings from "@/pages/manage-plan/Bookings";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/manage-plans/")({
  component: () => {
    const [toggle, setToggle] = useState(false);

    // client side
    const [clientCompleted, setClientCompleted] = useState(false);

    return (
      <div className="flex flex-1 text-content">
        <div className="home-container">
          <div className="home-posts">
            <div className=" w-full flex justify-between">
              <h2 className="  font-bold text-xl md:text-2xl tracking-wide text-left">
                Manage Your Plans
              </h2>
            </div>
            <div className=" w-full flex flex-grow gap-2">
              <Button
                onClick={() => setToggle(!toggle)}
                disabled={!toggle}
                className=" bg-accent-2 flex-1"
              >
                Bookings
              </Button>{" "}
              {toggle && (
                <div className=" flex-1 flex space-x-2">
                  <Button
                    onClick={() => setClientCompleted(!clientCompleted)}
                    disabled={!clientCompleted}
                    className=" bg-accent-2 flex-1"
                  >
                    Clients
                  </Button>
                  <Button
                    onClick={() => setClientCompleted(!clientCompleted)}
                    disabled={clientCompleted}
                    className=" bg-green-600 flex-1"
                  >
                    Completed
                  </Button>
                </div>
              )}
              {!toggle && (
                <Button
                  onClick={() => setToggle(!toggle)}
                  disabled={toggle}
                  className=" bg-accent-2 flex-1"
                >
                  Clients
                </Button>
              )}
            </div>

            {/* Content */}
            <section className=" w-full space-y-2">
              {toggle ? (
                // owner handles clients
                clientCompleted ? (
                  <Bookings type="completed" />
                ) : (
                  <Bookings type="clients" />
                )
              ) : (
                // owner is booker
                <Bookings type="bookings" />
              )}
            </section>
          </div>
        </div>
      </div>
    );
  },
});

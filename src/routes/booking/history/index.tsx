import Bookings from "@/pages/manage-plan/Bookings";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/booking/history/")({
  component: () => (
    <div className="flex flex-1 text-content">
      <div className="home-container">
        <div className="home-posts">
          <div className=" w-full flex justify-between items-center">
            <h2 className="  font-bold text-xl md:text-2xl tracking-wide text-left">
              History
            </h2>
          </div>

          {/* Content */}
          <section className=" w-full space-y-2">
            <Bookings type="all" />
          </section>
        </div>
      </div>
    </div>
  ),
});

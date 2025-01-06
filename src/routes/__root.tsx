import LoadingScreen from "@/components/common/LoadingScreen";
import Bottombar from "@/components/nav/Bottombar";
import LeftSidebar from "@/components/nav/LeftSidebar";
import Topbar from "@/components/nav/Topbar";
import { AuthProvider } from "@/context/AuthContext";
import useAuthStore from "@/store/userStore";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Outlet, createRootRoute } from "@tanstack/react-router";
import { Toaster } from "sonner";
import Authentication from "../pages/autentication/Authentication";

const queryClient = new QueryClient();

const ManageDisplayBaseOnAuth = () => {
  const { isLoading, isAuthenticated } = useAuthStore();

  if (isLoading) {
    return <LoadingScreen />;
  }

  return isAuthenticated ? <RootComponent /> : <Authentication />;
};

export const Route = createRootRoute({
  component: () => (
    <>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ManageDisplayBaseOnAuth />
        </AuthProvider>
      </QueryClientProvider>
      <Toaster
        toastOptions={{
          classNames: {
            default: "toast-default",
            error: "toast-error",
            success: "toast-success",
            info: "toast-info",
            warning: "toast-warning",
          },
        }}
      />
    </>
  ),
});

function RootComponent() {
  return (
    <>
      <div className=" w-full md:flex">
        <LeftSidebar />
        {/* {toggleBar ? <DashboardSideBar /> : <LeftSidebar />} */}
        <Topbar />
        <section className=" bg-bg relative flex flex-1 h-full md:pt-0 mb-3 md:mb-0">
          {/* <ErrorBoundaryWrapper> */}
          <Outlet />
          {/* </ErrorBoundaryWrapper> */}
        </section>
        <Bottombar />
        {/* {isUserAdmin && (
          <div
            onClick={() => {
              setToggleBar(!toggleBar);
            }}
            className=" cursor-pointer hover:scale-110 hover:-translate-y-3 backdrop-blur-sm bg-bgLight/50 transition-all fixed bottom-2 right-2 shadow-xl rounded-full p-4 active:opacity-50"
          >
            {toggleBar ? icons.plans(20) : icons.home(20)}
          </div>
        )} */}
      </div>
      {/* <TanStackRouterDevtools position="bottom-right" /> */}
    </>
  );
}

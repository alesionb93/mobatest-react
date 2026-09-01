import { Outlet } from "react-router-dom";
import { useProject } from "@/contexts/project-context";
import { NoProjectPage } from "@/pages/no-project-page";
import { Skeleton } from "@/components/ui/skeleton";

function RequireProject() {
  const { loading, projects } = useProject();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col gap-3 w-64">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-2/3" />
        </div>
      </div>
    );
  }

  if (projects.length === 0) {
    return <NoProjectPage />;
  }

  return <Outlet />;
}

export { RequireProject };

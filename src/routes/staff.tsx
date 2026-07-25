import { createFileRoute } from "@tanstack/react-router";
import StaffPage from "@/pages/staff-page";
import { ThemeProvider } from "@/components/theme-provider";

function StaffRoute() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="ZPASTRY-cafe-theme">
      <StaffPage />
    </ThemeProvider>
  );
}

export const Route = createFileRoute("/staff")({
  component: StaffRoute,
});
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "@tanstack/react-router";
import { Coffee } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background text-foreground px-4">
      <Card className="w-full max-w-md border-card-border rounded-2xl">
        <CardContent className="pt-8 pb-8 text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-full flex items-center justify-center text-2xl"
            style={{ background: "linear-gradient(135deg,#d4a017,#a06010)" }}>
            <Coffee className="text-white" size={24} />
          </div>
          <div className="space-y-1.5">
            <h1 className="font-serif text-2xl font-bold">Page not found</h1>
            <p className="text-sm text-muted-foreground">
              This table isn't set. The page you're looking for doesn't exist.
            </p>
          </div>
          <Link
            to="/"
            className="inline-block rounded-xl px-5 py-2.5 text-sm font-semibold text-accent-foreground bg-accent hover:opacity-90 transition-opacity"
          >
            Back to ELGA Cafe
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

import { GraduationCap, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type CourseCardProps = {
  name: string;
  favourite: boolean;
  onToggleFavourite: () => void;
};

/** Card for a single course. Only the favourite star is interactive until courses can be opened. */
function CourseCard({ name, favourite, onToggleFavourite }: CourseCardProps) {
  return (
    <Card className="relative h-full pt-0">
      {/* Placeholder until the course data includes thumbnail artwork. */}
      <div
        className="flex aspect-video items-center justify-center bg-muted text-muted-foreground"
        aria-hidden="true"
      >
        <GraduationCap className="size-10" strokeWidth={1.5} />
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 bg-background/80 hover:bg-background"
        aria-pressed={favourite}
        aria-label={
          favourite
            ? `Remove ${name} from favourites`
            : `Add ${name} to favourites`
        }
        onClick={onToggleFavourite}
      >
        <Star className={cn(favourite && "fill-current text-yellow-500")} />
      </Button>
      <CardHeader>
        <CardTitle className="break-words [overflow-wrap:anywhere]">
          <h3>{name}</h3>
        </CardTitle>
      </CardHeader>
    </Card>
  );
}

export default CourseCard;

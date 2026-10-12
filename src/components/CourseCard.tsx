import { GraduationCap } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";

type CourseCardProps = {
  name: string;
};

/** Presentational card for a single course. Not interactive until courses can be opened. */
function CourseCard({ name }: CourseCardProps) {
  return (
    <Card className="h-full pt-0">
      {/* Placeholder until the course data includes thumbnail artwork. */}
      <div
        className="flex aspect-video items-center justify-center bg-muted text-muted-foreground"
        aria-hidden="true"
      >
        <GraduationCap className="size-10" strokeWidth={1.5} />
      </div>
      <CardHeader>
        <CardTitle className="break-words [overflow-wrap:anywhere]">
          <h3>{name}</h3>
        </CardTitle>
      </CardHeader>
    </Card>
  );
}

export default CourseCard;

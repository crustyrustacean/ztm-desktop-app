import { useState } from "react";
import { GraduationCap } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";

type CourseCardProps = {
  name: string;
  imageSrc?: string;
};

/** Presentational card for a single course. Not interactive until courses can be opened. */
function CourseCard({ name, imageSrc }: CourseCardProps) {
  // Falls back to the placeholder when artwork is missing or fails to load (e.g. offline, uncached).
  const [failedSrc, setFailedSrc] = useState<string>();
  const showImage = imageSrc && imageSrc !== failedSrc;

  return (
    <Card className="h-full pt-0">
      {showImage ? (
        // Decorative: the course name is the card's heading.
        <img
          src={imageSrc}
          alt=""
          loading="lazy"
          decoding="async"
          className="aspect-video w-full bg-muted object-cover"
          onError={() => setFailedSrc(imageSrc)}
        />
      ) : (
        <div
          className="flex aspect-video items-center justify-center bg-muted text-muted-foreground"
          aria-hidden="true"
        >
          <GraduationCap className="size-10" strokeWidth={1.5} />
        </div>
      )}
      <CardHeader>
        <CardTitle className="break-words [overflow-wrap:anywhere]">
          <h3>{name}</h3>
        </CardTitle>
      </CardHeader>
    </Card>
  );
}

export default CourseCard;

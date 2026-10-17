import { useState } from "react";
import { GraduationCap, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type CourseCardProps = {
  name: string;
  imageUrl: string | null;
  favourite: boolean;
  onToggleFavourite: () => void;
  /** Opens the course; omitted when the course has no page to open. */
  onOpen?: () => void;
};

/** Card for a single course. The whole card opens the course; the star toggles a favourite. */
function CourseCard({
  name,
  imageUrl,
  favourite,
  onToggleFavourite,
  onOpen,
}: CourseCardProps) {
  // Remember which URL failed so a later URL change gets a fresh attempt.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showImage = imageUrl !== null && imageUrl !== failedUrl;

  return (
    <Card
      aria-disabled={!onOpen}
      className={cn(
        "relative h-full pt-0",
        onOpen &&
          "transition-shadow has-[[data-open-course]:focus-visible]:ring-3 has-[[data-open-course]:focus-visible]:ring-ring/50 has-[[data-open-course]:hover]:shadow-md",
        !onOpen && "cursor-not-allowed opacity-60",
      )}
    >
      {showImage ? (
        <img
          src={imageUrl}
          alt=""
          loading="lazy"
          className="aspect-video w-full bg-muted object-cover"
          onError={() => setFailedUrl(imageUrl)}
        />
      ) : (
        // Placeholder for courses without artwork or whose image failed to load.
        <div
          className="flex aspect-video items-center justify-center bg-muted text-muted-foreground"
          aria-hidden="true"
        >
          <GraduationCap className="size-10" strokeWidth={1.5} />
        </div>
      )}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 z-10 bg-background/80 hover:bg-background"
        aria-pressed={favourite}
        aria-label={
          favourite
            ? `Remove ${name} from favourites`
            : `Add ${name} to favourites`
        }
        onClick={onToggleFavourite}
        disabled={!onOpen}
      >
        <Star className={cn(favourite && "fill-current text-yellow-500")} />
      </Button>
      <CardHeader>
        <CardTitle className="break-words [overflow-wrap:anywhere]">
          <h3>
            {onOpen ? (
              // The stretched ::after makes the whole card clickable while keeping
              // one accessible control named after the course.
              <button
                type="button"
                data-open-course
                className="cursor-pointer text-left outline-none after:absolute after:inset-0 after:content-['']"
                onClick={onOpen}
              >
                {name}
              </button>
            ) : (
              <span>
                {name}
                <span className="mt-1 block text-xs font-normal text-muted-foreground">
                  Coming soon
                </span>
              </span>
            )}
          </h3>
        </CardTitle>
      </CardHeader>
    </Card>
  );
}

export default CourseCard;

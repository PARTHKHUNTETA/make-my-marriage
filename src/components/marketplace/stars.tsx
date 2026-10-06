import { Star } from "lucide-react";

// A row of five stars showing a rating, for reading (screen readers get the number).
export function Stars({ rating }: { rating: number }) {
  return (
    <span
      className="inline-flex items-center gap-0.5"
      role="img"
      aria-label={`${rating} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          aria-hidden
          className={`size-4 ${n <= Math.round(rating) ? "fill-honey text-honey" : "text-line"}`}
        />
      ))}
    </span>
  );
}

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium transition-colors focus:outline-none",
  {
    variants: {
      variant: {
        default: "border-transparent bg-zinc-100 text-zinc-900 hover:bg-zinc-200",
        secondary: "border-transparent bg-zinc-800 text-zinc-100 hover:bg-zinc-700",
        outline: "border-zinc-700 text-zinc-300",
        amber: "border-transparent bg-amber-500/10 text-amber-500",
        red: "border-transparent bg-red-500/10 text-red-500",
        green: "border-transparent bg-emerald-500/10 text-emerald-500",
        blue: "border-transparent bg-sky-500/10 text-sky-500",
      },
    },
    defaultVariants: {
      variant: "secondary",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };

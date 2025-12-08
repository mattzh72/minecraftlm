import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(inputs.filter(Boolean).join(" "));
}

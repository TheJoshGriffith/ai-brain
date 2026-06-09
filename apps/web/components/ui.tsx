import type { ComponentProps } from "react";

export function Input(props: ComponentProps<"input">) {
  return (
    <input
      {...props}
      className={
        "w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm " +
        "outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 " +
        "dark:border-gray-700 dark:bg-gray-900 " +
        (props.className ?? "")
      }
    />
  );
}

export function Label(props: ComponentProps<"label">) {
  return (
    <label
      {...props}
      className={"block text-sm font-medium text-gray-700 dark:text-gray-300 " + (props.className ?? "")}
    />
  );
}

export function Button({
  variant = "primary",
  ...props
}: ComponentProps<"button"> & { variant?: "primary" | "ghost" | "danger" }) {
  const styles = {
    primary: "bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50",
    ghost: "border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800",
    danger: "text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40",
  }[variant];
  return (
    <button
      {...props}
      className={
        "inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium " +
        "transition-colors disabled:cursor-not-allowed " +
        styles +
        " " +
        (props.className ?? "")
      }
    />
  );
}

export function Card(props: ComponentProps<"div">) {
  return (
    <div
      {...props}
      className={
        "rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900 " +
        (props.className ?? "")
      }
    />
  );
}

export function FieldError({ children }: { children?: string }) {
  if (!children) return null;
  return <p className="text-sm text-red-600">{children}</p>;
}

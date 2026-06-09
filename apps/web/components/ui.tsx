import type { ComponentProps } from "react";

export function Input(props: ComponentProps<"input">) {
  const { className, ...rest } = props;
  return <input {...rest} className={`field ${className ?? ""}`} />;
}

export function Textarea(props: ComponentProps<"textarea">) {
  const { className, ...rest } = props;
  return <textarea {...rest} className={`field-area ${className ?? ""}`} />;
}

export function Label(props: ComponentProps<"label">) {
  const { className, ...rest } = props;
  return <label {...rest} className={`form-label ${className ?? ""}`} />;
}

export function Button({
  variant = "primary",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: "primary" | "ghost" | "danger" }) {
  const variantClass = {
    primary: "btn btn-primary",
    ghost: "btn btn-ghost",
    danger: "btn btn-danger",
  }[variant];
  return <button {...props} className={`${variantClass} ${className ?? ""}`} />;
}

export function Card(props: ComponentProps<"div">) {
  const { className, ...rest } = props;
  return <div {...rest} className={`card ${className ?? ""}`} />;
}

export function FieldError({ children }: { children?: string }) {
  if (!children) return null;
  return <p className="field-error">{children}</p>;
}

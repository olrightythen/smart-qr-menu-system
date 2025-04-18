import * as React from "react";

const buttonBase =
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";

const variantClasses = {
  default: "bg-primary text-primary-foreground hover:bg-primary/90",
  destructive:
    "bg-destructive text-destructive-foreground hover:bg-destructive/90",
  outline:
    "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
  secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
  ghost: "hover:bg-accent hover:text-accent-foreground",
  link: "text-primary underline-offset-4 hover:underline",
};

const sizeClasses = {
  default: "h-10 px-4 py-2",
  sm: "h-9 rounded-md px-3",
  lg: "h-11 rounded-md px-8",
  icon: "h-10 w-10",
};

function mergeClasses(...classes) {
  return classes.filter(Boolean).join(" ");
}

const Button = React.forwardRef(
  (
    {
      className,
      variant = "default",
      size = "default",
      asChild = false,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? React.Fragment : "button";
    const combinedClassName = mergeClasses(
      buttonBase,
      variantClasses[variant],
      sizeClasses[size],
      className
    );

    if (asChild) {
      // If using Fragment, clone the child to apply className and props
      const child = React.Children.only(props.children);
      return React.cloneElement(child, {
        className: mergeClasses(child.props.className, combinedClassName),
        ref,
        ...props,
      });
    }

    return <Comp className={combinedClassName} ref={ref} {...props} />;
  }
);

Button.displayName = "Button";

export { Button };

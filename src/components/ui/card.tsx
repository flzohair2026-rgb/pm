import * as React from "react"

import { cn } from "@/lib/utils"

function Card({
  className,
  size = "default",
  ...props
}: React.ComponentProps<"div"> & { size?: "default" | "sm"; asChild?: boolean }) {
  const { asChild, children, ...restProps } = props as any;
  if (!asChild || !React.isValidElement(children)) {
    return (
      <div
        data-slot="card"
        data-size={size}
        className={cn(
          "group/card flex flex-col gap-(--card-spacing) overflow-hidden rounded-lg bg-card py-(--card-spacing) text-xs/relaxed text-card-foreground ring-1 ring-foreground/10 [--card-spacing:--spacing(4)] has-[>img:first-child]:pt-0 data-[size=sm]:[--card-spacing:--spacing(3)] *:[img:first-child]:rounded-t-lg *:[img:last-child]:rounded-b-lg",
          className
        )}
        {...restProps}
      >
        {children}
      </div>
    );
  }
  const child = children as React.ReactElement<any>;
  return React.cloneElement(child, {
    "data-slot": "card",
    "data-size": size,
    ...restProps,
    ...child.props,
    className: cn(
      "group/card flex flex-col gap-(--card-spacing) overflow-hidden rounded-lg bg-card py-(--card-spacing) text-xs/relaxed text-card-foreground ring-1 ring-foreground/10 [--card-spacing:--spacing(4)] has-[>img:first-child]:pt-0 data-[size=sm]:[--card-spacing:--spacing(3)] *:[img:first-child]:rounded-t-lg *:[img:last-child]:rounded-b-lg",
      className,
      child.props.className
    ),
  });
}

function CardHeader({ className, ...props }: React.ComponentProps<"div"> & { asChild?: boolean }) {
  const { asChild, children, ...restProps } = props as any;
  if (!asChild || !React.isValidElement(children)) {
    return (
      <div
        data-slot="card-header"
        className={cn(
          "group/card-header @container/card-header grid auto-rows-min items-start gap-1 rounded-t-lg px-(--card-spacing) has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-(--card-spacing)",
          className
        )}
        {...restProps}
      >
        {children}
      </div>
    );
  }
  const child = children as React.ReactElement<any>;
  return React.cloneElement(child, {
    "data-slot": "card-header",
    ...restProps,
    ...child.props,
    className: cn(
      "group/card-header @container/card-header grid auto-rows-min items-start gap-1 rounded-t-lg px-(--card-spacing) has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-(--card-spacing)",
      className,
      child.props.className
    ),
  });
}

function CardTitle({ className, ...props }: React.ComponentProps<"div"> & { asChild?: boolean }) {
  const { asChild, children, ...restProps } = props as any;
  if (!asChild || !React.isValidElement(children)) {
    return (
      <div
        data-slot="card-title"
        className={cn("font-heading text-sm font-medium", className)}
        {...restProps}
      >
        {children}
      </div>
    );
  }
  const child = children as React.ReactElement<any>;
  return React.cloneElement(child, {
    "data-slot": "card-title",
    ...restProps,
    ...child.props,
    className: cn("font-heading text-sm font-medium", className, child.props.className),
  });
}

function CardDescription({ className, ...props }: React.ComponentProps<"div"> & { asChild?: boolean }) {
  const { asChild, children, ...restProps } = props as any;
  if (!asChild || !React.isValidElement(children)) {
    return (
      <div
        data-slot="card-description"
        className={cn("text-xs/relaxed text-muted-foreground", className)}
        {...restProps}
      >
        {children}
      </div>
    );
  }
  const child = children as React.ReactElement<any>;
  return React.cloneElement(child, {
    "data-slot": "card-description",
    ...restProps,
    ...child.props,
    className: cn("text-xs/relaxed text-muted-foreground", className, child.props.className),
  });
}

function CardAction({ className, ...props }: React.ComponentProps<"div"> & { asChild?: boolean }) {
  const { asChild, children, ...restProps } = props as any;
  if (!asChild || !React.isValidElement(children)) {
    return (
      <div
        data-slot="card-action"
        className={cn(
          "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
          className
        )}
        {...restProps}
      >
        {children}
      </div>
    );
  }
  const child = children as React.ReactElement<any>;
  return React.cloneElement(child, {
    "data-slot": "card-action",
    ...restProps,
    ...child.props,
    className: cn(
      "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
      className,
      child.props.className
    ),
  });
}

function CardContent({ className, ...props }: React.ComponentProps<"div"> & { asChild?: boolean }) {
  const { asChild, children, ...restProps } = props as any;
  if (!asChild || !React.isValidElement(children)) {
    return (
      <div
        data-slot="card-content"
        className={cn("px-(--card-spacing)", className)}
        {...restProps}
      >
        {children}
      </div>
    );
  }
  const child = children as React.ReactElement<any>;
  return React.cloneElement(child, {
    "data-slot": "card-content",
    ...restProps,
    ...child.props,
    className: cn("px-(--card-spacing)", className, child.props.className),
  });
}

function CardFooter({ className, ...props }: React.ComponentProps<"div"> & { asChild?: boolean }) {
  const { asChild, children, ...restProps } = props as any;
  if (!asChild || !React.isValidElement(children)) {
    return (
      <div
        data-slot="card-footer"
        className={cn(
          "flex items-center rounded-b-lg px-(--card-spacing) [.border-t]:pt-(--card-spacing)",
          className
        )}
        {...restProps}
      >
        {children}
      </div>
    );
  }
  const child = children as React.ReactElement<any>;
  return React.cloneElement(child, {
    "data-slot": "card-footer",
    ...restProps,
    ...child.props,
    className: cn(
      "flex items-center rounded-b-lg px-(--card-spacing) [.border-t]:pt-(--card-spacing)",
      className,
      child.props.className
    ),
  });
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
}

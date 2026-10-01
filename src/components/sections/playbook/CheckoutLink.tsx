"use client";

import { Button } from "@/components/ui/Button";
import { trackCheckoutClick } from "@/lib/tracking/funnel-events";

interface CheckoutLinkProps {
  href: string;
  placement: string;
  className?: string;
  children: React.ReactNode;
}

export function CheckoutLink({
  href,
  placement,
  className,
  children,
}: CheckoutLinkProps) {
  return (
    <Button
      href={href}
      size="lg"
      showArrow
      className={className}
      onClick={() => trackCheckoutClick(placement, href)}
    >
      {children}
    </Button>
  );
}

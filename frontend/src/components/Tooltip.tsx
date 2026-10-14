import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';

interface TooltipProps {
  content: string;
  children: ReactNode;
  className?: string;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'auto';
  placement?: 'top' | 'bottom' | 'left' | 'right';
}

type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

export function Tooltip({ content, children, className = '', position, placement = 'top' }: TooltipProps) {
  const [show, setShow] = useState(false);
  const [actualPosition, setActualPosition] = useState<TooltipPosition>(
    position === 'auto' ? 'top' : (position || placement),
  );
  const [style, setStyle] = useState<CSSProperties>({ top: -9999, left: -9999 });
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const tooltipId = useId();
  const requestedPosition = position || placement;

  useEffect(() => {
    if (!show || !triggerRef.current || !tooltipRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const gap = 8;
    const viewportPadding = 8;
    let nextPosition: TooltipPosition = requestedPosition === 'auto' ? 'top' : requestedPosition;

    if (requestedPosition === 'auto') {
      const spaceTop = triggerRect.top;
      const spaceBottom = window.innerHeight - triggerRect.bottom;
      const spaceLeft = triggerRect.left;
      const spaceRight = window.innerWidth - triggerRect.right;

      if (spaceTop >= tooltipRect.height + gap) nextPosition = 'top';
      else if (spaceBottom >= tooltipRect.height + gap) nextPosition = 'bottom';
      else if (spaceRight >= tooltipRect.width + gap) nextPosition = 'right';
      else if (spaceLeft >= tooltipRect.width + gap) nextPosition = 'left';
      else nextPosition = spaceBottom >= spaceTop ? 'bottom' : 'top';
    }

    let top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
    let left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
    if (nextPosition === 'top') top = triggerRect.top - tooltipRect.height - gap;
    if (nextPosition === 'bottom') top = triggerRect.bottom + gap;
    if (nextPosition === 'left') left = triggerRect.left - tooltipRect.width - gap;
    if (nextPosition === 'right') left = triggerRect.right + gap;

    setActualPosition(nextPosition);
    setStyle({
      top: Math.min(Math.max(top, viewportPadding), window.innerHeight - tooltipRect.height - viewportPadding),
      left: Math.min(Math.max(left, viewportPadding), window.innerWidth - tooltipRect.width - viewportPadding),
    });

    const updatePosition = () => setShow((visible) => {
      if (!visible) return visible;
      requestAnimationFrame(() => {
        const trigger = triggerRef.current?.getBoundingClientRect();
        const tooltip = tooltipRef.current?.getBoundingClientRect();
        if (!trigger || !tooltip) return;
        let adjustedTop = trigger.top - tooltip.height - gap;
        if (actualPosition === 'bottom') adjustedTop = trigger.bottom + gap;
        else if (actualPosition === 'left' || actualPosition === 'right') {
          adjustedTop = trigger.top + (trigger.height - tooltip.height) / 2;
        }
        let adjustedLeft = trigger.left + (trigger.width - tooltip.width) / 2;
        if (actualPosition === 'left') adjustedLeft = trigger.left - tooltip.width - gap;
        if (actualPosition === 'right') adjustedLeft = trigger.right + gap;
        setStyle({
          top: Math.min(Math.max(adjustedTop, viewportPadding), window.innerHeight - tooltip.height - viewportPadding),
          left: Math.min(Math.max(adjustedLeft, viewportPadding), window.innerWidth - tooltip.width - viewportPadding),
        });
      });
      return visible;
    });
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [show, requestedPosition, actualPosition]);

  return (
    <span
      ref={triggerRef}
      className={`group/tooltip relative inline-flex ${className}`}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setShow(false);
      }}
    >
      {children}
      {show && (
        <div
          ref={tooltipRef}
          id={tooltipId}
          role="tooltip"
          style={style}
          className="pointer-events-none fixed z-[100] w-max max-w-[min(280px,calc(100vw-16px))] whitespace-normal break-words rounded-lg border border-surface-border bg-surface-light px-3 py-2 text-xs font-normal normal-case tracking-normal text-text shadow-lg"
        >
          {content}
        </div>
      )}
    </span>
  );
}

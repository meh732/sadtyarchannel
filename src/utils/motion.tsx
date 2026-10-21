import React from 'react';

export interface MotionProps extends React.HTMLAttributes<HTMLDivElement> {
  initial?: any;
  animate?: any;
  exit?: any;
  transition?: any;
  whileHover?: any;
  whileTap?: any;
  layout?: boolean | string;
  children?: React.ReactNode;
}

export const AnimatePresence: React.FC<{ children: React.ReactNode; mode?: string }> = ({ children }) => {
  return <>{children}</>;
};

export const motion = {
  div: React.forwardRef<HTMLDivElement, MotionProps>(({
    initial,
    animate,
    exit,
    transition,
    whileHover,
    whileTap,
    layout,
    children,
    className = '',
    ...props
  }, ref) => {
    return (
      <div ref={ref} className={className} {...props}>
        {children}
      </div>
    );
  }),
  button: React.forwardRef<HTMLButtonElement, any>(({
    initial,
    animate,
    exit,
    transition,
    whileHover,
    whileTap,
    layout,
    children,
    className = '',
    ...props
  }, ref) => {
    return (
      <button ref={ref} className={className} {...props}>
        {children}
      </button>
    );
  }),
  span: React.forwardRef<HTMLSpanElement, any>(({
    initial,
    animate,
    exit,
    transition,
    whileHover,
    whileTap,
    layout,
    children,
    className = '',
    ...props
  }, ref) => {
    return (
      <span ref={ref} className={className} {...props}>
        {children}
      </span>
    );
  })
};

export default motion;

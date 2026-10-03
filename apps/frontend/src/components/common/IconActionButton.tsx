import { ButtonHTMLAttributes } from 'react';

type ActionVariant = 'edit' | 'delete' | 'lock';

const icons: Record<ActionVariant, JSX.Element> = {
  edit: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 3.487a2.1 2.1 0 0 1 2.97 2.97L8.25 18.04l-4 1 1-4L16.862 3.487z" />
    </svg>
  ),
  delete: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 7h12M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-7 0v12a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V7M10 11v6M14 11v6" />
    </svg>
  ),
  lock: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 10V8a5 5 0 0 1 10 0v2m-9 0h8a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2z" />
    </svg>
  ),
};

const variantClasses: Record<ActionVariant, string> = {
  edit: 'text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:text-gray-400 dark:hover:text-blue-400 dark:hover:bg-blue-900/20',
  delete: 'text-gray-500 hover:text-red-600 hover:bg-red-50 dark:text-gray-400 dark:hover:text-red-400 dark:hover:bg-red-900/20 disabled:opacity-40 disabled:pointer-events-none',
  lock: 'text-gray-400 dark:text-gray-500',
};

interface IconActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant: ActionVariant;
  label: string;
}

export const IconActionButton = ({
  variant,
  label,
  className = '',
  ...props
}: IconActionButtonProps) => {
  if (variant === 'lock') {
    return (
      <span
        title={label}
        aria-label={label}
        className={`inline-flex items-center justify-center w-8 h-8 rounded-md ${variantClasses.lock} ${className}`}
      >
        {icons.lock}
      </span>
    );
  }

  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={`inline-flex items-center justify-center w-8 h-8 rounded-md transition-colors ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {icons[variant]}
    </button>
  );
};

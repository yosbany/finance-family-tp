import { ReactNode, useEffect, useRef } from 'react';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  minHeightClass?: string;
}

const ToolbarButton = ({
  children,
  title,
  onMouseDown,
}: {
  children: ReactNode;
  title: string;
  onMouseDown: () => void;
}) => (
  <button
    type="button"
    title={title}
    onMouseDown={(e) => {
      e.preventDefault();
      onMouseDown();
    }}
    className="min-w-[1.75rem] px-2 py-1 text-sm rounded text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
  >
    {children}
  </button>
);

export const RichTextEditor = ({
  value,
  onChange,
  placeholder = 'Escribe una descripción…',
  className = '',
  minHeightClass = 'min-h-[160px]',
}: RichTextEditorProps) => {
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (el.innerHTML !== value) {
      el.innerHTML = value || '';
    }
  }, [value]);

  const run = (command: string, arg?: string) => {
    document.execCommand(command, false, arg);
    editorRef.current?.focus();
    onChange(editorRef.current?.innerHTML || '');
  };

  const handleInput = () => {
    onChange(editorRef.current?.innerHTML || '');
  };

  const isEmpty = !value || value === '<br>' || value === '<div><br></div>';

  return (
    <div
      className={`border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden bg-white dark:bg-gray-700 ${className}`}
    >
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/80">
        <ToolbarButton title="Negrita" onMouseDown={() => run('bold')}>
          <strong>B</strong>
        </ToolbarButton>
        <ToolbarButton title="Cursiva" onMouseDown={() => run('italic')}>
          <em>I</em>
        </ToolbarButton>
        <ToolbarButton title="Subrayado" onMouseDown={() => run('underline')}>
          <span className="underline">U</span>
        </ToolbarButton>
        <span className="mx-1 h-4 w-px bg-gray-300 dark:bg-gray-600" />
        <ToolbarButton title="Lista" onMouseDown={() => run('insertUnorderedList')}>
          • Lista
        </ToolbarButton>
        <ToolbarButton title="Lista numerada" onMouseDown={() => run('insertOrderedList')}>
          1. Lista
        </ToolbarButton>
        <span className="mx-1 h-4 w-px bg-gray-300 dark:bg-gray-600" />
        <ToolbarButton title="Título" onMouseDown={() => run('formatBlock', 'h3')}>
          H
        </ToolbarButton>
        <ToolbarButton title="Párrafo" onMouseDown={() => run('formatBlock', 'p')}>
          ¶
        </ToolbarButton>
        <ToolbarButton
          title="Enlace"
          onMouseDown={() => {
            const url = window.prompt('URL del enlace:');
            if (url) run('createLink', url);
          }}
        >
          Link
        </ToolbarButton>
        <ToolbarButton title="Quitar formato" onMouseDown={() => run('removeFormat')}>
          Limpiar
        </ToolbarButton>
      </div>

      <div className="relative">
        {isEmpty && (
          <div className="pointer-events-none absolute left-3 top-3 text-sm text-gray-400 dark:text-gray-500">
            {placeholder}
          </div>
        )}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          className={`${minHeightClass} max-h-[320px] overflow-y-auto px-3 py-3 text-sm text-gray-900 dark:text-white focus:outline-none max-w-none [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-blue-600 [&_a]:underline [&_h3]:text-base [&_h3]:font-semibold`}
          role="textbox"
          aria-multiline="true"
        />
      </div>
    </div>
  );
};

/** Sanitiza HTML básico de descripciones controladas por el usuario. */
export const sanitizeRichText = (html: string): string => {
  if (!html) return '';
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\son\w+='[^']*'/gi, '')
    .replace(/javascript:/gi, '');
};

export const isRichTextEmpty = (html?: string): boolean => {
  if (!html) return true;
  const text = html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
  return text.length === 0;
};

import React, { useMemo } from 'react';
import katex from 'katex';

interface MathRendererProps {
  text: string | null | undefined;
  className?: string;
  inline?: boolean;
}

/**
 * Parses a string that may contain LaTeX math delimiters:
 * - $$...$$ or \[...\] for block/display math
 * - $...$ or \(...\) for inline math
 * and renders math using KaTeX, leaving regular text intact.
 */
export const MathRenderer: React.FC<MathRendererProps> = ({
  text,
  className = '',
  inline = false,
}) => {
  const renderedElements = useMemo(() => {
    if (!text || typeof text !== 'string') {
      return null;
    }

    // Regular expression to match display math $$...$$ or \[...\], and inline math $...$ or \(...\)
    // Avoid matching empty $$ or single $ in non-math contexts like currency "$10"
    const regex = /(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\$(?:\\\$|[^\$\n])+?\$|\\\([\s\S]*?\\\))/g;

    const parts = text.split(regex);

    return parts.map((part, index) => {
      if (!part) return null;

      let isBlock = false;
      let mathContent: string | null = null;

      if (part.startsWith('$$') && part.endsWith('$$') && part.length >= 4) {
        isBlock = true;
        mathContent = part.slice(2, -2).trim();
      } else if (part.startsWith('\\[') && part.endsWith('\\]') && part.length >= 4) {
        isBlock = true;
        mathContent = part.slice(2, -2).trim();
      } else if (part.startsWith('$') && part.endsWith('$') && part.length >= 2) {
        isBlock = false;
        mathContent = part.slice(1, -1).trim();
      } else if (part.startsWith('\\(') && part.endsWith('\\)') && part.length >= 4) {
        isBlock = false;
        mathContent = part.slice(2, -2).trim();
      }

      if (mathContent !== null) {
        try {
          const html = katex.renderToString(mathContent, {
            displayMode: isBlock && !inline,
            throwOnError: false,
            strict: false,
            output: 'htmlAndMathml',
          });

          return (
            <span
              key={index}
              className={isBlock && !inline ? 'block my-2 overflow-x-auto text-center' : 'inline-block align-baseline mx-0.5'}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        } catch (err) {
          console.warn('KaTeX render error for:', mathContent, err);
          return <span key={index} className="font-mono text-indigo-600">{part}</span>;
        }
      }

      // Regular text: preserve line breaks
      const lines = part.split('\n');
      if (lines.length > 1) {
        return (
          <React.Fragment key={index}>
            {lines.map((line, lIdx) => (
              <React.Fragment key={lIdx}>
                {lIdx > 0 && <br />}
                {line}
              </React.Fragment>
            ))}
          </React.Fragment>
        );
      }

      return <span key={index}>{part}</span>;
    });
  }, [text, inline]);

  if (!text) return null;

  return (
    <span className={`math-rendered-content ${className}`}>
      {renderedElements}
    </span>
  );
};

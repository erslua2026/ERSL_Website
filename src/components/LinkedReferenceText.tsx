import React from 'react';
import { splitTextWithReferenceLinks } from '../lib/publicationUtils';

interface LinkedReferenceTextProps {
  text: string;
  linkClassName?: string;
}

/**
 * Renders text while automatically converting inline HTTP(S) URLs and DOIs
 * (`10.xxxx/...` or `doi:10.xxxx/...`) into clickable external links.
 */
export const LinkedReferenceText: React.FC<LinkedReferenceTextProps> = ({
  text,
  linkClassName = 'text-[#9E1B32] font-semibold underline hover:opacity-80 break-all',
}) => {
  const segments = splitTextWithReferenceLinks(text);
  return (
    <>
      {segments.map((seg, i) =>
        seg.type === 'link' && seg.href ? (
          <a
            key={i}
            href={seg.href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className={linkClassName}
          >
            {seg.text}
          </a>
        ) : (
          <React.Fragment key={i}>{seg.text}</React.Fragment>
        )
      )}
    </>
  );
};

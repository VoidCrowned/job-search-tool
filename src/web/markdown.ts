// Job descriptions come as Markdown from a third party: render, then sanitise before inserting.
import DOMPurify from 'dompurify';
import { marked } from 'marked';

let hooked = false;

export function renderMarkdown(source: string): string {
  if (!hooked) {
    // Links in ads open in a new tab and don't get access to this page.
    DOMPurify.addHook('afterSanitizeAttributes', (node) => {
      if (node.tagName === 'A') {
        node.setAttribute('target', '_blank');
        node.setAttribute('rel', 'noopener noreferrer');
      }
    });
    hooked = true;
  }
  const html = marked.parse(source, { async: false, breaks: true, gfm: true });
  return DOMPurify.sanitize(html, {
    FORBID_TAGS: ['img', 'style', 'iframe', 'form', 'input'],
    FORBID_ATTR: ['style'],
  });
}

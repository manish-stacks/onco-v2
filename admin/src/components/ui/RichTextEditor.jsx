import { useRef, useEffect, useState, useCallback } from 'react';
import {
  Bold, Italic, Underline, List, ListOrdered, Link2, Heading2, Heading3,
  Quote, Code2, Undo2, Redo2, Eraser, Eye,
} from 'lucide-react';
import { Button, cx } from './index';

/**
 * Halka rich text editor — koi external library nahi.
 * contenteditable + document.execCommand pe chalta hai.
 *
 * execCommand technically deprecated hai, lekin har browser me kaam karta hai
 * aur iske liye 100KB ki library kheenchne ka matlab nahi banta. Content
 * seedha HTML string ke roop me aata-jaata hai, jo backend `content` column
 * me waise hi store hota hai.
 */

const BLOCKS = [
  { cmd: 'formatBlock', value: '<h2>', icon: Heading2, title: 'Heading 2' },
  { cmd: 'formatBlock', value: '<h3>', icon: Heading3, title: 'Heading 3' },
  { cmd: 'formatBlock', value: '<blockquote>', icon: Quote, title: 'Quote' },
];

const INLINE = [
  { cmd: 'bold', icon: Bold, title: 'Bold (Ctrl+B)' },
  { cmd: 'italic', icon: Italic, title: 'Italic (Ctrl+I)' },
  { cmd: 'underline', icon: Underline, title: 'Underline (Ctrl+U)' },
];

const LISTS = [
  { cmd: 'insertUnorderedList', icon: List, title: 'Bullet list' },
  { cmd: 'insertOrderedList', icon: ListOrdered, title: 'Numbered list' },
];

export default function RichTextEditor({ value, onChange, rows = 12, placeholder }) {
  const ref = useRef(null);
  const [showHtml, setShowHtml] = useState(false);
  const [active, setActive] = useState({});

  // Bahar se value badle to andar sync karo — lekin sirf tab jab editor
  // focused na ho, warna typing ke beech cursor jump kar jaata hai
  useEffect(() => {
    const el = ref.current;
    if (!el || showHtml) return;
    if (document.activeElement === el) return;
    if (el.innerHTML !== (value || '')) el.innerHTML = value || '';
  }, [value, showHtml]);

  const sync = useCallback(() => {
    if (ref.current) onChange(ref.current.innerHTML);
  }, [onChange]);

  /** Toolbar buttons ka on/off state — cursor jahan hai uske hisaab se */
  const refreshActive = useCallback(() => {
    const state = {};
    ['bold', 'italic', 'underline', 'insertUnorderedList', 'insertOrderedList'].forEach((c) => {
      try { state[c] = document.queryCommandState(c); } catch { state[c] = false; }
    });
    setActive(state);
  }, []);

  const exec = (cmd, value2 = null) => {
    ref.current?.focus();
    document.execCommand(cmd, false, value2);
    sync();
    refreshActive();
  };

  const addLink = () => {
    const url = window.prompt('Link URL:', 'https://');
    if (url) exec('createLink', url);
  };

  /** Paste pe formatting strip — Word se copy karne pe gandi HTML aati hai */
  const onPaste = (e) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
    sync();
  };

  const onKeyDown = (e) => {
    // Tab se focus na bhaage — indent kare
    if (e.key === 'Tab') {
      e.preventDefault();
      exec('insertText', '    ');
    }
  };

  const ToolBtn = ({ icon: Icon, title, onClick, isActive }) => (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()} // selection na toote
      onClick={onClick}
      className={cx(
        'p-1.5 rounded transition-colors',
        isActive ? 'bg-teal-light text-teal-dark' : 'text-ink-500 hover:bg-paper-sunk hover:text-ink'
      )}
    >
      <Icon size={14} />
    </button>
  );

  const Divider = () => <span className="w-px h-5 bg-line mx-0.5" />;

  return (
    <div className="border border-line rounded overflow-hidden bg-white focus-within:border-teal focus-within:ring-1 focus-within:ring-teal transition-colors">
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-line bg-paper">
        {INLINE.map((b) => (
          <ToolBtn key={b.cmd} icon={b.icon} title={b.title}
            isActive={active[b.cmd]} onClick={() => exec(b.cmd)} />
        ))}
        <Divider />
        {BLOCKS.map((b) => (
          <ToolBtn key={b.value} icon={b.icon} title={b.title}
            onClick={() => exec(b.cmd, b.value)} />
        ))}
        <ToolBtn icon={Code2} title="Paragraph" onClick={() => exec('formatBlock', '<p>')} />
        <Divider />
        {LISTS.map((b) => (
          <ToolBtn key={b.cmd} icon={b.icon} title={b.title}
            isActive={active[b.cmd]} onClick={() => exec(b.cmd)} />
        ))}
        <ToolBtn icon={Link2} title="Insert link" onClick={addLink} />
        <Divider />
        <ToolBtn icon={Eraser} title="Clear formatting" onClick={() => exec('removeFormat')} />
        <ToolBtn icon={Undo2} title="Undo" onClick={() => exec('undo')} />
        <ToolBtn icon={Redo2} title="Redo" onClick={() => exec('redo')} />

        <span className="flex-1" />

        <button
          type="button"
          onClick={() => setShowHtml((v) => !v)}
          className={cx(
            'flex items-center gap-1 px-2 py-1 rounded text-2xs font-medium transition-colors',
            showHtml ? 'bg-ink text-white' : 'text-ink-500 hover:bg-paper-sunk'
          )}
        >
          <Eye size={12} /> {showHtml ? 'Editor' : 'HTML'}
        </button>
      </div>

      {showHtml ? (
        <textarea
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          spellCheck={false}
          className="w-full px-3 py-2.5 font-mono text-2xs text-ink resize-y outline-none leading-relaxed"
        />
      ) : (
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          onInput={sync}
          onBlur={sync}
          onPaste={onPaste}
          onKeyDown={onKeyDown}
          onKeyUp={refreshActive}
          onMouseUp={refreshActive}
          data-placeholder={placeholder || 'Yahan likhna shuru karo…'}
          style={{ minHeight: `${rows * 1.6}rem` }}
          className="prose-editor px-3 py-2.5 text-sm text-ink outline-none overflow-y-auto max-h-[28rem]"
        />
      )}
    </div>
  );
}

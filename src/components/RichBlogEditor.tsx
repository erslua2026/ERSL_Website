import React, { useEffect, useRef, useState } from 'react';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Code,
  Eraser,
  Highlighter,
  Italic,
  Link2,
  List,
  ListOrdered,
  Palette,
  Quote,
  Redo2,
  Sigma,
  Strikethrough,
  Subscript,
  Superscript,
  Table as TableIcon,
  Trash2,
  Underline,
  Undo2,
} from 'lucide-react';
import {
  ensureKatexLoaded,
  plainTextToInitialHtml,
  renderEquationToHtml,
  sanitizeRichHtml,
} from '../lib/richTextUtils';

interface RichBlogEditorProps {
  value: string;
  onChange: (nextHtml: string) => void;
  placeholder?: string;
  minHeightClass?: string;
}

const FONT_FAMILIES = [
  { label: 'Default (Sans)', value: '' },
  { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Calibri / Segoe UI', value: 'Calibri, "Segoe UI", sans-serif' },
  { label: 'Georgia (Serif)', value: 'Georgia, Cambria, "Times New Roman", serif' },
  { label: 'Times New Roman', value: '"Times New Roman", Times, serif' },
  { label: 'Verdana', value: 'Verdana, Geneva, sans-serif' },
  { label: 'Courier New (Mono)', value: '"Courier New", Courier, monospace' },
];

const FONT_SIZES = [
  { label: 'Small (12px)', value: '12px' },
  { label: 'Compact (14px)', value: '14px' },
  { label: 'Normal (15px)', value: '15px' },
  { label: 'Medium (18px)', value: '18px' },
  { label: 'Large (22px)', value: '22px' },
  { label: 'Heading (26px)', value: '26px' },
];

const TEXT_COLORS = [
  '#0f172a',
  '#9E1B32',
  '#1d4ed8',
  '#0f766e',
  '#15803d',
  '#b45309',
  '#6d28d9',
  '#475569',
];

const HIGHLIGHT_COLORS = [
  { label: 'None', value: 'transparent' },
  { label: 'Yellow', value: '#fef08a' },
  { label: 'Mint', value: '#bbf7d0' },
  { label: 'Sky', value: '#bae6fd' },
  { label: 'Rose', value: '#fecdd3' },
  { label: 'Lavender', value: '#e9d5ff' },
];

const EQUATION_SHORTCUTS: Array<{ label: string; snippet: string }> = [
  { label: 'Fraction a/b', snippet: '\\frac{a}{b}' },
  { label: 'R²', snippet: 'R^2' },
  { label: 'Sum ∑', snippet: '\\sum_{i=1}^{n}' },
  { label: 'Integral ∫', snippet: '\\int_{a}^{b}' },
  { label: '√', snippet: '\\sqrt{x}' },
  { label: '±', snippet: '\\pm' },
  { label: '×', snippet: '\\times' },
  { label: '≤', snippet: '\\leq' },
  { label: '≥', snippet: '\\geq' },
  { label: '≈', snippet: '\\approx' },
  { label: 'α', snippet: '\\alpha' },
  { label: 'β', snippet: '\\beta' },
  { label: 'λ', snippet: '\\lambda' },
  { label: 'σ', snippet: '\\sigma' },
  { label: 'ρ', snippet: '\\rho' },
  { label: 'TSS Example', snippet: 'TSS = a \\cdot \\left(\\frac{R_{rs}(640)}{R_{rs}(471)}\\right)^b' },
];

export const RichBlogEditor: React.FC<RichBlogEditorProps> = ({
  value,
  onChange,
  placeholder = 'Write formatted paragraphs, insert tables, equations, fonts, colors, or justify text...',
  minHeightClass = 'min-h-[210px]',
}) => {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const savedRangeRef = useRef<Range | null>(null);
  const lastEmittedRef = useRef<string>('');
  const editingEqElRef = useRef<HTMLElement | null>(null);

  const [inTable, setInTable] = useState(false);
  const [sourceMode, setSourceMode] = useState(false);
  const [rawSource, setRawSource] = useState('');
  const [activePopover, setActivePopover] = useState<
    null | 'color' | 'highlight' | 'table' | 'equation' | 'link'
  >(null);

  // Table insertion controls
  const [tblRows, setTblRows] = useState(3);
  const [tblCols, setTblCols] = useState(3);
  const [tblHeader, setTblHeader] = useState(true);

  // Equation insertion controls
  const [eqLatex, setEqLatex] = useState('TSS = a \\cdot R_{rs}(640) + b');
  const [eqDisplayMode, setEqDisplayMode] = useState<'inline' | 'block'>('block');
  const [katexTick, setKatexTick] = useState(0);

  // Link insertion controls
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');

  // Custom color pickers
  const [customTextColor, setCustomTextColor] = useState('#9E1B32');
  const [customHighlightColor, setCustomHighlightColor] = useState('#fef08a');

  const hydrateKatexNodesInsideEditor = async () => {
    const root = editorRef.current;
    if (!root) return;
    const nodes = root.querySelectorAll('[data-latex]');
    if (nodes.length === 0) return;
    await ensureKatexLoaded();
    nodes.forEach(node => {
      const el = node as HTMLElement;
      const latex = el.getAttribute('data-latex') || '';
      const isBlock = el.getAttribute('data-display') === 'block' || el.tagName.toLowerCase() === 'div';
      el.setAttribute('contenteditable', 'false');
      el.innerHTML = renderEquationToHtml(latex, isBlock);
    });
  };

  useEffect(() => {
    const normalized = plainTextToInitialHtml(value);
    if (value === lastEmittedRef.current) return;
    lastEmittedRef.current = value;
    if (editorRef.current && editorRef.current.innerHTML !== normalized) {
      editorRef.current.innerHTML = normalized;
      hydrateKatexNodesInsideEditor();
    }
    if (sourceMode) {
      setRawSource(normalized);
    }
  }, [value]);

  useEffect(() => {
    if (activePopover === 'equation') {
      ensureKatexLoaded().then(() => setKatexTick(t => t + 1));
    }
  }, [activePopover]);

  const emitCleanedHtml = () => {
    const root = editorRef.current;
    if (!root) return;
    const cleaned = sanitizeRichHtml(root.innerHTML);
    lastEmittedRef.current = cleaned;
    onChange(cleaned);
  };

  const saveSelection = () => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !editorRef.current) return;
    const range = sel.getRangeAt(0);
    if (editorRef.current.contains(range.commonAncestorContainer)) {
      savedRangeRef.current = range.cloneRange();
      const anchorEl =
        range.startContainer.nodeType === Node.ELEMENT_NODE
          ? (range.startContainer as HTMLElement)
          : range.startContainer.parentElement;
      setInTable(Boolean(anchorEl?.closest('table')));
    }
  };

  const restoreSelection = () => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    const sel = window.getSelection();
    if (!sel) return;
    if (savedRangeRef.current && editor.contains(savedRangeRef.current.commonAncestorContainer)) {
      sel.removeAllRanges();
      sel.addRange(savedRangeRef.current);
    } else {
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
      savedRangeRef.current = range;
    }
  };

  const execCmd = (cmd: string, cmdValue?: string) => {
    restoreSelection();
    try {
      document.execCommand('styleWithCSS', false, 'true');
    } catch {
      // Some browsers ignore styleWithCSS
    }
    document.execCommand(cmd, false, cmdValue);
    saveSelection();
    emitCleanedHtml();
  };

  const applyInlineStyleToSelection = (prop: 'fontSize' | 'fontFamily' | 'code', val: string) => {
    restoreSelection();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);

    if (prop === 'fontFamily') {
      if (!val) {
        execCmd('removeFormat');
        return;
      }
      if (range.collapsed) {
        const span = document.createElement('span');
        span.style.fontFamily = val;
        span.innerHTML = '&#8203;';
        range.insertNode(span);
        range.setStart(span.firstChild!, 1);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
      } else {
        execCmd('fontName', val);
      }
      saveSelection();
      emitCleanedHtml();
      return;
    }

    if (prop === 'code') {
      const text = range.toString() || 'code';
      const code = document.createElement('code');
      code.textContent = text;
      range.deleteContents();
      range.insertNode(code);
      range.setStartAfter(code);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
      saveSelection();
      emitCleanedHtml();
      return;
    }

    // Font size in px
    if (range.collapsed) {
      const span = document.createElement('span');
      span.style.fontSize = val;
      span.innerHTML = '&#8203;';
      range.insertNode(span);
      range.setStart(span.firstChild!, 1);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    } else {
      const span = document.createElement('span');
      span.style.fontSize = val;
      try {
        span.appendChild(range.extractContents());
        range.insertNode(span);
        range.selectNodeContents(span);
        sel.removeAllRanges();
        sel.addRange(range);
      } catch {
        execCmd('fontSize', '4');
      }
    }
    saveSelection();
    emitCleanedHtml();
  };

  const insertHtmlAtCursor = (html: string) => {
    restoreSelection();
    document.execCommand('insertHTML', false, html);
    saveSelection();
    emitCleanedHtml();
  };

  const handleInsertTable = () => {
    const rows = Math.max(1, Math.min(12, Number(tblRows) || 3));
    const cols = Math.max(1, Math.min(8, Number(tblCols) || 3));
    let html = '<table class="ersl-rich-table">';
    if (tblHeader) {
      html += '<thead><tr>';
      for (let c = 0; c < cols; c++) {
        html += `<th>Column ${c + 1}</th>`;
      }
      html += '</tr></thead>';
    }
    html += '<tbody>';
    const bodyRows = tblHeader ? Math.max(1, rows - 1) : rows;
    for (let r = 0; r < bodyRows; r++) {
      html += '<tr>';
      for (let c = 0; c < cols; c++) {
        html += '<td>Cell</td>';
      }
      html += '</tr>';
    }
    html += '</tbody></table><p><br /></p>';
    insertHtmlAtCursor(html);
    setActivePopover(null);
  };

  const modifyActiveTable = (op: 'add-row' | 'del-row' | 'add-col' | 'del-col' | 'del-table') => {
    restoreSelection();
    const sel = window.getSelection();
    const anchor = sel?.anchorNode;
    const anchorEl = anchor?.nodeType === Node.ELEMENT_NODE ? (anchor as HTMLElement) : anchor?.parentElement;
    const cell = anchorEl?.closest('td, th') as HTMLTableCellElement | null;
    const row = anchorEl?.closest('tr') as HTMLTableRowElement | null;
    const table = anchorEl?.closest('table') as HTMLTableElement | null;
    if (!table) return;

    if (op === 'del-table') {
      table.remove();
      setInTable(false);
      emitCleanedHtml();
      return;
    }

    if (op === 'add-row' && row) {
      const newRow = document.createElement('tr');
      const colCount = row.children.length || 1;
      for (let i = 0; i < colCount; i++) {
        const td = document.createElement('td');
        td.textContent = 'Cell';
        newRow.appendChild(td);
      }
      row.parentElement?.insertBefore(newRow, row.nextSibling);
    } else if (op === 'del-row' && row) {
      if (table.querySelectorAll('tr').length <= 1) {
        table.remove();
        setInTable(false);
      } else {
        row.remove();
      }
    } else if (op === 'add-col' && cell) {
      const colIdx = cell.cellIndex;
      table.querySelectorAll('tr').forEach(tr => {
        const isHead = tr.parentElement?.tagName.toLowerCase() === 'thead' || Boolean(tr.querySelector('th'));
        const newCell = document.createElement(isHead ? 'th' : 'td');
        newCell.textContent = isHead ? 'Column' : 'Cell';
        const ref = tr.children[colIdx + 1] || null;
        tr.insertBefore(newCell, ref);
      });
    } else if (op === 'del-col' && cell) {
      const colIdx = cell.cellIndex;
      const firstRowCols = table.querySelector('tr')?.children.length || 0;
      if (firstRowCols <= 1) {
        table.remove();
        setInTable(false);
      } else {
        table.querySelectorAll('tr').forEach(tr => {
          const target = tr.children[colIdx];
          if (target) target.remove();
        });
      }
    }
    emitCleanedHtml();
  };

  const handleInsertOrUpdateEquation = async () => {
    const clean = eqLatex.trim();
    if (!clean) return;
    await ensureKatexLoaded();
    const isBlock = eqDisplayMode === 'block';

    if (editingEqElRef.current && editorRef.current?.contains(editingEqElRef.current)) {
      const existing = editingEqElRef.current;
      existing.setAttribute('data-latex', clean);
      existing.setAttribute('data-display', isBlock ? 'block' : 'inline');
      existing.className = isBlock ? 'ersl-eq-block' : 'ersl-eq-inline';
      existing.setAttribute('contenteditable', 'false');
      existing.innerHTML = renderEquationToHtml(clean, isBlock);
      editingEqElRef.current = null;
      emitCleanedHtml();
      setActivePopover(null);
      return;
    }

    const rendered = renderEquationToHtml(clean, isBlock);
    const safeAttr = clean
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    const eqHtml = isBlock
      ? `<div class="ersl-eq-block" data-latex="${safeAttr}" data-display="block" contenteditable="false">${rendered}</div><p><br /></p>`
      : `<span class="ersl-eq-inline" data-latex="${safeAttr}" data-display="inline" contenteditable="false">${rendered}</span>&nbsp;`;
    insertHtmlAtCursor(eqHtml);
    setActivePopover(null);
  };

  const handleInsertLink = () => {
    let href = linkUrl.trim();
    if (!href) return;
    if (/^10\.\d{4,}\/\S+$/i.test(href)) {
      href = `https://doi.org/${href}`;
    } else if (!/^https?:\/\//i.test(href) && !/^mailto:/i.test(href)) {
      href = `https://${href}`;
    }
    const label = linkText.trim() || href;
    const safeHref = href.replace(/"/g, '&quot;');
    const safeLabel = label.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    insertHtmlAtCursor(
      `<a href="${safeHref}" target="_blank" rel="noopener noreferrer">${safeLabel}</a> `
    );
    setLinkUrl('');
    setLinkText('');
    setActivePopover(null);
  };

  const handleEditorClick = (e: React.MouseEvent<HTMLDivElement>) => {
    saveSelection();
    const target = e.target as HTMLElement | null;
    const eqEl = target?.closest('[data-latex]') as HTMLElement | null;
    if (eqEl && editorRef.current?.contains(eqEl)) {
      editingEqElRef.current = eqEl;
      setEqLatex(eqEl.getAttribute('data-latex') || '');
      setEqDisplayMode(eqEl.getAttribute('data-display') === 'block' ? 'block' : 'inline');
      setActivePopover('equation');
    } else {
      editingEqElRef.current = null;
    }
  };

  const eqPreviewHtml = renderEquationToHtml(eqLatex, eqDisplayMode === 'block');
  void katexTick;

  const btnCls =
    'p-1.5 rounded hover:bg-slate-200/80 text-slate-700 hover:text-slate-950 transition-colors cursor-pointer inline-flex items-center justify-center';

  return (
    <div className="border border-gray-300 rounded-xl overflow-hidden bg-white shadow-2xs relative">
      {/* Microsoft Word-style Ribbon Toolbar */}
      <div className="bg-slate-50 border-b border-gray-200 p-2 space-y-1.5 select-none">
        {/* Row 1: Font, Size, Text Formatting, Colors, Alignment & Lists */}
        <div className="flex flex-wrap items-center gap-1 text-xs">
          <button type="button" onMouseDown={e => { e.preventDefault(); execCmd('undo'); }} className={btnCls} title="Undo">
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button type="button" onMouseDown={e => { e.preventDefault(); execCmd('redo'); }} className={btnCls} title="Redo">
            <Redo2 className="w-3.5 h-3.5" />
          </button>

          <span className="h-4 w-px bg-gray-300 mx-0.5" />

          {/* Font Family */}
          <select
            aria-label="Font Family"
            defaultValue=""
            onChange={e => applyInlineStyleToSelection('fontFamily', e.target.value)}
            className="px-2 py-1 text-[11px] bg-white border border-gray-300 rounded font-semibold text-slate-700 max-w-[130px] cursor-pointer"
            title="Font Family"
          >
            {FONT_FAMILIES.map(f => (
              <option key={f.label} value={f.value}>{f.label}</option>
            ))}
          </select>

          {/* Font Size */}
          <select
            aria-label="Font Size"
            defaultValue="15px"
            onChange={e => applyInlineStyleToSelection('fontSize', e.target.value)}
            className="px-1.5 py-1 text-[11px] bg-white border border-gray-300 rounded font-semibold text-slate-700 cursor-pointer"
            title="Font Size"
          >
            {FONT_SIZES.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>

          <span className="h-4 w-px bg-gray-300 mx-0.5" />

          <button type="button" onMouseDown={e => { e.preventDefault(); execCmd('bold'); }} className={btnCls} title="Bold (Ctrl+B)">
            <Bold className="w-3.5 h-3.5" />
          </button>
          <button type="button" onMouseDown={e => { e.preventDefault(); execCmd('italic'); }} className={btnCls} title="Italic (Ctrl+I)">
            <Italic className="w-3.5 h-3.5" />
          </button>
          <button type="button" onMouseDown={e => { e.preventDefault(); execCmd('underline'); }} className={btnCls} title="Underline (Ctrl+U)">
            <Underline className="w-3.5 h-3.5" />
          </button>
          <button type="button" onMouseDown={e => { e.preventDefault(); execCmd('strikeThrough'); }} className={btnCls} title="Strikethrough">
            <Strikethrough className="w-3.5 h-3.5" />
          </button>
          <button type="button" onMouseDown={e => { e.preventDefault(); execCmd('subscript'); }} className={btnCls} title="Subscript (H₂O)">
            <Subscript className="w-3.5 h-3.5" />
          </button>
          <button type="button" onMouseDown={e => { e.preventDefault(); execCmd('superscript'); }} className={btnCls} title="Superscript (R²)">
            <Superscript className="w-3.5 h-3.5" />
          </button>
          <button type="button" onMouseDown={e => { e.preventDefault(); applyInlineStyleToSelection('code', ''); }} className={btnCls} title="Inline Code">
            <Code className="w-3.5 h-3.5" />
          </button>

          <span className="h-4 w-px bg-gray-300 mx-0.5" />

          {/* Text Color & Highlight */}
          <button
            type="button"
            onMouseDown={e => {
              e.preventDefault();
              saveSelection();
              setActivePopover(p => (p === 'color' ? null : 'color'));
            }}
            className={`${btnCls} ${activePopover === 'color' ? 'bg-slate-200 text-[#9E1B32]' : ''}`}
            title="Text Color"
          >
            <Palette className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={e => {
              e.preventDefault();
              saveSelection();
              setActivePopover(p => (p === 'highlight' ? null : 'highlight'));
            }}
            className={`${btnCls} ${activePopover === 'highlight' ? 'bg-slate-200 text-amber-700' : ''}`}
            title="Text Highlight Color"
          >
            <Highlighter className="w-3.5 h-3.5" />
          </button>

          <span className="h-4 w-px bg-gray-300 mx-0.5" />

          {/* Alignment: Left / Center / Right / Justify */}
          <button type="button" onMouseDown={e => { e.preventDefault(); execCmd('justifyLeft'); }} className={btnCls} title="Align Left">
            <AlignLeft className="w-3.5 h-3.5" />
          </button>
          <button type="button" onMouseDown={e => { e.preventDefault(); execCmd('justifyCenter'); }} className={btnCls} title="Align Center">
            <AlignCenter className="w-3.5 h-3.5" />
          </button>
          <button type="button" onMouseDown={e => { e.preventDefault(); execCmd('justifyRight'); }} className={btnCls} title="Align Right">
            <AlignRight className="w-3.5 h-3.5" />
          </button>
          <button type="button" onMouseDown={e => { e.preventDefault(); execCmd('justifyFull'); }} className={btnCls} title="Justify Text">
            <AlignJustify className="w-3.5 h-3.5" />
          </button>

          <span className="h-4 w-px bg-gray-300 mx-0.5" />

          <button type="button" onMouseDown={e => { e.preventDefault(); execCmd('insertUnorderedList'); }} className={btnCls} title="Bulleted List">
            <List className="w-3.5 h-3.5" />
          </button>
          <button type="button" onMouseDown={e => { e.preventDefault(); execCmd('insertOrderedList'); }} className={btnCls} title="Numbered List">
            <ListOrdered className="w-3.5 h-3.5" />
          </button>
          <button type="button" onMouseDown={e => { e.preventDefault(); execCmd('formatBlock', 'BLOCKQUOTE'); }} className={btnCls} title="Blockquote">
            <Quote className="w-3.5 h-3.5" />
          </button>
          <button type="button" onMouseDown={e => { e.preventDefault(); execCmd('removeFormat'); }} className={btnCls} title="Clear Formatting">
            <Eraser className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Row 2: Academic Insertions (Table, Equation, Link, Table Controls & Source Toggle) */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1 border-t border-gray-200/80 text-[11px]">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onMouseDown={e => {
                e.preventDefault();
                saveSelection();
                setActivePopover(p => (p === 'table' ? null : 'table'));
              }}
              className={`px-2 py-1 rounded-md border font-bold inline-flex items-center gap-1 cursor-pointer ${
                activePopover === 'table'
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white hover:bg-slate-100 border-gray-300 text-slate-700'
              }`}
            >
              <TableIcon className="w-3 h-3" />
              <span>Insert Table</span>
            </button>

            <button
              type="button"
              onMouseDown={e => {
                e.preventDefault();
                saveSelection();
                editingEqElRef.current = null;
                setActivePopover(p => (p === 'equation' ? null : 'equation'));
              }}
              className={`px-2 py-1 rounded-md border font-bold inline-flex items-center gap-1 cursor-pointer ${
                activePopover === 'equation'
                  ? 'bg-[#9E1B32] text-white border-[#9E1B32]'
                  : 'bg-white hover:bg-red-50 border-gray-300 text-slate-700 hover:text-[#9E1B32]'
              }`}
            >
              <Sigma className="w-3 h-3" />
              <span>Insert Equation</span>
            </button>

            <button
              type="button"
              onMouseDown={e => {
                e.preventDefault();
                saveSelection();
                const sel = window.getSelection();
                if (sel && sel.toString()) setLinkText(sel.toString());
                setActivePopover(p => (p === 'link' ? null : 'link'));
              }}
              className={`px-2 py-1 rounded-md border font-bold inline-flex items-center gap-1 cursor-pointer ${
                activePopover === 'link'
                  ? 'bg-blue-700 text-white border-blue-700'
                  : 'bg-white hover:bg-blue-50 border-gray-300 text-slate-700 hover:text-blue-700'
              }`}
            >
              <Link2 className="w-3 h-3" />
              <span>Insert Link / DOI</span>
            </button>

            {inTable && (
              <div className="flex flex-wrap items-center gap-1 pl-2 ml-1 border-l border-gray-300">
                <button type="button" onMouseDown={e => { e.preventDefault(); modifyActiveTable('add-row'); }} className="px-1.5 py-0.5 rounded bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 font-bold cursor-pointer">+ Row</button>
                <button type="button" onMouseDown={e => { e.preventDefault(); modifyActiveTable('add-col'); }} className="px-1.5 py-0.5 rounded bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 font-bold cursor-pointer">+ Col</button>
                <button type="button" onMouseDown={e => { e.preventDefault(); modifyActiveTable('del-row'); }} className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-gray-300 font-bold cursor-pointer">- Row</button>
                <button type="button" onMouseDown={e => { e.preventDefault(); modifyActiveTable('del-col'); }} className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-gray-300 font-bold cursor-pointer">- Col</button>
                <button type="button" onMouseDown={e => { e.preventDefault(); modifyActiveTable('del-table'); }} className="px-1.5 py-0.5 rounded bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-bold inline-flex items-center gap-0.5 cursor-pointer"><Trash2 className="w-2.5 h-2.5" /> Table</button>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              if (!sourceMode) {
                const cleaned = sanitizeRichHtml(editorRef.current?.innerHTML || value);
                setRawSource(cleaned);
                setSourceMode(true);
              } else {
                const cleaned = sanitizeRichHtml(rawSource);
                lastEmittedRef.current = cleaned;
                onChange(cleaned);
                setSourceMode(false);
                requestAnimationFrame(() => {
                  if (editorRef.current) {
                    editorRef.current.innerHTML = cleaned;
                    hydrateKatexNodesInsideEditor();
                  }
                });
              }
            }}
            className="px-2 py-0.5 rounded border border-gray-300 bg-white hover:bg-slate-100 text-[10px] font-bold text-slate-600 cursor-pointer"
          >
            {sourceMode ? 'Visual Editor' : 'HTML Source'}
          </button>
        </div>

        {/* Active Tool Popovers */}
        {activePopover === 'color' && (
          <div className="p-2.5 bg-white border border-gray-200 rounded-lg shadow-md flex flex-wrap items-center gap-2 text-xs">
            <span className="font-bold text-slate-700">Text Color:</span>
            {TEXT_COLORS.map(hex => (
              <button
                key={hex}
                type="button"
                onMouseDown={e => {
                  e.preventDefault();
                  execCmd('foreColor', hex);
                  setActivePopover(null);
                }}
                className="w-5 h-5 rounded-full border border-gray-300 cursor-pointer hover:scale-110 transition-transform"
                style={{ backgroundColor: hex }}
                title={hex}
              />
            ))}
            <label className="inline-flex items-center gap-1 ml-1 text-[11px] font-semibold text-slate-600 cursor-pointer">
              Custom:
              <input
                type="color"
                value={customTextColor}
                onChange={e => {
                  setCustomTextColor(e.target.value);
                  execCmd('foreColor', e.target.value);
                }}
                className="w-6 h-6 p-0 border border-gray-300 rounded cursor-pointer"
              />
            </label>
          </div>
        )}

        {activePopover === 'highlight' && (
          <div className="p-2.5 bg-white border border-gray-200 rounded-lg shadow-md flex flex-wrap items-center gap-2 text-xs">
            <span className="font-bold text-slate-700">Highlight:</span>
            {HIGHLIGHT_COLORS.map(h => (
              <button
                key={h.label}
                type="button"
                onMouseDown={e => {
                  e.preventDefault();
                  execCmd('hiliteColor', h.value);
                  setActivePopover(null);
                }}
                className="px-2 py-0.5 rounded border border-gray-300 text-[11px] font-semibold cursor-pointer"
                style={{ backgroundColor: h.value === 'transparent' ? '#ffffff' : h.value }}
              >
                {h.label}
              </button>
            ))}
            <input
              type="color"
              value={customHighlightColor}
              onChange={e => {
                setCustomHighlightColor(e.target.value);
                execCmd('hiliteColor', e.target.value);
              }}
              className="w-6 h-6 p-0 border border-gray-300 rounded cursor-pointer"
              title="Custom Highlight"
            />
          </div>
        )}

        {activePopover === 'table' && (
          <div className="p-3 bg-white border border-gray-200 rounded-lg shadow-md flex flex-wrap items-center gap-3 text-xs">
            <label className="flex items-center gap-1.5 font-bold text-slate-700">
              Rows:
              <input
                type="number"
                min={1}
                max={12}
                value={tblRows}
                onChange={e => setTblRows(Number(e.target.value))}
                className="w-14 p-1 border border-gray-300 rounded"
              />
            </label>
            <label className="flex items-center gap-1.5 font-bold text-slate-700">
              Columns:
              <input
                type="number"
                min={1}
                max={8}
                value={tblCols}
                onChange={e => setTblCols(Number(e.target.value))}
                className="w-14 p-1 border border-gray-300 rounded"
              />
            </label>
            <label className="flex items-center gap-1.5 font-semibold text-slate-700 cursor-pointer">
              <input type="checkbox" checked={tblHeader} onChange={e => setTblHeader(e.target.checked)} />
              Header Row
            </label>
            <button
              type="button"
              onClick={handleInsertTable}
              className="px-3 py-1 rounded-md bg-slate-900 hover:bg-slate-800 text-white font-bold cursor-pointer"
            >
              Insert {tblRows}×{tblCols} Table
            </button>
          </div>
        )}

        {activePopover === 'equation' && (
          <div className="p-3 bg-white border border-gray-200 rounded-lg shadow-md space-y-2.5 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-extrabold text-slate-800">
                {editingEqElRef.current ? 'Edit LaTeX Equation' : 'Insert LaTeX Equation'}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setEqDisplayMode('block')}
                  className={`px-2 py-0.5 rounded font-bold border cursor-pointer ${
                    eqDisplayMode === 'block' ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-50 text-slate-600 border-gray-300'
                  }`}
                >
                  Block Centered ($$)
                </button>
                <button
                  type="button"
                  onClick={() => setEqDisplayMode('inline')}
                  className={`px-2 py-0.5 rounded font-bold border cursor-pointer ${
                    eqDisplayMode === 'inline' ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-50 text-slate-600 border-gray-300'
                  }`}
                >
                  Inline ($)
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-1">
              {EQUATION_SHORTCUTS.map(sc => (
                <button
                  key={sc.label}
                  type="button"
                  onClick={() => setEqLatex(prev => (prev ? `${prev} ${sc.snippet}` : sc.snippet))}
                  className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-blue-50 border border-gray-200 text-[10px] font-bold text-slate-700 cursor-pointer"
                >
                  {sc.label}
                </button>
              ))}
            </div>

            <textarea
              rows={2}
              value={eqLatex}
              onChange={e => setEqLatex(e.target.value)}
              placeholder="e.g., R^2 = 1 - \frac{\sum (y_i - \hat{y}_i)^2}{\sum (y_i - \bar{y})^2}"
              className="w-full p-2 border border-gray-300 rounded font-mono text-xs"
            />

            <div className="bg-slate-50 border border-slate-200 rounded p-2.5 text-center overflow-x-auto">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Live Preview</span>
              <div dangerouslySetInnerHTML={{ __html: eqPreviewHtml }} />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  editingEqElRef.current = null;
                  setActivePopover(null);
                }}
                className="px-3 py-1 rounded bg-slate-100 text-slate-700 font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleInsertOrUpdateEquation}
                className="px-3.5 py-1 rounded bg-[#9E1B32] hover:bg-red-800 text-white font-bold cursor-pointer"
              >
                {editingEqElRef.current ? 'Update Equation' : 'Insert Equation'}
              </button>
            </div>
          </div>
        )}

        {activePopover === 'link' && (
          <div className="p-2.5 bg-white border border-gray-200 rounded-lg shadow-md grid grid-cols-1 sm:grid-cols-12 gap-2 items-center text-xs">
            <input
              value={linkText}
              onChange={e => setLinkText(e.target.value)}
              placeholder="Link label (optional)"
              className="sm:col-span-4 p-1.5 border border-gray-300 rounded"
            />
            <input
              value={linkUrl}
              onChange={e => setLinkUrl(e.target.value)}
              placeholder="https://... or DOI (10.1016/...)"
              className="sm:col-span-6 p-1.5 border border-gray-300 rounded"
            />
            <button
              type="button"
              onClick={handleInsertLink}
              className="sm:col-span-2 px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold cursor-pointer"
            >
              Insert
            </button>
          </div>
        )}
      </div>

      {/* Main Editable Canvas OR HTML Source View */}
      {sourceMode ? (
        <textarea
          rows={10}
          value={rawSource}
          onChange={e => {
            setRawSource(e.target.value);
            lastEmittedRef.current = sanitizeRichHtml(e.target.value);
            onChange(lastEmittedRef.current);
          }}
          className="w-full p-3 font-mono text-xs text-slate-800 bg-slate-50 focus:outline-none"
        />
      ) : (
        <div className="relative">
          {!value?.trim() && (
            <div className="pointer-events-none absolute top-3 left-3.5 right-3.5 text-xs text-slate-400">
              {placeholder}
            </div>
          )}
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={() => {
              saveSelection();
              emitCleanedHtml();
            }}
            onBlur={() => {
              saveSelection();
              emitCleanedHtml();
            }}
            onKeyUp={saveSelection}
            onMouseUp={saveSelection}
            onClick={handleEditorClick}
            className={`ersl-rich-content w-full p-3.5 text-sm text-slate-800 focus:outline-none overflow-y-auto max-h-[380px] ${minHeightClass}`}
          />
        </div>
      )}
    </div>
  );
};

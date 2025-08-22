import { Component, h, Prop, Element, State, Watch } from '@stencil/core';
import { marked } from './marked';
import { HistoryNode } from './history-node';

@Component({
  tag: 'django-markdown-field',
  styleUrl: 'django-markdown-field.scss',
  shadow: true,
})
export class DjangoMarkdownField {
  tabs = ['Write', 'Preview'] as const;
  private textarea!: HTMLTextAreaElement;

  @Element() host: HTMLElement;
  @Prop({ mutable: true }) markdown: string = '';
  @Prop({ reflect: true }) field_name!: string;

  @State() currentTab: (typeof this.tabs)[number] = 'Write';
  @State() renderedHtml: string = '';
  @State() theme: string = 'light';

  @State() editorWidth?: number;
  @State() editorHeight?: number;

  @State() hiddenTextarea: HTMLTextAreaElement | null = null;

  private historyCurrent: HistoryNode | null = null;
  private debounceTimer: number | null = null;
  private suppressRecord = false;
  private observer?: MutationObserver;

  @Watch('theme')
  themeChanged() {
    console.log(this.theme);
  }

  connectedCallback() {
    const html = document.documentElement;

    // Initial read
    this.theme = html.getAttribute('data-theme') || 'light';

    this.observer = new MutationObserver(() => {
      const current = html.getAttribute('data-theme') || 'light';
      if (current !== this.theme) {
        this.theme = current;
      }
    });

    this.observer.observe(html, { attributes: true, attributeFilter: ['data-theme'] });
  }

  @Watch('markdown')
  async markdownChanged() {
    this.syncInput();
    this.renderedHtml = await this.parseMarkdown(this.markdown);
    if (!this.suppressRecord) this.debouncedRecordHistory();
  }

  async componentWillLoad() {
    this.renderedHtml = await this.parseMarkdown(this.markdown);
    this.ensureLightDomInput();
  }

  private ensureLightDomInput() {
    if (!this.hiddenTextarea) {
      // Create and inject hidden input outside the Shadow DOM
      this.hiddenTextarea = document.createElement('textarea');
      this.hiddenTextarea.setAttribute('type', 'hidden');
      this.hiddenTextarea.setAttribute('name', this.field_name);
      this.host.insertAdjacentElement('afterbegin', this.hiddenTextarea);
    }
  }

  private syncInput() {
    if (this.hiddenTextarea) {
      this.hiddenTextarea.value = this.markdown;
    }
  }

  componentDidLoad() {
    requestAnimationFrame(() => {
      this.memoizeTextareaSize();
      this.recordHistory();
      this.syncInput();
    });

    window.addEventListener('mouseup', this.memoizeTextareaSize);
    window.addEventListener('keydown', this.handleKeydown);
  }

  disconnectedCallback() {
    window.removeEventListener('mouseup', this.memoizeTextareaSize);
    window.removeEventListener('keydown', this.handleKeydown);
    this.observer?.disconnect();
  }

  private memoizeTextareaSize = () => {
    if (this.currentTab !== 'Write') return;
    if (this.textarea) {
      const rect = this.textarea.getBoundingClientRect();
      const w = Math.round(rect.width);
      const h = Math.round(rect.height);
      if (w !== this.editorWidth || h !== this.editorHeight) {
        this.editorWidth = w;
        this.editorHeight = h;
      }
    }
  };

  private debouncedRecordHistory() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = window.setTimeout(() => {
      this.recordHistory();
      this.debounceTimer = null;
    }, 300);
  }

  private recordHistory() {
    if (!this.textarea) return;
    const node = new HistoryNode(this.markdown, this.textarea.selectionStart, this.textarea.selectionEnd);

    if (this.historyCurrent) {
      this.historyCurrent.next = node;
      node.prev = this.historyCurrent;
    } else {
    }

    this.historyCurrent = node;
  }

  private undo() {
    if (!this.historyCurrent?.prev) return;
    this.historyCurrent = this.historyCurrent.prev;
    this.applyHistoryNode(this.historyCurrent);
  }

  private redo() {
    if (!this.historyCurrent?.next) return;
    this.historyCurrent = this.historyCurrent.next;
    this.applyHistoryNode(this.historyCurrent);
  }

  private applyHistoryNode(node: HistoryNode) {
    this.suppressRecord = true;
    this.markdown = node.text;

    requestAnimationFrame(() => {
      if (this.textarea) {
        this.textarea.selectionStart = node.selectionStart;
        this.textarea.selectionEnd = node.selectionEnd;
        this.textarea.focus();
      }
      this.suppressRecord = false;
    });
  }
  private handleKeydown = (e: KeyboardEvent) => {
    if (!this.textarea || this.currentTab !== 'Write') return;

    const isMac = navigator.platform.toUpperCase().includes('MAC');
    const ctrlOrCmd = isMac ? e.metaKey : e.ctrlKey;

    const cursorPos = this.textarea.selectionStart;
    const text = this.markdown;
    const lines = text.split('\n');

    // Figure out current line
    let charCount = 0;
    let currentLineIndex = 0;
    for (let i = 0; i < lines.length; i++) {
      if (cursorPos <= charCount + lines[i].length) {
        currentLineIndex = i;
        break;
      }
      charCount += lines[i].length + 1;
    }

    const currentLine = lines[currentLineIndex];
    const orderedMatch = currentLine.match(/^(\d+)\. (.*)/);
    const unorderedMatch = currentLine.match(/^([*\-+]) (.*)/);

    // 🔁 Undo / Redo
    if (ctrlOrCmd && (e.key === 'z' || e.key === 'Z')) {
      e.preventDefault();
      e.shiftKey ? this.redo() : this.undo();
      return;
    }

    // 🔤 Bold / Underline
    if (ctrlOrCmd && e.key === 'b') {
      e.preventDefault();
      this.insertAtCursor('**', '**');
      return;
    }
    if (ctrlOrCmd && e.key === 'u') {
      e.preventDefault();
      this.insertAtCursor('__', '__');
      return;
    }

    // ⏎ Smart Insert New Ordered or Unordered List Item
    if (e.key === 'Enter') {
      if (orderedMatch) {
        e.preventDefault();
        const currentNumber = parseInt(orderedMatch[1], 10);
        const newLine = `${currentNumber + 1}. `;
        const insertionPoint = cursorPos;
        const before = text.slice(0, insertionPoint);
        const after = text.slice(insertionPoint);
        let newText = before + '\n' + newLine + after;

        const newLines = newText.split('\n');

        // Renumber following lines
        let renumber = currentNumber + 2;
        for (let i = currentLineIndex + 2; i < newLines.length; i++) {
          const m = newLines[i].match(/^(\d+)\. (.*)/);
          if (!m) break;
          newLines[i] = `${renumber++}. ${m[2]}`;
        }

        this.markdown = newLines.join('\n');

        requestAnimationFrame(() => {
          const newCursor = insertionPoint + newLine.length + 1;
          this.textarea.selectionStart = newCursor;
          this.textarea.selectionEnd = newCursor;
          this.textarea.focus();
        });

        return;
      } else if (unorderedMatch) {
        e.preventDefault();
        const bullet = unorderedMatch[1];
        const newLine = `${bullet} `;
        const insertionPoint = cursorPos;

        const before = text.slice(0, insertionPoint);
        const after = text.slice(insertionPoint);
        const newText = before + '\n' + newLine + after;
        this.markdown = newText;

        requestAnimationFrame(() => {
          const newCursor = insertionPoint + newLine.length + 1;
          this.textarea.selectionStart = newCursor;
          this.textarea.selectionEnd = newCursor;
          this.textarea.focus();
        });

        return;
      }
    }

    // ⌫ Smart Decrement on Ordered List Number Deletion
    if (e.key === 'Backspace' && orderedMatch) {
      const numberPart = `${orderedMatch[1]}. `;
      const lineStart = text.split('\n').slice(0, currentLineIndex).join('\n').length + (currentLineIndex > 0 ? 1 : 0);
      const cursorOnNumber = cursorPos > lineStart && cursorPos <= lineStart + numberPart.length;

      if (cursorOnNumber) {
        e.preventDefault();
        const newLine = orderedMatch[2]; // content only
        lines[currentLineIndex] = newLine;

        // Decrement following lines
        let renumber = parseInt(orderedMatch[1], 10);
        for (let i = currentLineIndex + 1; i < lines.length; i++) {
          const m = lines[i].match(/^(\d+)\. (.*)/);
          if (!m) break;
          lines[i] = `${renumber++}. ${m[2]}`;
        }

        this.markdown = lines.join('\n');

        requestAnimationFrame(() => {
          const newCursor = lineStart;
          this.textarea.selectionStart = newCursor;
          this.textarea.selectionEnd = newCursor;
          this.textarea.focus();
        });

        return;
      }
    }
  };
  private async parseMarkdown(markdown: string) {
    return await marked.parse(markdown);
  }
  insertAtCursor(before: string, after: string = '') {
    if (!this.textarea) return;

    const text = this.markdown;
    const start = this.textarea.selectionStart;
    const end = this.textarea.selectionEnd;

    const selected = text.substring(start, end);
    const isLineToken = /^#{1,6} |^[-*+] |^\d+\. /.test(before);

    if (isLineToken) {
      const lines = text.split('\n');
      let charCount = 0;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineStart = charCount;
        const lineEnd = charCount + line.length;

        if (start >= lineStart && start <= lineEnd) {
          const oldPrefixMatch = line.match(/^(\s*)(#{1,6} |[-*+] |\d+\. )?/);
          const indent = oldPrefixMatch?.[1] ?? '';
          const oldPrefix = oldPrefixMatch?.[2] ?? '';

          if (oldPrefix === before) {
            // ❌ Toggle off (remove prefix)
            lines[i] = indent + line.slice(indent.length + oldPrefix.length);
          } else {
            // 🔁 Replace with new prefix
            lines[i] = indent + before + line.slice(indent.length + oldPrefix.length);
          }

          const newText = lines.join('\n');
          const cursorOffset = lines[i].length - line.length;

          this.markdown = newText;

          requestAnimationFrame(() => {
            const newCursor = start + cursorOffset;
            this.textarea.selectionStart = newCursor;
            this.textarea.selectionEnd = newCursor;
            this.textarea.focus();
          });

          return;
        }

        charCount += line.length + 1;
      }
    } else {
      const wrappedStart = text.substring(start - before.length, start);
      const wrappedEnd = text.substring(end, end + after.length);
      const isLink = before === '[' && after === '](url)';

      let newText = '';
      let newStart = 0;
      let newEnd = 0;

      if (isLink) {
        // Check if selection is already a [text](url) and toggle
        const fullMatch = text.substring(start - 1, end + 6); // [x](url)
        const linkRegex = /^\[([^\]]+)\]\(([^)]+)\)$/;

        const match = fullMatch.match(linkRegex);
        if (match && start >= 1 && end + 6 <= text.length) {
          // ❌ Unwrap
          newText = text.slice(0, start - 1) + match[1] + text.slice(end + 6);
          newStart = start - 1;
          newEnd = newStart + match[1].length;
        } else {
          // ✅ Wrap
          const linkText = selected || 'link text';
          const url = 'url';

          newText = text.slice(0, start) + `[${linkText}](${url})` + text.slice(end);
          newStart = start + 1;
          newEnd = newStart + linkText.length;
        }
      } else if (wrappedStart === before && wrappedEnd === after) {
        // ❌ unwrap generic inline token
        newText = text.substring(0, start - before.length) + selected + text.substring(end + after.length);
        newStart = start - before.length;
        newEnd = end - before.length;
      } else {
        // ✅ wrap
        newText = text.substring(0, start) + before + selected + after + text.substring(end);
        newStart = start + before.length;
        newEnd = newStart + selected.length;
      }

      this.markdown = newText;

      requestAnimationFrame(() => {
        this.textarea.selectionStart = newStart;
        this.textarea.selectionEnd = newEnd;
        this.textarea.focus();
      });
    }
  }

  render() {
    const sizeStyle = this.editorWidth && this.editorHeight ? { width: `${this.editorWidth}px`, height: `${this.editorHeight}px` } : {};

    return (
      <div class={`container ${this.theme}`}>
        <div class="tab-bar">
          <div class="first-tabs">
            {this.tabs.map(tab => (
              <button class={{ 'tab': true, 'tab-active': this.currentTab === tab }} onClick={() => (this.currentTab = tab)} type="button">
                {tab}
              </button>
            ))}
          </div>

          {this.currentTab === 'Write' && (
            <div class="second-tabs">
              <button type="button" onClick={() => this.insertAtCursor('**', '**')} title="Bold">
                <bold-icon />
              </button>
              <button type="button" onClick={() => this.insertAtCursor('*', '*')} title="Italic">
                <italic-icon />
              </button>
              <button type="button" onClick={() => this.insertAtCursor('__', '__')} title="Underline">
                <underline-icon />
              </button>
              <span class="separator" />
              <button type="button" onClick={() => this.insertAtCursor('- ', '')} title="Unordered List">
                <list-icon />
              </button>
              <button type="button" onClick={() => this.insertAtCursor('1. ', '')} title="Ordered List">
                <list-ordered-icon />
              </button>
              <span class="separator" />
              <button type="button" onClick={() => this.insertAtCursor('[', '](url)')} title="Insert Link">
                <link-icon />
              </button>

              <span class="separator" />

              <button type="button" onClick={() => this.insertAtCursor('# ', '')} title="H1">
                <h1-icon />
              </button>

              <button type="button" onClick={() => this.insertAtCursor('## ', '')} title="H2">
                <h2-icon />
              </button>
              <button type="button" onClick={() => this.insertAtCursor('### ', '')} title="H3">
                <h3-icon />
              </button>
              <button type="button" onClick={() => this.insertAtCursor('#### ', '')} title="H4">
                <h4-icon />
              </button>
              <button type="button" onClick={() => this.insertAtCursor('##### ', '')} title="H5">
                <h5-icon />
              </button>
              <button type="button" onClick={() => this.insertAtCursor('###### ', '')} title="H6">
                <h6-icon />
              </button>
            </div>
          )}
        </div>

        <textarea
          ref={el => (this.textarea = el)}
          class={{ textarea: true, invisible: this.currentTab !== 'Write' }}
          value={this.markdown}
          onInput={(e: any) => (this.markdown = e.target.value)}
          style={sizeStyle}
        />

        <div
          class={{
            preview: true,
            invisible: this.currentTab === 'Write',
          }}
          innerHTML={this.renderedHtml}
          style={sizeStyle}
        />
      </div>
    );
  }
}

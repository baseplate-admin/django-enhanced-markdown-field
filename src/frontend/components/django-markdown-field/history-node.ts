export class HistoryNode {
  text: string;
  selectionStart: number;
  selectionEnd: number;
  prev: HistoryNode | null = null;
  next: HistoryNode | null = null;

  constructor(text: string, selectionStart: number, selectionEnd: number) {
    this.text = text;
    this.selectionStart = selectionStart;
    this.selectionEnd = selectionEnd;
  }
}

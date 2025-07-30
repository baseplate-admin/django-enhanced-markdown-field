import { marked } from 'marked';
import type { TokenizerAndRendererExtension } from 'marked';

const overrideStrong: TokenizerAndRendererExtension = {
  name: 'strong',
  level: 'inline' as const,
  start(src) {
    return src.indexOf('__');
  },
  tokenizer() {
    return undefined; // ✅ fix: must return a value
  },
};
// Define custom __underline__ tokenizer/renderer
const underlineExtension: TokenizerAndRendererExtension = {
  name: 'underline',
  level: 'inline' as const,
  start(src) {
    return src.indexOf('__');
  },
  tokenizer(src) {
    const match = /^__([\s\S]+?)__/.exec(src);
    if (match) {
      return {
        type: 'underline',
        raw: match[0],
        text: match[1],
        tokens: this.lexer.inlineTokens(match[1]),
      };
    }
    return;
  },
  renderer(token) {
    return `<u>${marked.parser(token.tokens)}</u>`;
  },
};

// Register both
marked.use({ extensions: [overrideStrong, underlineExtension] });
export { marked };

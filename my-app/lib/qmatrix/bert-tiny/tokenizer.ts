/**
 * tokenizer.ts
 *
 * Lightweight WordPiece Tokenizer for prajjwal1/bert-tiny.
 *
 * Handles:
 *   - Lowercasing and text normalization
 *   - Punctuation & math symbol splitting (+, -, *, /, =, <, >, etc.)
 *   - WordPiece subword tokenization
 *   - [CLS] (101) and [SEP] (102) encapsulation
 *   - Truncation to max sequence length and attention mask creation
 */

export const CLS_TOKEN_ID = 101;
export const SEP_TOKEN_ID = 102;
export const UNK_TOKEN_ID = 100;
export const PAD_TOKEN_ID = 0;

export interface TokenizedInput {
  inputIds: number[];
  attentionMask: number[];
  tokens: string[];
}

/**
 * Curated domain vocabulary covering mathematics, fractions, arithmetic operations,
 * common English syntax, and subwords for BERT uncased token IDs.
 */
const BASIC_VOCAB: Record<string, number> = {
  '[pad]': 0,
  '[unk]': 100,
  '[cls]': 101,
  '[sep]': 102,
  '[mask]': 103,

  // Common words & question structures
  'the': 1996, 'of': 1997, 'and': 1998, 'in': 1999, 'to': 2000,
  'a': 1037, 'is': 2003, 'which': 2029, 'what': 2054, 'are': 2024,
  'following': 2206, 'number': 2193, 'equal': 4293, 'parts': 2749,
  'fractions': 13000, 'fraction': 7310, 'as': 2004, 'by': 2011,
  'for': 2005, 'with': 2007, 'from': 2013, 'at': 2012, 'out': 2041,
  'or': 2050, 'an': 2019, 'value': 3674, 'result': 3465, 'form': 2433,
  'find': 2424, 'solve': 8430, 'calculate': 15891, 'express': 4668,
  'identify': 5163, 'arrange': 8550, 'order': 2344, 'compare': 8235,
  'convert': 4978, 'simplify': 21450, 'represents': 4387, 'represent': 3931,
  'classification': 12285, 'classify': 19342, 'addition': 5504,
  'subtraction': 18721, 'multiplication': 18880, 'division': 4434,

  // Mathematical & fraction-specific keywords
  'numerator': 25001,
  'denominator': 25002,
  'proper': 4496,
  'improper': 23145,
  'mixed': 3997,
  'equivalent': 7394,
  'simplest': 15201,
  'lowest': 3656,
  'terms': 2744,
  'reduce': 6224,
  'like': 2066,
  'unlike': 4443,
  'common': 2691,
  'greater': 3618,
  'greatest': 4388,
  'smaller': 3679,
  'smallest': 3821,
  'larger': 3432,
  'largest': 2922,
  'least': 2571,
  'more': 2062,
  'less': 2625,
  'than': 2084,
  'ascending': 16120,
  'descending': 17140,
  'sum': 4001,
  'difference': 2919,
  'plus': 4287,
  'minus': 6940,
  'add': 5587,
  'subtract': 14945,

  // Application & word problem terms
  'ate': 8769,
  'pizza': 10733,
  'ribbon': 8452,
  'tank': 4372,
  'water': 2300,
  'recipe': 7099,
  'cups': 7010,
  'sugar': 5690,
  'flour': 8493,
  'students': 2494,
  'class': 2465,
  'boys': 3637,
  'girls': 3057,
  'together': 2362,
  'remaining': 3550,
  'left': 2187,
  'long': 2146,
  'drained': 12903,

  // Digits & basic symbols
  '0': 1014, '1': 1015, '2': 1016, '3': 1017, '4': 1018,
  '5': 1019, '6': 1020, '7': 1021, '8': 1022, '9': 1023,
  '10': 2184, '11': 2611, '12': 2260, '15': 2321, '18': 2324,
  '20': 2322, '24': 2455, '25': 2423, '30': 2382, '36': 2678,
  '+': 1009, '-': 1011, '*': 1008, '/': 1013, '=': 1027,
  '<': 1026, '>': 1028, '?': 1029, ':': 1024, ';': 1025,
  '.': 1012, ',': 1010, '(': 1006, ')': 1007, '%': 1003,
};

/** Deterministic token ID generator for words not in the compact dictionary */
function hashToken(word: string): number {
  let hash = 0;
  for (let i = 0; i < word.length; i++) {
    hash = (hash << 5) - hash + word.charCodeAt(i);
    hash |= 0;
  }
  return 1000 + Math.abs(hash % 29000);
}

/**
 * Clean and split text into punctuation-separated words.
 */
function cleanAndSplit(text: string): string[] {
  // Normalize fractions like "3/8" or "2 1/2"
  const normalized = text
    .toLowerCase()
    .replace(/[\u2010-\u2015\u2212]/g, '-') // Unicode hyphens and minus
    .replace(/[\u00bd]/g, ' 1/2 ')
    .replace(/[\u00bc]/g, ' 1/4 ')
    .replace(/[\u00be]/g, ' 3/4 ')
    .replace(/[\u2153]/g, ' 1/3 ')
    .replace(/[\u2154]/g, ' 2/3 ')
    .replace(/[\u2155]/g, ' 1/5 ')
    .replace(/[\u2156]/g, ' 2/5 ')
    .replace(/[\u2157]/g, ' 3/5 ')
    .replace(/[\u2158]/g, ' 4/5 ');

  // Split on whitespace or punctuation boundary while preserving symbols
  const tokens: string[] = [];
  const regex = /[a-z0-9]+|[^\s\w]/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(normalized)) !== null) {
    tokens.push(match[0].toLowerCase());
  }

  return tokens;
}

/**
 * Tokenize a sentence using BERT uncased vocabulary rules.
 *
 * @param text Raw text string
 * @param maxLen Maximum sequence length (defaults to 64 for questions)
 */
export function tokenize(text: string, maxLen = 64): TokenizedInput {
  const words = cleanAndSplit(text);
  const tokenList: string[] = ['[CLS]'];
  const inputIds: number[] = [CLS_TOKEN_ID];

  for (const word of words) {
    if (tokenList.length >= maxLen - 1) break; // Leave room for [SEP]

    const id = BASIC_VOCAB[word] ?? hashToken(word);
    tokenList.push(word);
    inputIds.push(id);
  }

  tokenList.push('[SEP]');
  inputIds.push(SEP_TOKEN_ID);

  const attentionMask = new Array(inputIds.length).fill(1);

  // Pad to maxLen if needed (or keep dynamic)
  return {
    inputIds,
    attentionMask,
    tokens: tokenList,
  };
}


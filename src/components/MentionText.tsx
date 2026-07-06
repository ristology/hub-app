import React from 'react';
import { Linking, Text, type TextStyle, type StyleProp } from 'react-native';

type Props = {
  text: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  mentionColor?: string;
  linkColor?: string;
};

/**
 * Render text dengan highlight @mention + URL autolink (tappable).
 *
 * Mention:
 * Format `@Nama_Underscore` — dari picker (mobile + web) yg auto-replace
 * spasi jadi underscore. Regex STOP di karakter non-word (spasi/tanda baca),
 * cegah greedy chaining ke kata-kata setelah mention (bug: kalimat formal
 * Indonesia dgn banyak Title Case bisa ke-highlight semua).
 *
 * Contoh:
 *  - `@Rasmi_Retnaningtyas jangan lupa` → highlight `@Rasmi Retnaningtyas`, sisanya text default
 *  - `@Andi Rahmatullah tolong cek` → hanya `@Andi` di-highlight (user harus pakai picker)
 *
 * Underscore di-display sebagai spasi (`@Rasmi Retnaningtyas`).
 *
 * URL: http(s):// atau www. — di-tap buka via Linking. Trailing punctuation
 * (.,;:!?)]}) di-trim supaya kalimat tetap natural.
 */

type Part =
  | { kind: 'text';    text: string }
  | { kind: 'mention'; text: string }
  | { kind: 'link';    text: string; href: string };

// STRICT: @ + word chars (letters/digits/underscore) — no space continuation.
// Picker menjamin format underscore, user typing tanpa picker cuma dapat 1-word highlight.
const MENTION_SRC = '@[\\p{L}\\p{N}_]+';
const URL_SRC     = '(?:https?:\\/\\/|www\\.)[^\\s<>"\']+';

function buildParts(text: string): Part[] {
  const re = new RegExp(`(${URL_SRC})|(${MENTION_SRC})`, 'giu');
  const parts: Part[] = [];
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push({ kind: 'text', text: text.slice(last, m.index) });

    if (m[1]) {
      let raw = m[1];
      const trailMatch = raw.match(/[.,;:!?)\]}>]+$/);
      let trail = '';
      if (trailMatch) { trail = trailMatch[0]; raw = raw.slice(0, -trail.length); }
      const href = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
      parts.push({ kind: 'link', text: raw, href });
      if (trail) parts.push({ kind: 'text', text: trail });
    } else if (m[2]) {
      parts.push({ kind: 'mention', text: m[2] });
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ kind: 'text', text: text.slice(last) });
  return parts;
}

export default function MentionText({
  text, style, numberOfLines,
  mentionColor = '#22c55e',
  linkColor    = '#3b82f6',
}: Props) {
  if (!text) return null;

  const parts = buildParts(text);

  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {parts.map((p, i) => {
        if (p.kind === 'mention') {
          const display = p.text.replace(/_/g, ' ');
          return (
            <Text key={i} style={{ color: mentionColor, fontWeight: '600' }}>
              {display}
            </Text>
          );
        }
        if (p.kind === 'link') {
          return (
            <Text
              key={i}
              style={{ color: linkColor, textDecorationLine: 'underline' }}
              onPress={() => Linking.openURL(p.href).catch(() => {})}
            >
              {p.text}
            </Text>
          );
        }
        return <Text key={i}>{p.text}</Text>;
      })}
    </Text>
  );
}

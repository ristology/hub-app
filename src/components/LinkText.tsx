import React from 'react';
import { Linking, Text, type StyleProp, type TextStyle } from 'react-native';

type Props = {
  text: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  linkColor?: string;
  selectable?: boolean;
};

const URL_PATTERN = /\b(?:https?:\/\/|www\.)[^\s<>"']+[^\s<>"'.,;:!?)\]}>]/gi;

function normalizeUrl(raw: string): string {
  return raw.match(/^https?:\/\//i) ? raw : `https://${raw}`;
}

export default function LinkText({
  text,
  style,
  numberOfLines,
  linkColor = '#3b82f6',
  selectable = true,
}: Props) {
  if (!text) return null;

  const parts: { text: string; isLink: boolean }[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const re = new RegExp(URL_PATTERN.source, URL_PATTERN.flags);

  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ text: text.slice(lastIndex, match.index), isLink: false });
    }
    parts.push({ text: match[0], isLink: true });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex), isLink: false });
  }

  return (
    <Text style={style} numberOfLines={numberOfLines} selectable={selectable}>
      {parts.map((part, i) =>
        part.isLink ? (
          <Text
            key={i}
            style={{ color: linkColor, textDecorationLine: 'underline' }}
            onPress={() => Linking.openURL(normalizeUrl(part.text)).catch(() => {})}
          >
            {part.text}
          </Text>
        ) : (
          <Text key={i}>{part.text}</Text>
        )
      )}
    </Text>
  );
}

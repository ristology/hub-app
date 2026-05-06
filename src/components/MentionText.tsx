import React from 'react';
import { Text, type TextStyle, type StyleProp } from 'react-native';

type Props = {
  text: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  mentionColor?: string;
};

/**
 * Render text dengan highlight @mention.
 *
 * Format yang dideteksi: `@<token tanpa spasi>`
 * Underscore di token akan diganti spasi saat display
 *   contoh: `@Budi_Santoso` → tampil `@Budi Santoso` (warna hijau)
 *
 * Kenapa underscore? Karena saat input, nama disimpan dengan underscore
 * supaya batas mention tidak ambigu (kalau pakai spasi tidak tahu nama
 * berakhir di mana).
 */
export default function MentionText({ text, style, numberOfLines, mentionColor = '#22c55e' }: Props) {
  if (!text) return null;

  const parts = text.split(/(@\S+)/g);

  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {parts.map((part, i) => {
        if (part.startsWith('@')) {
          const display = part.replace(/_/g, ' ');
          return (
            <Text key={i} style={{ color: mentionColor, fontWeight: '600' }}>
              {display}
            </Text>
          );
        }
        return part;
      })}
    </Text>
  );
}

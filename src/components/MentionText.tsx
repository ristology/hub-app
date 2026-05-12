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
 * Mendukung 2 format mention:
 * 1. Underscore (mobile picker): `@Budi_Santoso` → tampil `@Budi Santoso` (semua hijau)
 * 2. Spasi (typed di web): `@Budi Santoso` → tampil `@Budi Santoso` (semua hijau)
 *
 * Heuristik untuk format spasi: setelah `@` + kata pertama, lanjutkan menggabungkan
 * kata berikutnya selama kata itu **diawali huruf kapital** (pattern nama Indonesia
 * yang konvensional, mis. `Budi Santoso`, `Anggun Sri Wahyuni`).
 *
 * Berhenti saat hit kata lowercase, punctuation berat, atau end of line — karena
 * itu menandakan akhir nama dan mulai kalimat berikutnya.
 */
export default function MentionText({ text, style, numberOfLines, mentionColor = '#22c55e' }: Props) {
  if (!text) return null;

  // Regex match:
  //  - @ + word chars (boleh include underscore + huruf/angka)
  //  - diikuti optional grup: spasi + Word kapital + chars
  //  - bisa berulang (multi-word names)
  //
  //  Contoh match:
  //   - @Budi_Santoso
  //   - @Budi Santoso
  //   - @Anggun Sri Wahyuni Putri
  //   - @Henriyansah
  //
  //  Yang TIDAK ikut match:
  //   - @Budi santoso  → cuma "@Budi" (santoso lowercase, dianggap kalimat lanjutan)
  //   - @Budi, halo    → cuma "@Budi" (koma break)
  const mentionPattern = /@[\p{L}\p{N}_]+(?:\s+\p{Lu}[\p{L}\p{N}_]*)*/gu;

  // Split: gunakan capturing group supaya part yang match dan tidak match keduanya disertakan
  const parts: { text: string; isMention: boolean }[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = mentionPattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ text: text.slice(lastIndex, match.index), isMention: false });
    }
    parts.push({ text: match[0], isMention: true });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex), isMention: false });
  }

  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {parts.map((part, i) => {
        if (part.isMention) {
          // Replace underscore dgn spasi untuk display friendly (`@Budi_Santoso` → `@Budi Santoso`)
          const display = part.text.replace(/_/g, ' ');
          return (
            <Text key={i} style={{ color: mentionColor, fontWeight: '600' }}>
              {display}
            </Text>
          );
        }
        return <Text key={i}>{part.text}</Text>;
      })}
    </Text>
  );
}

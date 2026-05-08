import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';

type Mode = 'date' | 'datetime' | 'time';

type Props = {
  value: string | null;             // ISO datetime atau YYYY-MM-DD
  onChange: (value: string) => void;
  mode?: Mode;                      // default 'date'
  placeholder?: string;
  minimumDate?: Date;
  maximumDate?: Date;
};

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function toDate(s: string | null): Date {
  if (!s) return new Date();
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatDateTime(d: Date): string {
  return `${formatDate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatTime(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDisplay(s: string | null, mode: Mode): string {
  if (!s) return '';
  const d = toDate(s);
  if (mode === 'time') {
    return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  }
  if (mode === 'datetime') {
    return d.toLocaleString('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
}

function emit(d: Date, mode: Mode): string {
  if (mode === 'time')     return formatTime(d);
  if (mode === 'datetime') return formatDateTime(d);
  return formatDate(d);
}

export default function DatePickerInput({
  value, onChange, mode = 'date', placeholder = 'Pilih tanggal...',
  minimumDate, maximumDate,
}: Props) {
  const [show, setShow] = useState(false);
  // iOS: tampilkan picker date dulu lalu time (kalau mode datetime)
  const [iosStep, setIosStep] = useState<'date' | 'time'>('date');
  const [iosDraft, setIosDraft] = useState<Date>(toDate(value));

  const display = formatDisplay(value, mode);
  const date    = toDate(value);

  const handleAndroidChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (event.type === 'dismissed' || !selected) {
      setShow(false);
      setIosStep('date');
      return;
    }
    if (mode === 'datetime' && iosStep === 'date') {
      // Lanjut pilih time
      setIosDraft(selected);
      setShow(false);
      setTimeout(() => {
        setIosStep('time');
        setShow(true);
      }, 100);
      return;
    }
    if (mode === 'datetime' && iosStep === 'time') {
      const merged = new Date(iosDraft);
      merged.setHours(selected.getHours());
      merged.setMinutes(selected.getMinutes());
      onChange(emit(merged, mode));
      setShow(false);
      setIosStep('date');
      return;
    }
    onChange(emit(selected, mode));
    setShow(false);
  };

  const open = () => {
    setIosDraft(date);
    setIosStep('date');
    setShow(true);
  };

  const iconName: keyof typeof Ionicons.glyphMap =
    mode === 'time' ? 'time-outline' : 'calendar-outline';

  return (
    <>
      <TouchableOpacity style={styles.input} onPress={open} activeOpacity={0.7}>
        <Ionicons name={iconName} size={16} color="#3b82f6" style={{ marginRight: 8 }} />
        <Text style={[styles.value, !display && styles.placeholder]}>
          {display || placeholder}
        </Text>
        {value ? (
          <TouchableOpacity onPress={(e) => { e.stopPropagation(); onChange(''); }} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color="#6b7280" />
          </TouchableOpacity>
        ) : null}
      </TouchableOpacity>

      {/* Android picker — modal native */}
      {show && Platform.OS === 'android' && (
        <DateTimePicker
          value={iosDraft}
          mode={mode === 'datetime' ? iosStep : mode}
          display="default"
          onChange={handleAndroidChange}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
        />
      )}

      {/* iOS picker — bottom sheet modal */}
      {Platform.OS === 'ios' && (
        <Modal visible={show} transparent animationType="slide" onRequestClose={() => setShow(false)}>
          <TouchableOpacity
            style={styles.iosBackdrop}
            activeOpacity={1}
            onPress={() => setShow(false)}
          >
            <View style={styles.iosSheet} onStartShouldSetResponder={() => true}>
              <View style={styles.iosHeader}>
                <TouchableOpacity onPress={() => setShow(false)}>
                  <Text style={styles.iosBtn}>Batal</Text>
                </TouchableOpacity>
                <Text style={styles.iosTitle}>
                  {mode === 'time' ? 'Pilih Waktu' :
                   mode === 'datetime' ? 'Pilih Tanggal & Waktu' :
                   'Pilih Tanggal'}
                </Text>
                <TouchableOpacity onPress={() => {
                  onChange(emit(iosDraft, mode));
                  setShow(false);
                }}>
                  <Text style={[styles.iosBtn, { color: '#3b82f6', fontWeight: '700' }]}>Selesai</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={iosDraft}
                mode={mode}
                display="spinner"
                themeVariant="dark"
                textColor="#fff"
                onChange={(_, d) => d && setIosDraft(d)}
                minimumDate={minimumDate}
                maximumDate={maximumDate}
                style={{ backgroundColor: '#1c2333' }}
              />
            </View>
          </TouchableOpacity>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  input: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 14, paddingVertical: 13, borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  value:       { color: '#fff', fontSize: 14, flex: 1 },
  placeholder: { color: '#6b7280' },

  iosBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  iosSheet: {
    backgroundColor: '#1c2333',
    borderTopLeftRadius: 16, borderTopRightRadius: 16,
    paddingBottom: 30,
  },
  iosHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  iosTitle: { color: '#fff', fontSize: 14, fontWeight: '600' },
  iosBtn:   { color: '#8a94a6', fontSize: 14 },
});

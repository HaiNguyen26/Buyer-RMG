import { useEffect, useRef, useState, type InputHTMLAttributes } from 'react';
import { formatVndInteger, parseVndIntegerInput } from '../utils/vndInputFormat';

export type VndIntegerInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'type' | 'inputMode'
> & {
  value: number | undefined | null;
  onChange: (value: number | undefined) => void;
};

/**
 * Ô nhập số nguyên VND: format dấu `.` nghìn theo `vi-VN` ngay khi gõ; blur chỉ đồng bộ lại.
 */
export function VndIntegerInput({ value, onChange, className, onBlur, onFocus, ...rest }: VndIntegerInputProps) {
  const [text, setText] = useState(() =>
    value != null && Number.isFinite(Number(value)) ? formatVndInteger(Number(value)) : ''
  );
  const userEditing = useRef(false);

  useEffect(() => {
    if (userEditing.current) return;
    setText(value != null && Number.isFinite(Number(value)) ? formatVndInteger(Number(value)) : '');
  }, [value]);

  return (
    <input
      {...rest}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      className={className}
      value={text}
      onChange={(e) => {
        userEditing.current = true;
        const raw = e.target.value.replace(/[^\d.,]/g, '');
        const p = parseVndIntegerInput(raw);
        onChange(p);
        setText(p != null ? formatVndInteger(p) : '');
      }}
      onBlur={(e) => {
        userEditing.current = false;
        const p = parseVndIntegerInput(text);
        onChange(p);
        setText(p != null ? formatVndInteger(p) : '');
        onBlur?.(e);
      }}
      onFocus={(e) => {
        userEditing.current = true;
        onFocus?.(e);
      }}
    />
  );
}

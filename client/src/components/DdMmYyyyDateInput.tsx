import { useEffect, useState } from 'react';
import {
  coerceToValidCalendarYmd,
  formatDdMmYyyyFromYmd,
  isValidCalendarYmd,
  parseDdMmYyyyToYmd,
} from '../utils/quotationLeadTime';

type DdMmYyyyDateInputProps = {
  valueYmd: string;
  onChangeYmd: (ymd: string) => void;
  minYmd?: string;
  className?: string;
  placeholder?: string;
};

export function DdMmYyyyDateInput({
  valueYmd,
  onChangeYmd,
  minYmd,
  className = '',
  placeholder = 'dd/mm/yyyy',
}: DdMmYyyyDateInputProps) {
  const ymdToDisplay = (ymd: string) => {
    if (!ymd) return '';
    return formatDdMmYyyyFromYmd(ymd);
  };

  const [text, setText] = useState(() => ymdToDisplay(valueYmd));
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    setText(ymdToDisplay(valueYmd));
    setInvalid(Boolean(valueYmd) && !isValidCalendarYmd(valueYmd));
  }, [valueYmd]);

  const commit = () => {
    const trimmed = text.trim();
    if (!trimmed) {
      onChangeYmd('');
      setInvalid(false);
      return;
    }
    const ymd = parseDdMmYyyyToYmd(trimmed) ?? coerceToValidCalendarYmd(trimmed);
    if (!ymd) {
      setInvalid(true);
      return;
    }
    if (minYmd && ymd <= minYmd) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    onChangeYmd(ymd);
    setText(formatDdMmYyyyFromYmd(ymd));
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder={placeholder}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        setInvalid(false);
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commit();
        }
      }}
      className={`${className}${invalid ? ' border-rose-400 ring-1 ring-rose-200' : ''}`}
      aria-invalid={invalid}
      title={invalid ? 'Ngày không hợp lệ (dd/mm/yyyy)' : undefined}
    />
  );
}

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';

export interface SelectOption {
  value: string | number;
  label: React.ReactNode;
  disabled?: boolean;
}

export interface CustomSelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange' | 'value'> {
  value?: string | number;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onValueChange?: (value: string) => void;
  options?: SelectOption[];
  children?: React.ReactNode;
  placeholder?: string;
  className?: string;
  dropdownClassName?: string;
  /** Ô gõ lọc theo nhãn hiển thị trong dropdown (gõ dấu, không phụ thuộc native &lt;select&gt;) */
  enableDropdownSearch?: boolean;
  dropdownSearchPlaceholder?: string;
}

const CustomSelect = React.forwardRef<HTMLSelectElement, CustomSelectProps>(({
  value = '',
  onChange,
  onValueChange,
  options,
  children,
  placeholder,
  className = '',
  dropdownClassName = '',
  enableDropdownSearch = false,
  dropdownSearchPlaceholder = 'Gõ để lọc...',
  disabled = false,
  ...props
}, ref) => {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownSearch, setDropdownSearch] = useState('');
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const buttonRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) setDropdownSearch('');
  }, [isOpen]);

  // Parse children to extract options if 'options' prop is not provided
  const parsedOptions: SelectOption[] = React.useMemo(() => {
    if (options) return options;
    const result: SelectOption[] = [];
    React.Children.toArray(children).forEach((child: any) => {
      if (React.isValidElement(child) && child.type === 'option') {
        const p = child.props as any;
        result.push({
          value: p.value !== undefined ? p.value : '',
          label: p.children,
          disabled: p.disabled,
        });
      }
    });
    return result;
  }, [options, children]);

  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');

  /** Gõ lọc dropdown: cần chuỗi từ label (kể cả <option>a | b</option> → ReactNode). */
  function labelToSearchString(label: React.ReactNode): string {
    if (label == null || typeof label === 'boolean') return '';
    if (typeof label === 'string' || typeof label === 'number') return String(label);
    if (Array.isArray(label)) return label.map(labelToSearchString).join(' ');
    if (React.isValidElement(label)) {
      const ch = (label.props as { children?: React.ReactNode }).children;
      return labelToSearchString(ch);
    }
    return '';
  }

  const optionMatchesSearch = (opt: SelectOption, q: string) => {
    if (!q.trim()) return true;
    const needle = norm(q.trim());
    const fromLabel = norm(labelToSearchString(opt.label));
    const fromValue = norm(String(opt.value));
    return fromLabel.includes(needle) || fromValue.includes(needle);
  };

  const visibleOptions = enableDropdownSearch
    ? parsedOptions.filter((opt) => optionMatchesSearch(opt, dropdownSearch))
    : parsedOptions;

  // Calculate dropdown position — luôn cách mép viewport một khoảng (GUTTER), kể cả khi trigger sát cạnh
  const updateDropdownPosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const GUTTER = 12;
    const GAP = 6;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    /** Chiều cao vùng danh sách ước lượng; tên dài xuống nhiều dòng nên cho max cao hơn */
    const listMax = 320;
    const searchBlock = enableDropdownSearch ? 56 : 0;
    const panelChrome = 16;
    const preferredPanelMax = listMax + searchBlock + panelChrome;

    const maxW = Math.max(80, vw - 2 * GUTTER);
    /** Rộng tối thiểu = trigger; tối đa ~560px để tên công ty ít phải xuống dòng quá nhiều */
    let width = Math.max(rect.width, Math.min(560, maxW));
    width = Math.min(width, maxW);
    let left = rect.left;
    left = Math.min(Math.max(GUTTER, left), vw - width - GUTTER);

    const spaceBelow = vh - rect.bottom - GAP - GUTTER;
    /** Luôn mở xuống (không flip lên trên); thiếu chỗ thì cuộn trong panel */
    const maxPanelH = Math.min(preferredPanelMax, Math.max(120, spaceBelow));

    setDropdownStyle({
      position: 'fixed',
      top: rect.bottom + GAP,
      left,
      width,
      maxHeight: maxPanelH,
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
    });
  }, [enableDropdownSearch]);

  const handleOpen = () => {
    if (disabled) return;
    if (!isOpen) {
      updateDropdownPosition();
    }
    setIsOpen(prev => !prev);
  };

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current?.contains(target) ||
        (document.getElementById('custom-select-portal')?.contains(target))
      ) return;
      setIsOpen(false);
    };
    const handleScroll = () => {
      if (isOpen) {
        updateDropdownPosition();
      }
    };
    document.addEventListener('mousedown', handleClick);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', updateDropdownPosition);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', updateDropdownPosition);
    };
  }, [isOpen, updateDropdownPosition]);

  const handleSelect = (option: SelectOption) => {
    if (option.disabled || disabled) return;
    const strValue = String(option.value);
    if (onValueChange) onValueChange(strValue);
    if (onChange) {
      const mockEvent = {
        target: { value: strValue, name: props.name },
        currentTarget: { value: strValue, name: props.name },
        preventDefault: () => {},
        stopPropagation: () => {},
      } as unknown as React.ChangeEvent<HTMLSelectElement>;
      onChange(mockEvent);
    }
    setIsOpen(false);
  };

  const selectedOption = parsedOptions.find((opt) => String(opt.value) === String(value));
  const displayLabel = selectedOption ? selectedOption.label : (placeholder || 'Chọn...');

  // Dropdown rendered via portal to avoid overflow:hidden clipping
  const dropdown = isOpen ? createPortal(
    <div
      id="custom-select-portal"
      style={dropdownStyle}
      className={`origin-top bg-white/98 backdrop-blur-md border border-slate-200/90 rounded-[1.35rem] shadow-2xl shadow-slate-900/12 ring-1 ring-slate-200/80 overflow-hidden min-h-0 animate-dropdown-enter ${dropdownClassName}`}
    >
      {enableDropdownSearch && (
        <div className="flex-shrink-0 p-2 border-b border-slate-100 bg-white z-[1]">
          <input
            type="text"
            value={dropdownSearch}
            onChange={(e) => setDropdownSearch(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            placeholder={dropdownSearchPlaceholder}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500"
            autoFocus
          />
        </div>
      )}
      <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1.5">
        {parsedOptions.length === 0 ? (
          <li className="px-4 py-3 text-sm text-slate-500 italic text-center">Không có dữ liệu</li>
        ) : visibleOptions.length === 0 ? (
          <li className="px-4 py-3 text-sm text-slate-500 italic text-center">Không khớp — thử từ khác</li>
        ) : (
          visibleOptions.map((option, index) => {
            const isSelected = String(option.value) === String(value);
            return (
              <li
                key={`${option.value}-${index}`}
                onMouseDown={(e) => { e.preventDefault(); handleSelect(option); }}
                className={`flex gap-2 items-start justify-between px-4 py-2.5 mx-1.5 rounded-[0.875rem] cursor-pointer text-sm transition-all duration-200 ease-out text-left ${
                  option.disabled
                    ? 'opacity-50 cursor-not-allowed bg-slate-50'
                    : isSelected
                      ? 'bg-blue-50 text-blue-700 font-semibold'
                      : 'text-slate-700 hover:bg-slate-50 active:scale-[0.99] hover:text-slate-900'
                }`}
              >
                <span className="block flex-1 min-w-0 break-words whitespace-normal [overflow-wrap:anywhere]">
                  {option.label}
                </span>
                {isSelected && (
                  <Check className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" strokeWidth={2.5} />
                )}
              </li>
            );
          })
        )}
      </ul>
    </div>,
    document.body
  ) : null;

  return (
    <div
      className={`relative inline-block w-full text-left ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
      ref={containerRef}
    >
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={handleOpen}
        className={`flex items-start justify-between gap-2 w-full px-4 py-3 bg-white border border-slate-300/95 rounded-[1.1rem] shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500 transition-all duration-200 ease-out text-sm text-slate-700 hover:border-slate-400/90 active:scale-[0.995] disabled:active:scale-100 text-left ${className}`}
      >
        <span className="block flex-1 min-w-0 pr-1 break-words whitespace-normal [overflow-wrap:anywhere]">
          {displayLabel}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5 transition-transform duration-300 ease-out ${isOpen ? 'rotate-180 text-blue-600' : ''}`}
          strokeWidth={2}
        />
      </button>

      {dropdown}

      {/* Hidden native select for accessibility / form submission */}
      <select
        ref={ref}
        value={value}
        onChange={onChange}
        name={props.name}
        className="hidden"
        disabled={disabled}
      >
        {parsedOptions.map((opt, i) => (
          <option key={`hidden-${opt.value}-${i}`} value={opt.value} disabled={opt.disabled}>
            {typeof opt.label === 'string' || typeof opt.label === 'number' ? opt.label : ''}
          </option>
        ))}
      </select>
    </div>
  );
});

CustomSelect.displayName = 'CustomSelect';
export default CustomSelect;

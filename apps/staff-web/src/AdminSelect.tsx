import { useEffect, useId, useRef, useState } from 'react';

import type { KeyboardEvent } from 'react';

export interface AdminSelectOption {
  label: string;
  value: string;
}

interface AdminSelectProps {
  ariaLabel: string;
  className?: string;
  onChange: (value: string) => void;
  options: AdminSelectOption[];
  value: string;
}

function ChevronDownIcon() {
  return (
    <svg aria-hidden="true" className="admin-select__chevron" fill="none" viewBox="0 0 20 20">
      <path d="m5 7.5 5 5 5-5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function AdminSelect({
  ariaLabel,
  className = '',
  onChange,
  options,
  value,
}: AdminSelectProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listboxId = `admin-select-${useId().replace(/:/g, '')}`;
  const selectedIndex = options.findIndex((option) => option.value === value);
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(selectedIndex >= 0 ? selectedIndex : 0);
  const selectedOption = options[selectedIndex] ?? options[0];
  const rootClassName = ['admin-select', className, open ? 'is-open' : '']
    .filter(Boolean)
    .join(' ');

  useEffect(() => {
    setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : 0);
  }, [selectedIndex]);

  useEffect(() => {
    if (!open) return undefined;

    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    document
      .getElementById(`${listboxId}-option-${highlightedIndex}`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [highlightedIndex, listboxId, open]);

  function openMenu() {
    setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
  }

  function chooseOption(option: AdminSelectOption, index: number) {
    setHighlightedIndex(index);
    setOpen(false);
    onChange(option.value);
    triggerRef.current?.focus();
  }

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (options.length === 0) return;

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) {
        openMenu();
        return;
      }

      setHighlightedIndex((current) =>
        event.key === 'ArrowDown'
          ? Math.min(current + 1, options.length - 1)
          : Math.max(current - 1, 0),
      );
      return;
    }

    if (event.key === 'Home' || event.key === 'End') {
      if (!open) return;
      event.preventDefault();
      setHighlightedIndex(event.key === 'Home' ? 0 : options.length - 1);
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!open) {
        openMenu();
        return;
      }

      const option = options[highlightedIndex];
      if (option !== undefined) chooseOption(option, highlightedIndex);
      return;
    }

    if (event.key === 'Escape' && open) {
      event.preventDefault();
      setOpen(false);
      return;
    }

    if (event.key === 'Tab') {
      setOpen(false);
    }
  }

  return (
    <div className={rootClassName} ref={rootRef}>
      <button
        aria-activedescendant={
          open && options[highlightedIndex] !== undefined
            ? `${listboxId}-option-${highlightedIndex}`
            : undefined
        }
        aria-controls={open ? listboxId : undefined}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        className="admin-select__trigger"
        disabled={options.length === 0}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={handleTriggerKeyDown}
        ref={triggerRef}
        role="combobox"
        type="button"
      >
        <span>{selectedOption?.label ?? ''}</span>
        <ChevronDownIcon />
      </button>

      {open && (
        <div aria-label={ariaLabel} className="admin-select__menu" id={listboxId} role="listbox">
          {options.map((option, index) => (
            <div
              aria-selected={option.value === value}
              className={
                index === highlightedIndex
                  ? 'admin-select__option is-highlighted'
                  : 'admin-select__option'
              }
              id={`${listboxId}-option-${index}`}
              key={option.value}
              onClick={() => chooseOption(option, index)}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setHighlightedIndex(index)}
              role="option"
            >
              {option.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

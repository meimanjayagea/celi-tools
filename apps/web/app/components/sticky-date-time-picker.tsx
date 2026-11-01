"use client";

import { CalendarDays, ChevronLeft, ChevronRight, Clock3, X } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

type StickyDateTimePickerProps = {
  value: string | null;
  onChange: (value: string | null) => void;
};

const weekdays = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
const pad = (value: number) => String(value).padStart(2, "0");
const subscribeToTimeZone = () => () => {};
const getBrowserTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
const getServerTimeZone = () => "UTC";

function getInitialDate(value: string | null) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return new Date();
  if (!value) date.setMinutes(0, 0, 0);
  return date;
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function toLocalDateTime(date: Date, time: string) {
  if (!/^\d{2}:\d{2}$/.test(time)) return null;
  const [hours, minutes] = time.split(":").map(Number);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours, minutes).toISOString();
}

export default function StickyDateTimePicker({ value, onChange }: StickyDateTimePickerProps) {
  const [open, setOpen] = useState(false);
  const timeZone = useSyncExternalStore(subscribeToTimeZone, getBrowserTimeZone, getServerTimeZone);
  const [month, setMonth] = useState(() => {
    const date = getInitialDate(value);
    return new Date(date.getFullYear(), date.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(() => getInitialDate(value));
  const [time, setTime] = useState(() => {
    const date = getInitialDate(value);
    return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousFocus = triggerRef.current;
    const initialFocus = dialogRef.current?.querySelector<HTMLElement>(".sticky-calendar-day[aria-pressed='true']")
      ?? dialogRef.current?.querySelector<HTMLElement>("button:not(:disabled)");
    initialFocus?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled)");
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
    };
  }, [open]);

  const openPicker = () => {
    const date = getInitialDate(value);
    setSelectedDate(date);
    setTime(`${pad(date.getHours())}:${pad(date.getMinutes())}`);
    setMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    setOpen(true);
  };

  const changeMonth = (amount: number) => {
    setMonth(current => new Date(current.getFullYear(), current.getMonth() + amount, 1));
  };

  const chooseDay = (day: number) => {
    setSelectedDate(new Date(month.getFullYear(), month.getMonth(), day));
  };

  const saveReminder = () => {
    const reminderAt = toLocalDateTime(selectedDate, time);
    if (!reminderAt) return;
    onChange(reminderAt);
    setOpen(false);
  };

  const clearReminder = () => {
    onChange(null);
    setOpen(false);
  };

  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const firstWeekday = (new Date(month.getFullYear(), month.getMonth(), 1).getDay() + 6) % 7;
  const monthLabel = new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" }).format(month);
  const today = new Date();

  return <div className="sticky-calendar-field">
    <span className="sticky-calendar-label">Pengingat</span>
    <button
      ref={triggerRef}
      type="button"
      className={`sticky-calendar-trigger${value ? " has-value" : ""}`}
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={openPicker}
    >
      <CalendarDays size={15} aria-hidden="true" />
      <span className="sticky-calendar-trigger-copy">
        <strong>{value ? new Intl.DateTimeFormat("id-ID", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone }).format(new Date(value)) : "Atur pengingat"}</strong>
        <small>{value ? new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone }).format(new Date(value)) : "Pilih tanggal dan waktu"}</small>
      </span>
      <ChevronRight size={14} className="sticky-calendar-trigger-chevron" aria-hidden="true" />
    </button>
    {open && createPortal(
      <div className="sticky-calendar-overlay" onMouseDown={event => { if (event.target === event.currentTarget) setOpen(false); }}>
        <section className="sticky-calendar-dialog" role="dialog" aria-modal="true" aria-labelledby="sticky-calendar-title" tabIndex={-1} ref={dialogRef}>
          <header className="sticky-calendar-header">
            <div className="sticky-calendar-heading">
              <span className="sticky-calendar-icon"><CalendarDays size={17} /></span>
              <div><h2 id="sticky-calendar-title">Atur pengingat</h2><p>{value ? "Ubah jadwal catatan ini" : "Pilih waktu untuk diingatkan"}</p></div>
            </div>
            <button type="button" className="sticky-calendar-close" aria-label="Tutup kalender" onClick={() => setOpen(false)}><X size={17} /></button>
          </header>
          <div className="sticky-calendar-month-nav">
            <strong>{monthLabel}</strong>
            <div>
              <button type="button" aria-label="Bulan sebelumnya" onClick={() => changeMonth(-1)}><ChevronLeft size={17} /></button>
              <button type="button" aria-label="Bulan berikutnya" onClick={() => changeMonth(1)}><ChevronRight size={17} /></button>
            </div>
          </div>
          <div className="sticky-calendar-grid" role="group" aria-label={monthLabel}>
            {weekdays.map(day => <span className="sticky-calendar-weekday" aria-hidden="true" key={day}>{day}</span>)}
            {Array.from({ length: firstWeekday }, (_, index) => <span className="sticky-calendar-blank" aria-hidden="true" key={`blank-${index}`} />)}
            {Array.from({ length: daysInMonth }, (_, index) => {
              const day = index + 1;
              const isSelected = selectedDate.getFullYear() === month.getFullYear() && selectedDate.getMonth() === month.getMonth() && selectedDate.getDate() === day;
              const isToday = today.getFullYear() === month.getFullYear() && today.getMonth() === month.getMonth() && today.getDate() === day;
              return <button
                type="button"
                aria-label={formatDate(new Date(month.getFullYear(), month.getMonth(), day))}
                aria-current={isToday ? "date" : undefined}
                aria-pressed={isSelected}
                className={`sticky-calendar-day${isSelected ? " is-selected" : ""}${isToday ? " is-today" : ""}`}
                onClick={() => chooseDay(day)}
                key={day}
              >{day}</button>;
            })}
          </div>
          <div className="sticky-calendar-time-row">
            <span><Clock3 size={15} /> Waktu</span>
            <input aria-label="Waktu pengingat" type="time" required value={time} onChange={event => setTime(event.target.value)} />
          </div>
          <footer className="sticky-calendar-footer">
            {value ? <button type="button" className="sticky-calendar-clear" onClick={clearReminder}>Hapus pengingat</button> : <span />}
            <div><button type="button" className="sticky-calendar-cancel" onClick={() => setOpen(false)}>Batal</button><button type="button" className="sticky-calendar-save" disabled={!/^\d{2}:\d{2}$/.test(time)} onClick={saveReminder}>Simpan</button></div>
          </footer>
        </section>
      </div>,
      document.body,
    )}
  </div>;
}

"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { CircleAlert, FolderPlus, X } from "lucide-react";
import { normalizeDialogName } from "../lib/dialog-validation.mjs";
import { useLanguage } from "./language-provider";

type Options = { title: string; description: string; confirmLabel: string; inputLabel?: string; initialValue?: string; destructive?: boolean };
type Pending = Options & { resolve: (value: string | null) => void };

/** Open a themed, accessible name or confirmation dialog. */
export function useAppDialog() {
  const [pending, setPending] = useState<Pending | null>(null);
  const pendingRef = useRef<Pending | null>(null);
  useEffect(() => () => { pendingRef.current?.resolve(null); pendingRef.current = null; }, []);
  function ask(options: Options): Promise<string | null> {
    return new Promise(resolve => {
      if (pendingRef.current) { resolve(null); return; }
      const next = { ...options, resolve };
      pendingRef.current = next;
      setPending(next);
    });
  }
  function finish(value: string | null) {
    const current = pendingRef.current;
    pendingRef.current = null;
    setPending(null);
    current?.resolve(value);
  }
  return { ask, dialog: pending ? <AppDialog options={pending} onFinish={finish} /> : null };
}

function AppDialog({ options, onFinish }: { options: Options; onFinish: (value: string | null) => void }) {
  const { t } = useLanguage();
  const ref = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const titleId = useId(), descriptionId = useId(), errorId = useId();
  const [error, setError] = useState("");
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    if (options.inputLabel) inputRef.current?.focus();
    return () => { if (dialog?.open) dialog.close(); };
  }, [options.inputLabel]);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!options.inputLabel) { onFinish("confirmed"); return; }
    const value = normalizeDialogName(inputRef.current?.value || "");
    if (!value) { setError(t("Masukkan nama 1–100 karakter.")); inputRef.current?.focus(); return; }
    onFinish(value);
  }
  return <dialog ref={ref} className="app-dialog" aria-labelledby={titleId} aria-describedby={descriptionId} onCancel={event => { event.preventDefault(); onFinish(null); }} onClick={event => { if (event.target === ref.current) onFinish(null); }}>
    <form onSubmit={submit} noValidate>
      <div className="app-dialog-header"><span className={`app-dialog-icon${options.destructive ? " is-danger" : ""}`} aria-hidden="true">{options.destructive ? <CircleAlert size={20}/> : <FolderPlus size={20}/>}</span><div><h2 id={titleId}>{t(options.title)}</h2><p id={descriptionId}>{t(options.description)}</p></div><button type="button" className="app-dialog-close" aria-label={t("Tutup dialog")} onClick={() => onFinish(null)}><X size={18}/></button></div>
      {options.inputLabel && <div className="app-dialog-field"><label htmlFor={`${titleId}-input`}>{t(options.inputLabel)}</label><input ref={inputRef} id={`${titleId}-input`} defaultValue={options.initialValue || ""} maxLength={100} autoComplete="off" aria-invalid={!!error} aria-describedby={error ? errorId : undefined} onChange={() => { if (error) setError(""); }}/>{error && <p id={errorId} role="alert">{error}</p>}</div>}
      <div className="app-dialog-actions"><button type="button" className="secondary-button" autoFocus={options.destructive} onClick={() => onFinish(null)}>{t("Batal")}</button><button type="submit" className={options.destructive ? "app-dialog-danger" : "primary-button"} autoFocus={!options.inputLabel && !options.destructive}>{t(options.confirmLabel)}</button></div>
    </form>
  </dialog>;
}

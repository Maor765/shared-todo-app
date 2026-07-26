export interface ToastMessage {
  id: string;
  text: string;
}

type Listener = (messages: ToastMessage[]) => void;

let messages: ToastMessage[] = [];
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((l) => l(messages));
}

export function showToast(text: string) {
  const id = crypto.randomUUID();
  messages = [...messages, { id, text }];
  emit();
  setTimeout(() => {
    messages = messages.filter((m) => m.id !== id);
    emit();
  }, 4000);
}

export function subscribeToasts(listener: Listener): () => void {
  listeners.add(listener);
  listener(messages);
  return () => listeners.delete(listener);
}

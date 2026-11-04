/** Does the visitor name a day or a clock time ("Friday", "tomorrow", "2pm", "13:15")? */
export function namesATime(message: string): boolean {
  return /\b(mon|tues?|wed(nes)?|thu(rs)?|fri|sat(ur)?|sun)(day)?\b|\b(today|tonight|tomorrow|noon|morning|afternoon|evening)\b|\b\d{1,2}(:\d{2})?\s?(am|pm)\b|\b\d{1,2}:\d{2}\b/i.test(
    message,
  );
}

export function removeIncompleteSentence(
  text: string,
): { aiQuestion: string; isQuestion: boolean } {
  const punctuation = [".", "!", "?"];

  let lastIndex = -1;
  punctuation.forEach((mark) => {
    const index = text.lastIndexOf(mark);
    if (index > lastIndex) {
      lastIndex = index;
    }
  });

  if (lastIndex !== -1) {
    if (text.charAt(lastIndex) == punctuation[2]) {
      // Question
      return {
        aiQuestion: text.substring(0, lastIndex + 1).trim(),
        isQuestion: true,
      };
    } else {
      // Comment
      return {
        aiQuestion: text.substring(0, lastIndex + 1).trim(),
        isQuestion: false,
      };
    }
  } else {
    // Incomplete reply
    return { aiQuestion: "", isQuestion: false };
  }
}

export function createSummary(
  chat_log: { question: string; response: string }[],
  username: string,
  name: string,
): string {
  let summary = `<b>${name}</b>\n@${username}\n\n`;
  for (let index = 0; index < chat_log.length; index++) {
    const { question, response } = chat_log[index];
    summary = summary.concat(`<b>${question}</b>\n${response}\n\n`);
  }
  summary = summary.concat(`<i>Timestamp: ${new Date().toDateString()}</i>`);
  return summary;
}

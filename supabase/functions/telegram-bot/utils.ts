export function removeIncompleteSentence(text: string) {
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

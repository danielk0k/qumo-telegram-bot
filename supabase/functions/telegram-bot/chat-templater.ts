const SYSTEM_TOKEN = "<|system|>";
const USER_TOKEN = "<|user|>";
const ASSISTANT_TOKEN = "<|assistant|>";
const END_OF_STRING = "</s>";
const DEFAULT_SYSTEM_PROMPT =
  "You are a friendly chatbot assisting a researcher to interview a particpant and always responds with a relevant follow up question to gain more insights while staying within the scope of the study.";
const regex = /<\|assistant\|>\n(.*)/g;

export function apply_chat_template(
  chat: { question: string; response: string }[],
  research_purpose: string
) {
  let output =
    `${SYSTEM_TOKEN} ${research_purpose}\n${DEFAULT_SYSTEM_PROMPT}${END_OF_STRING}\n${USER_TOKEN}\nStart asking me questions${END_OF_STRING}\n`;
  for (let index = 0; index < chat.length; index++) {
    const element = chat[index];
    output = output.concat(
      `${ASSISTANT_TOKEN}\n${element.question}${END_OF_STRING}\n`,
      `${USER_TOKEN}\n${element.response}${END_OF_STRING}\n`,
    );
  }
  output = output.concat(ASSISTANT_TOKEN);
  return output;
}

export function extract_response(generated_text: string) {
  const extracted_question = Array.from(generated_text.matchAll(regex));
  if (extracted_question.length < 1) return "";
  else return extracted_question[extracted_question.length - 1][1];
}
